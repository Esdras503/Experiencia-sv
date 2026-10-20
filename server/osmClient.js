import { setDefaultResultOrder } from 'node:dns'
import { parseOsmId } from '../shared/osm.js'
import {
  AppError,
  ERROR_CODES,
  classifyUpstreamHttpError,
  isAbortError,
} from './errors.js'

// En algunas redes (frecuentemente Windows con IPv6 mal configurado) la ruta
// IPv6 a overpass-api.de se queda colgada hasta agotar el timeout, mientras que
// IPv4 responde. Priorizar IPv4 evita esperas de 25 s; si IPv4 falla, Node aún
// puede usar IPv6.
setDefaultResultOrder('ipv4first')

export const NOMINATIM_DEFAULT_URL = 'https://nominatim.openstreetmap.org'
export const OVERPASS_DEFAULT_URL = 'https://overpass-api.de/api/interpreter'
export const DEFAULT_OSM_USER_AGENT = 'ExperienciaSV/1.0'
export const DEFAULT_NOMINATIM_INTERVAL_MS = 1100
export const SV_BBOX = '12.9,-90.2,14.5,-87.6'
const OVERPASS_MAX_CONCURRENCY = 2

const OVERPASS_TIMEOUT_SECONDS = 20
const NOMINATIM_TIMEOUT_MS = 12000
const OVERPASS_TIMEOUT_MS = 25000

