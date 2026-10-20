const NETWORK_ERROR_MESSAGE =
  'No se pudo contactar al servicio de búsqueda. Revisa tu conexión e intenta de nuevo.'

export class ApiError extends Error {
  constructor(code, message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

async function requestJson(path, { method = 'GET', body, signal } = {}) {
  let response

  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new ApiError('NETWORK_ERROR', NETWORK_ERROR_MESSAGE)
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    // Sin JSON (proxy caído, error del borde): se trata como problema de
    // conexión para que el mensaje sea útil.
    if (!payload && response.status >= 500) {
      throw new ApiError('NETWORK_ERROR', NETWORK_ERROR_MESSAGE, response.status)
    }

    throw new ApiError(
      payload?.error?.code ?? 'UNKNOWN',
      payload?.error?.message ?? 'Ocurrió un error inesperado. Intenta de nuevo.',
      response.status,
    )
  }

  return payload ?? {}
}

export function getApiConfig({ signal } = {}) {
  return requestJson('/api/config', { signal })
}

export function searchPlaces({ query, category, center, radiusKm, pageSize } = {}, { signal } = {}) {
  return requestJson('/api/search', {
    method: 'POST',
    body: { query, category, center, radiusKm, pageSize },
    signal,
  })
}

export function fetchPlace(placeId, { signal } = {}) {
  const params = new URLSearchParams({ id: placeId })
  return requestJson(`/api/place?${params.toString()}`, { signal })
}

export function locateReference(query, { signal } = {}) {
  return requestJson('/api/locate', { method: 'POST', body: { query }, signal })
}
