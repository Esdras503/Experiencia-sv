import { getCategoryByKey, ALL_CATEGORIES_KEY } from '../shared/categories.js'
import { MAX_CHAT_MESSAGE_LENGTH } from '../shared/chat.js'
import {
  OSM_ATTRIBUTION,
  OSM_COPYRIGHT_URL,
  OSM_TILE_ATTRIBUTION as OSM_TILE_ATTRIBUTION_DEFAULT,
  OSM_TILE_URL_DEFAULT,
} from '../shared/osm.js'
import { AppError, ERROR_CODES, redactSecrets, publicMessageFor } from './errors.js'
import {
  validateSearchQuery,
  validatePlaceQuery,
  validateLocateInput,
  RADIUS_OPTIONS_KM,
} from './validation.js'
import { createRateLimiter, createConcurrencyLimiter } from './rateLimit.js'
import { createTtlCache } from './cache.js'
import { haversineMeters } from '../shared/geo.js'
import {
  createOsmClient,
  DEFAULT_NOMINATIM_INTERVAL_MS,
  DEFAULT_OSM_USER_AGENT,
  NOMINATIM_DEFAULT_URL,
  OVERPASS_DEFAULT_URL,
} from './osmClient.js'
import { toPublicPlace, toPublicPlaceDetails } from './osmMapper.js'
import { resolveAiConfig } from './aiConfig.js'
import { createAiClient } from './aiClient.js'
import { validateChatRequest } from './chatValidation.js'
import { createChatService } from './chatService.js'
import { resolveItinerarySigningSecret } from './chatItinerary.js'

const LANGUAGE_CODE = 'es'
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000
const MIN_TEXT_QUERY_LENGTH = 2

export const RANKING_NOTICE =
  'Los resultados provienen de OpenStreetMap. La búsqueda por texto usa la relevancia de Nominatim; las búsquedas por categoría se ordenan por distancia cuando eliges una referencia. OpenStreetMap no incluye calificaciones ni reseñas.'

function jsonResponse(status, payload) {
  return {
    status,
    json: payload,
    headers: { 'Cache-Control': 'no-store' },
  }
}

function errorResponse(error) {
  const appError = error instanceof AppError ? error : new AppError(ERROR_CODES.INTERNAL)
  return jsonResponse(appError.status, {
    // Los mensajes de AppError son propios y seguros; nunca contienen
    // texto del proveedor ni credenciales.
    error: { code: appError.code, message: appError.message || publicMessageFor(appError.code) },
  })
}

function checkOrigin({ headers, env }) {
  const allowed = env.ALLOWED_ORIGIN
  const origin = headers?.origin
  if (!allowed || !origin) return
  if (origin !== allowed) {
    throw new AppError(ERROR_CODES.FORBIDDEN, {
      status: 403,
      message: 'El origen de la solicitud no está autorizado.',
    })
  }
}

function safeLog(logError, context, error) {
  const detail = {
    code: error?.code ?? error?.name ?? 'UNKNOWN',
    message: redactSecrets(error?.message ?? '').slice(0, 300),
  }
  logError(`[api] ${context}`, detail)
}

function isSafeTileUrl(value) {
  if (typeof value !== 'string') return false
  if (!value.includes('{z}') || !value.includes('{x}') || !value.includes('{y}')) return false
  try {
    const probe = new URL(value.replace('{z}', '0').replace('{x}', '0').replace('{y}', '0'))
    return probe.protocol === 'https:'
  } catch {
    return false
  }
}

function resolveMinInterval(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_NOMINATIM_INTERVAL_MS
  return parsed
}

function resolveLimit(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(maximum, Math.max(minimum, parsed))
}

const DUPLICATE_NAME_RADIUS_METERS = 150