function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function normalizeOverpassTimeout(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return OVERPASS_TIMEOUT_MS
  return Math.min(OVERPASS_TIMEOUT_MS, Math.max(3000, Math.round(parsed)))
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

function bboxForRadius(center, radiusMeters) {
  const latitudeDelta = radiusMeters / 111_320
  const longitudeDelta =
    radiusMeters / (111_320 * Math.max(0.01, Math.cos((center.latitude * Math.PI) / 180)))

  return {
    left: Math.max(-180, center.longitude - longitudeDelta),
    top: Math.min(90, center.latitude + latitudeDelta),
    right: Math.min(180, center.longitude + longitudeDelta),
    bottom: Math.max(-90, center.latitude - latitudeDelta),
  }
}

function escapeOverpassRegex(value) {
  const regexEscaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return regexEscaped.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function tagFilter(key, value) {
  return value === '*' ? `["${key}"]` : `["${key}"="${value}"]`
}

/**
 * Construye la consulta Overpass para una categoría. Si hay texto, además del
 * filtro de categoría se busca ese texto en `name` (búsqueda literal, sin
 * interpretar operadores).
 */
export function buildOverpassQuery({
  category,
  textQuery = '',
  center = null,
  radiusMeters = null,
  pageSize = 20,
  timeoutSeconds = OVERPASS_TIMEOUT_SECONDS,
}) {
  const nameFilter = textQuery
    ? `["name"~"${escapeOverpassRegex(textQuery)}",i]`
    : ''
  const area =
    center && radiusMeters
      ? `(around:${Math.round(radiusMeters)},${center.latitude},${center.longitude})`
      : `(${SV_BBOX})`

  const clauses = category.osmFilters.map(
    (filter) =>
      `nwr${Object.entries(filter)
        .map(([key, value]) => tagFilter(key, value))
        .join('')}${nameFilter}${area};`,
  )

  return [
    `[out:json][timeout:${timeoutSeconds}];`,
    '(',
    ...clauses,
    ');',
    `out center ${Math.min(pageSize, 20)};`,
  ].join('\n')
}

function fromNominatim(item) {
  if (!item || typeof item !== 'object') return null
  if (!['node', 'way', 'relation'].includes(item.osm_type)) return null

  const osmId = Number(item.osm_id)
  const latitude = Number(item.lat)
  const longitude = Number(item.lon)
  if (!Number.isSafeInteger(osmId) || osmId <= 0) return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  const namedetails = item.namedetails ?? {}

  return {
    osmType: item.osm_type,
    osmId,
    name: namedetails['name:es'] ?? namedetails.name ?? item.name ?? null,
    displayName: item.display_name ?? null,
    latitude,
    longitude,
    tags: item.extratags && typeof item.extratags === 'object' ? item.extratags : {},
    nominatimClass: item.category ?? item.class ?? null,
    nominatimType: item.type ?? null,
  }
}

function fromOverpass(element) {
  if (!element || !['node', 'way', 'relation'].includes(element.type)) return null

  const osmId = Number(element.id)
  const latitude = Number(element.lat ?? element.center?.lat)
  const longitude = Number(element.lon ?? element.center?.lon)
  if (!Number.isSafeInteger(osmId) || osmId <= 0) return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  const tags = element.tags && typeof element.tags === 'object' ? element.tags : {}

  return {
    osmType: element.type,
    osmId,
    name: tags['name:es'] ?? tags.name ?? null,
    displayName: null,
    latitude,
    longitude,
    tags,
    nominatimClass: null,
    nominatimType: null,
  }
}

function assertArrayPayload(payload) {
  if (!Array.isArray(payload)) {
    throw new AppError(ERROR_CODES.UPSTREAM_UNAVAILABLE, { status: 503 })
  }
  return payload
}

export function createOsmClient({
  fetchImpl = fetch,
  userAgent = DEFAULT_OSM_USER_AGENT,
  nominatimUrl = NOMINATIM_DEFAULT_URL,
  overpassUrl = OVERPASS_DEFAULT_URL,
  minIntervalMs = DEFAULT_NOMINATIM_INTERVAL_MS,
  now = Date.now,
  sleep = defaultSleep,
} = {}) {
  const nominatimBase = stripTrailingSlash(nominatimUrl)
  const overpassBase = stripTrailingSlash(overpassUrl)
  const effectiveUserAgent = userAgent || DEFAULT_OSM_USER_AGENT

  let lastNominatimAt = -Infinity
  let nominatimQueue = Promise.resolve()

  let overpassActive = 0
  const overpassWaiting = []

  async function withOverpassSlot(task) {
    if (overpassActive >= OVERPASS_MAX_CONCURRENCY) {
      await new Promise((resolve) => overpassWaiting.push(resolve))
    }
    overpassActive += 1
    try {
      return await task()
    } finally {
      overpassActive -= 1
      const next = overpassWaiting.shift()
      if (next) next()
    }
  }

  function scheduleNominatim(task) {
    const run = nominatimQueue.then(async () => {
      const elapsed = now() - lastNominatimAt
      const wait = Math.max(0, minIntervalMs - elapsed)
      if (wait > 0) await sleep(wait)
      lastNominatimAt = now()
      return task()
    })

    nominatimQueue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  async function requestJson(url, { method = 'GET', body, headers = {}, timeoutMs }) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetchImpl(url, {
        method,
        headers: {
          'User-Agent': effectiveUserAgent,
          Accept: 'application/json',
          ...headers,
        },
        body,
        signal: controller.signal,
      })

      if (!response.ok) {
        throw classifyUpstreamHttpError(response.status)
      }

      let payload
      try {
        payload = await response.json()
      } catch {
        throw new AppError(ERROR_CODES.UPSTREAM_UNAVAILABLE, { status: 503 })
      }

      if (payload === null || payload === undefined) {
        throw new AppError(ERROR_CODES.UPSTREAM_UNAVAILABLE, { status: 503 })
      }

      return payload
    } catch (error) {
      if (error instanceof AppError) throw error
      if (isAbortError(error)) {
        throw new AppError(ERROR_CODES.UPSTREAM_TIMEOUT, { status: 503 })
      }
      throw new AppError(ERROR_CODES.NETWORK_ERROR, { status: 503 })
    } finally {
      clearTimeout(timer)
    }
  }

  async function nominatimSearch({ textQuery, center, radiusMeters, pageSize, language = 'es' }) {
    const params = new URLSearchParams({
      format: 'jsonv2',
      q: textQuery,
      countrycodes: 'sv',
      limit: String(pageSize),
      addressdetails: '1',
      extratags: '1',
      namedetails: '1',
      'accept-language': language,
      dedupe: '1',
    })

    if (center && radiusMeters) {
      const bbox = bboxForRadius(center, radiusMeters)
      params.set('viewbox', `${bbox.left},${bbox.top},${bbox.right},${bbox.bottom}`)
      params.set('bounded', '1')
    }

    const payload = await scheduleNominatim(() =>
      requestJson(`${nominatimBase}/search?${params.toString()}`, {
        timeoutMs: NOMINATIM_TIMEOUT_MS,
      }),
    )

    return assertArrayPayload(payload).map(fromNominatim).filter(Boolean)
  }

  async function overpassRequest(query, { timeoutMs = OVERPASS_TIMEOUT_MS } = {}) {
    const effectiveTimeoutMs = normalizeOverpassTimeout(timeoutMs)
    const payload = await withOverpassSlot(() =>
      requestJson(overpassBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
        timeoutMs: effectiveTimeoutMs,
      }),
    )

    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.elements)) {
      throw new AppError(ERROR_CODES.UPSTREAM_UNAVAILABLE, { status: 503 })
    }

    if (payload.remark && payload.elements.length === 0) {
      if (/timed out/i.test(payload.remark)) {
        throw new AppError(ERROR_CODES.UPSTREAM_TIMEOUT, { status: 503 })
      }
      throw new AppError(ERROR_CODES.UPSTREAM_UNAVAILABLE, { status: 503 })
    }

    return payload.elements
  }

  async function overpassSearch({
    category,
    textQuery,
    center,
    radiusMeters,
    pageSize,
    timeoutMs = null,
  }) {
    const effectiveTimeoutMs = normalizeOverpassTimeout(timeoutMs)
    const query = buildOverpassQuery({
      category,
      textQuery,
      center,
      radiusMeters,
      pageSize,
      ...(timeoutMs === null
        ? {}
        : { timeoutSeconds: Math.max(5, Math.ceil(effectiveTimeoutMs / 1000) - 1) }),
    })
    const elements = await overpassRequest(query, { timeoutMs: effectiveTimeoutMs })
    return elements.map(fromOverpass).filter(Boolean)
  }

  async function search({
    textQuery = '',
    category = null,
    center = null,
    radiusMeters = null,
    pageSize = 20,
    language = 'es',
    timeoutMs = null,
  }) {
    if (category) {
      return {
        source: 'overpass',
        items: await overpassSearch({
          category,
          textQuery,
          center,
          radiusMeters,
          pageSize,
          timeoutMs,
        }),
      }
    }

    return {
      source: 'nominatim',
      items: await nominatimSearch({
        textQuery,
        center,
        radiusMeters,
        pageSize,
        language,
      }),
    }
  }

  async function overpassLookup({ type, id }) {
    const query = [
      `[out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];`,
      `${type}(${id});`,
      'out center;',
    ].join('\n')

    const elements = await overpassRequest(query)
    return elements[0] ? fromOverpass(elements[0]) : null
  }

  async function details(placeId, { language = 'es' } = {}) {
    const parsed = parseOsmId(placeId)
    if (!parsed) {
      throw new AppError(ERROR_CODES.INVALID_REQUEST, {
        status: 400,
        message: 'El identificador del lugar no es válido.',
      })
    }

    const prefix = { node: 'N', way: 'W', relation: 'R' }[parsed.type]
    const params = new URLSearchParams({
      osm_ids: `${prefix}${parsed.id}`,
      format: 'jsonv2',
      addressdetails: '1',
      extratags: '1',
      namedetails: '1',
      'accept-language': language,
    })

    const payload = await scheduleNominatim(() =>
      requestJson(`${nominatimBase}/lookup?${params.toString()}`, {
        timeoutMs: NOMINATIM_TIMEOUT_MS,
      }),
    )

    const nominatimItem = assertArrayPayload(payload)[0]
    if (nominatimItem) {
      const mapped = fromNominatim(nominatimItem)
      if (mapped) return mapped
    }

    const fallback = await overpassLookup(parsed)
    if (fallback) return fallback

    throw new AppError(ERROR_CODES.PLACE_NOT_FOUND, { status: 404 })
  }

  async function locate(textQuery, { language = 'es' } = {}) {
    const params = new URLSearchParams({
      format: 'jsonv2',
      q: textQuery,
      countrycodes: 'sv',
      limit: '1',
      addressdetails: '1',
      'accept-language': language,
      dedupe: '1',
    })

    const payload = await scheduleNominatim(() =>
      requestJson(`${nominatimBase}/search?${params.toString()}`, {
        timeoutMs: NOMINATIM_TIMEOUT_MS,
      }),
    )

    const item = assertArrayPayload(payload)[0]
    const mapped = item ? fromNominatim(item) : null
    if (!mapped) {
      throw new AppError(ERROR_CODES.LOCATION_NOT_FOUND, { status: 404 })
    }
    return mapped
  }

  return { search, details, locate }
}
