import { isValidLatitude, isValidLongitude } from '../../shared/geo.js'
import { createTtlCache } from '../cache.js'
import { AppError, ERROR_CODES, classifyUpstreamHttpError } from '../errors.js'
import { createConcurrencyLimiter } from '../rateLimit.js'

export const OSRM_DEFAULT_URL = 'https://router.project-osrm.org'
export const OSRM_DEFAULT_TIMEOUT_MS = 5000
const OSRM_DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000
const OSRM_MAX_POINTS = 25
const OSRM_MAX_CONCURRENT = 2

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

export function resolveOsrmConfig(env = {}) {
  const rawUrl = firstNonEmpty(env.OSRM_URL, OSRM_DEFAULT_URL)
  let baseUrl
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('protocolo no permitido')
    }
    baseUrl = `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`
  } catch {
    baseUrl = null
  }

  return {
    baseUrl,
    timeoutMs: clampInteger(
      env.OSRM_TIMEOUT_MS,
      OSRM_DEFAULT_TIMEOUT_MS,
      500,
      15_000,
    ),
    cacheTtlMs: clampInteger(
      env.OSRM_CACHE_TTL_MS,
      OSRM_DEFAULT_CACHE_TTL_MS,
      60_000,
      24 * 60 * 60 * 1000,
    ),
    userAgent:
      firstNonEmpty(env.OSRM_USER_AGENT, env.OSM_USER_AGENT) ||
      'ExperienciaSV/1.0 (presupuestos; OpenStreetMap)',
  }
}

function validatePoints(points) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new AppError(ERROR_CODES.UPSTREAM_BAD_REQUEST, {
      status: 400,
      message: 'Se necesitan al menos dos puntos para calcular una ruta.',
    })
  }
  if (points.length > OSRM_MAX_POINTS) {
    throw new AppError(ERROR_CODES.UPSTREAM_BAD_REQUEST, {
      status: 400,
      message: 'El recorrido tiene demasiados puntos para calcular la ruta.',
    })
  }

  return points.map((point) => {
    const latitude = Number(point?.latitude)
    const longitude = Number(point?.longitude)
    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      throw new AppError(ERROR_CODES.UPSTREAM_BAD_REQUEST, {
        status: 400,
        message: 'El recorrido contiene coordenadas no válidas.',
      })
    }
    return {
      label: typeof point.label === 'string' ? point.label : null,
      latitude,
      longitude,
    }
  })
}

function routeUrl(baseUrl, points) {
  const coordinates = points
    .map((point) => `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`)
    .join(';')
  return `${baseUrl}/route/v1/driving/${coordinates}?overview=false&steps=false&alternatives=false`
}

function cacheKey(points) {
  return points
    .map((point) => `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`)
    .join(';')
}

function parseOsrmPayload(payload, points) {
  if (!payload || typeof payload !== 'object' || payload.code !== 'Ok') {
    throw new AppError(ERROR_CODES.UPSTREAM_UNAVAILABLE, {
      status: 502,
      message: 'OSRM no devolvió una ruta válida.',
    })
  }
  const route = Array.isArray(payload.routes) ? payload.routes[0] : null
  const distanceMeters = Number(route?.distance)
  const durationSeconds = Number(route?.duration)
  if (
    !route ||
    !Number.isFinite(distanceMeters) ||
    distanceMeters < 0 ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 0
  ) {
    throw new AppError(ERROR_CODES.UPSTREAM_UNAVAILABLE, {
      status: 502,
      message: 'OSRM no devolvió distancias válidas.',
    })
  }

  let legs = Array.isArray(route.legs)
    ? route.legs
        .map((leg, index) => {
          const legDistance = Number(leg?.distance)
          const legDuration = Number(leg?.duration)
          if (
            !Number.isFinite(legDistance) ||
            legDistance < 0 ||
            !Number.isFinite(legDuration) ||
            legDuration < 0
          ) {
            return null
          }
          return {
            fromLabel: points[index]?.label ?? null,
            toLabel: points[index + 1]?.label ?? null,
            distanceMeters: Math.round(legDistance),
            durationSeconds: Math.round(legDuration),
          }
        })
        .filter(Boolean)
    : []

  if (legs.length !== points.length - 1) {
    legs = [
      {
        fromLabel: points[0]?.label ?? null,
        toLabel: points[points.length - 1]?.label ?? null,
        distanceMeters: Math.round(distanceMeters),
        durationSeconds: Math.round(durationSeconds),
      },
    ]
  }

  return {
    source: 'osrm',
    estimated: false,
    distanceMeters: Math.round(distanceMeters),
    durationSeconds: Math.round(durationSeconds),
    legs,
  }
}

/**
 * Cliente opcional de OSRM. Si OSRM falla, el servicio de presupuesto usa una
 * estimación haversine claramente marcada; este módulo nunca inventa una ruta
 * ni presenta la línea recta como distancia por carretera.
 */
export function createRouteService({
  env = {},
  fetchImpl = fetch,
  now = Date.now,
  logError = () => {},
} = {}) {
  const config = resolveOsrmConfig(env)
  const cache = createTtlCache({ ttlMs: config.cacheTtlMs, maxEntries: 200, now })
  const concurrency = createConcurrencyLimiter({ max: OSRM_MAX_CONCURRENT })

  async function route(pointsInput, { signal } = {}) {
    if (!config.baseUrl) {
      throw new AppError(ERROR_CODES.UPSTREAM_UNAVAILABLE, {
        status: 503,
        message: 'La URL de OSRM no está configurada correctamente.',
      })
    }
    const points = validatePoints(pointsInput)
    const key = cacheKey(points)
    const cached = cache.get(key)
    if (cached) return cached

    const release = concurrency.tryAcquire()
    if (!release) {
      throw new AppError(ERROR_CODES.UPSTREAM_UNAVAILABLE, {
        status: 503,
        message: 'Hay demasiados cálculos de ruta en curso.',
      })
    }

    const controller = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, config.timeoutMs)
    const forwardAbort = () => controller.abort()
    signal?.addEventListener?.('abort', forwardAbort, { once: true })

    try {
      const response = await fetchImpl(routeUrl(config.baseUrl, points), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': config.userAgent,
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        throw classifyUpstreamHttpError(response.status)
      }

      let payload
      try {
        payload = await response.json()
      } catch {
        throw new AppError(ERROR_CODES.UPSTREAM_UNAVAILABLE, {
          status: 502,
          message: 'OSRM devolvió una respuesta ilegible.',
        })
      }

      const parsed = parseOsrmPayload(payload, points)
      cache.set(key, parsed)
      return parsed
    } catch (error) {
      if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR') {
        if (signal?.aborted) {
          const abortError = new Error('La solicitud de ruta fue cancelada.')
          abortError.name = 'AbortError'
          throw abortError
        }
        if (timedOut) {
          throw new AppError(ERROR_CODES.UPSTREAM_TIMEOUT, {
            status: 504,
            message: 'OSRM no respondió a tiempo.',
          })
        }
      }
      if (error instanceof AppError) throw error
      safeLog(logError, 'calcular ruta con OSRM', error)
      throw new AppError(ERROR_CODES.UPSTREAM_UNAVAILABLE, {
        status: 502,
        message: 'No se pudo calcular la ruta con OSRM.',
      })
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener?.('abort', forwardAbort)
      release()
    }
  }

  return {
    enabled: Boolean(config.baseUrl),
    config,
    route,
  }
}

function safeLog(logError, context, error) {
  try {
    logError(context, error)
  } catch {
    // El registro nunca debe impedir una respuesta de presupuesto.
  }
}