function normalizeName(name) {
  if (typeof name !== 'string') return ''
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Deduplica por identificador y, además, por nombre a corta distancia.
 * Nominatim puede devolver el mismo lugar como nodo y como relación (por
 * ejemplo, una playa); se conserva el primero, que es el de mayor relevancia.
 */
function dedupePlaces(places) {
  const seenIds = new Set()
  const unique = []

  for (const place of places) {
    if (seenIds.has(place.id)) continue

    const normalized = normalizeName(place.name)
    const duplicate = normalized
      ? unique.find(
          (other) =>
            normalizeName(other.name) === normalized &&
            haversineMeters(other.location, place.location) < DUPLICATE_NAME_RADIUS_METERS,
        )
      : undefined

    if (duplicate) continue

    seenIds.add(place.id)
    unique.push(place)
  }

  return unique
}

export function createRequestHandler({
  env = process.env,
  fetchImpl = fetch,
  now = Date.now,
  logError = console.error,
  osmClient,
  aiClient,
} = {}) {
  const searchLimiter = createRateLimiter({ limit: 30, windowMs: 60_000, now })
  const generalLimiter = createRateLimiter({ limit: 60, windowMs: 60_000, now })
  const chatIpLimiter = createRateLimiter({
    limit: resolveLimit(env.CHAT_RATE_LIMIT_PER_MINUTE, 12, 1, 60),
    windowMs: 60_000,
    now,
  })
  const chatSessionLimiter = createRateLimiter({
    limit: resolveLimit(env.CHAT_SESSION_LIMIT_PER_MINUTE, 8, 1, 40),
    windowMs: 60_000,
    now,
  })
  const chatConcurrency = createConcurrencyLimiter({
    max: resolveLimit(env.CHAT_MAX_CONCURRENT, 2, 1, 5),
  })
  const searchCache = createTtlCache({ ttlMs: SEARCH_CACHE_TTL_MS, maxEntries: 100, now })
  const detailsCache = createTtlCache({ ttlMs: SEARCH_CACHE_TTL_MS, maxEntries: 100, now })
  const locateCache = createTtlCache({ ttlMs: SEARCH_CACHE_TTL_MS, maxEntries: 50, now })

  const client =
    osmClient ??
    createOsmClient({
      fetchImpl,
      userAgent: env.OSM_USER_AGENT || DEFAULT_OSM_USER_AGENT,
      nominatimUrl: env.NOMINATIM_URL || NOMINATIM_DEFAULT_URL,
      overpassUrl: env.OVERPASS_URL || OVERPASS_DEFAULT_URL,
      minIntervalMs: resolveMinInterval(env.NOMINATIM_MIN_INTERVAL_MS),
      now,
    })

  const aiConfig = resolveAiConfig(env)
  const resolvedAiClient =
    aiClient ?? createAiClient({ config: aiConfig, fetchImpl, logError })
  const signingSecret = resolveItinerarySigningSecret(env, aiConfig.apiKey)

  function enforceRateLimit(limiter, ip, context) {
    const result = limiter.check(ip ?? 'unknown')
    if (!result.allowed) {
      safeLog(logError, `límite alcanzado en ${context}`, { code: 'RATE_LIMITED' })
      throw new AppError(ERROR_CODES.RATE_LIMITED, { status: 429 })
    }
  }

  /**
   * Búsqueda real en OpenStreetMap. La usan tanto `/api/search` como las
   * herramientas del chatbot; aquí no se aplican límites por IP porque el
   * llamador ya los controla.
   */
  async function runSearch({
    searchText = '',
    categoryKey = null,
    center = null,
    radiusKm = null,
    pageSize = 6,
    timeoutMs = null,
  } = {}) {
    let category = null
    if (categoryKey && categoryKey !== ALL_CATEGORIES_KEY) {
      category = getCategoryByKey(categoryKey)
      if (!category) {
        throw new AppError(ERROR_CODES.INVALID_REQUEST, {
          status: 400,
          message: 'La categoría indicada no existe.',
        })
      }
    }

    if (!category && searchText.length < MIN_TEXT_QUERY_LENGTH) {
      throw new AppError(ERROR_CODES.INVALID_REQUEST, {
        status: 400,
        message: 'Escribe al menos 2 caracteres o elige una categoría para buscar.',
      })
    }

    const cacheKey = JSON.stringify({
      searchText,
      categoryKey: category?.key ?? null,
      center,
      radiusKm,
      pageSize,
    })

    const cached = searchCache.get(cacheKey)
    if (cached) return cached

    let result
    try {
      result = await client.search({
        textQuery: searchText,
        category,
        center,
        radiusMeters: radiusKm ? radiusKm * 1000 : null,
        pageSize,
        language: LANGUAGE_CODE,
        timeoutMs,
      })
    } catch (error) {
      safeLog(logError, 'búsqueda', error)
      if (!center && error instanceof AppError && error.code === ERROR_CODES.UPSTREAM_TIMEOUT) {
        throw new AppError(ERROR_CODES.UPSTREAM_TIMEOUT, {
          status: 503,
          message:
            'OpenStreetMap tardó demasiado en responder. Prueba una búsqueda más específica o acota con «Buscar cerca de mí» o una ciudad de referencia.',
        })
      }
      throw error
    }

    let places = result.items
      .map((item) => toPublicPlace(item, { center, category }))
      .filter(Boolean)

    if (radiusKm) {
      places = places.filter(
        (place) => place.distanceMeters !== null && place.distanceMeters <= radiusKm * 1000,
      )
    }

    if (center) {
      places.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity))
    } else if (result.source === 'overpass') {
      places.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'es'))
    }

    const payload = {
      places: dedupePlaces(places).slice(0, pageSize),
      center: center ?? null,
      radiusKm: radiusKm ?? null,
      source: 'openstreetmap',
      dataSource: result.source,
      attribution: OSM_ATTRIBUTION,
      attributionUrl: OSM_COPYRIGHT_URL,
      rankingNotice: RANKING_NOTICE,
    }

    searchCache.set(cacheKey, payload)
    return payload
  }

  /** Detalle real de un lugar, con la misma caché que usa `/api/place`. */
  async function runDetails(placeId) {
    const cached = detailsCache.get(placeId)
    if (cached) return cached

    let item
    try {
      item = await client.details(placeId, { language: LANGUAGE_CODE })
    } catch (error) {
      safeLog(logError, 'detalle', error)
      throw error
    }

    const place = toPublicPlaceDetails(item)
    if (!place) {
      throw new AppError(ERROR_CODES.PLACE_NOT_FOUND, { status: 404 })
    }

    const payload = {
      place,
      source: 'openstreetmap',
      attribution: OSM_ATTRIBUTION,
      attributionUrl: OSM_COPYRIGHT_URL,
    }

    detailsCache.set(placeId, payload)
    return payload
  }

  /** Resolución de una ciudad o referencia, con caché compartida. */
  async function runLocate(searchText) {
    const cacheKey = searchText.toLowerCase()
    const cached = locateCache.get(cacheKey)
    if (cached) return cached

    let item
    try {
      item = await client.locate(searchText, { language: LANGUAGE_CODE })
    } catch (error) {
      safeLog(logError, 'ubicación de referencia', error)
      throw error
    }

    const label =
      (typeof item.name === 'string' && item.name.trim()) ||
      (typeof item.displayName === 'string' && item.displayName.split(',')[0].trim()) ||
      searchText

    const payload = {
      location: { latitude: item.latitude, longitude: item.longitude },
      label,
      address: item.displayName ?? null,
      source: 'openstreetmap',
      attribution: OSM_ATTRIBUTION,
      attributionUrl: OSM_COPYRIGHT_URL,
    }

    locateCache.set(cacheKey, payload)
    return payload
  }

  const chatService = createChatService({
    aiClient: resolvedAiClient,
    placeService: { search: runSearch, detailsById: runDetails, locate: runLocate },
    signingSecret,
    env,
    now,
    logError,
  })

  async function handleSearch({ body, ip, headers }) {
    enforceRateLimit(searchLimiter, ip, 'search')
    checkOrigin({ headers, env })

    const input = validateSearchQuery(body)
    const payload = await runSearch(input)
    return jsonResponse(200, payload)
  }

  async function handlePlace({ query, ip, headers }) {
    enforceRateLimit(generalLimiter, ip, 'place')
    checkOrigin({ headers, env })

    const { placeId } = validatePlaceQuery(query)
    const payload = await runDetails(placeId)
    return jsonResponse(200, payload)
  }

  async function handleLocate({ body, ip, headers }) {
    enforceRateLimit(generalLimiter, ip, 'locate')
    checkOrigin({ headers, env })

    const { searchText } = validateLocateInput(body)
    const payload = await runLocate(searchText)
    return jsonResponse(200, payload)
  }

  async function handleChat({ body, ip, headers, signal }) {
    checkOrigin({ headers, env })

    // Límites anónimos: IP + identificador de sesión del navegador. Ninguno
    // es una identidad confiable, pero juntos reducen el abuso automatizado.
    enforceRateLimit(chatIpLimiter, ip, 'chat')

    const input = validateChatRequest(body)
    if (input.sessionId) {
      const sessionResult = chatSessionLimiter.check(input.sessionId)
      if (!sessionResult.allowed) {
        safeLog(logError, 'límite alcanzado en chat (sesión)', { code: 'RATE_LIMITED' })
        throw new AppError(ERROR_CODES.RATE_LIMITED, { status: 429 })
      }
    }

    const release = chatConcurrency.tryAcquire()
    if (!release) {
      safeLog(logError, 'chat ocupado', { code: 'CHAT_BUSY' })
      throw new AppError(ERROR_CODES.CHAT_BUSY, { status: 429 })
    }

    try {
      const payload = await chatService.handleChat({
        message: input.message,
        history: input.history,
        itineraryToken: input.itineraryToken,
        signal,
      })
      return jsonResponse(200, payload)
    } finally {
      release()
    }
  }

  function handleConfig() {
    const tileUrl = isSafeTileUrl(env.OSM_TILE_URL) ? env.OSM_TILE_URL : OSM_TILE_URL_DEFAULT
    const tileAttribution =
      typeof env.OSM_TILE_ATTRIBUTION === 'string' && env.OSM_TILE_ATTRIBUTION.trim()
        ? env.OSM_TILE_ATTRIBUTION
        : OSM_TILE_ATTRIBUTION_DEFAULT

    return jsonResponse(200, {
      configured: true,
      source: 'openstreetmap',
      provider: 'OpenStreetMap',
      attribution: OSM_ATTRIBUTION,
      attributionUrl: OSM_COPYRIGHT_URL,
      radiusOptionsKm: RADIUS_OPTIONS_KM,
      map: {
        // OpenStreetMap no usa claves. El mapa carga teselas directamente
        // desde el proveedor configurado y muestra la atribución obligatoria.
        tileUrl,
        attribution: tileAttribution,
        attributionUrl: OSM_COPYRIGHT_URL,
      },
      chat: {
        enabled: chatService.enabled,
        provider: chatService.enabled ? chatService.providerName : null,
        model: chatService.enabled ? chatService.model : null,
        dataSource: 'OpenStreetMap',
        maxMessageLength: MAX_CHAT_MESSAGE_LENGTH,
      },
    })
  }

  return async function handleRequest({
    method,
    pathname,
    query = {},
    body,
    headers,
    ip,
    signal,
  }) {
    try {
      if (pathname === '/api/config') {
        if (method !== 'GET') {
          throw new AppError(ERROR_CODES.METHOD_NOT_ALLOWED, { status: 405 })
        }
        return handleConfig()
      }

      if (pathname === '/api/search') {
        if (method !== 'POST') {
          throw new AppError(ERROR_CODES.METHOD_NOT_ALLOWED, { status: 405 })
        }
        return await handleSearch({ body, ip, headers })
      }

      if (pathname === '/api/place') {
        if (method !== 'GET') {
          throw new AppError(ERROR_CODES.METHOD_NOT_ALLOWED, { status: 405 })
        }
        return await handlePlace({ query, ip, headers })
      }

      if (pathname === '/api/locate') {
        if (method !== 'POST') {
          throw new AppError(ERROR_CODES.METHOD_NOT_ALLOWED, { status: 405 })
        }
        return await handleLocate({ body, ip, headers })
      }

      if (pathname === '/api/chat') {
        if (method !== 'POST') {
          throw new AppError(ERROR_CODES.METHOD_NOT_ALLOWED, { status: 405 })
        }
        return await handleChat({ body, ip, headers, signal })
      }

      throw new AppError(ERROR_CODES.NOT_FOUND, { status: 404 })
    } catch (error) {
      if (!(error instanceof AppError)) {
        safeLog(logError, 'error inesperado', error)
      }
      return errorResponse(error)
    }
  }
}
