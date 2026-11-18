import { ApiError } from './placesService.js'

const NETWORK_ERROR_MESSAGE =
  'No pudimos calcular el presupuesto. Revisa tu conexión e intenta de nuevo.'

async function requestBudget(path, { method = 'GET', body, accessToken, signal } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  let response
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new ApiError('NETWORK_ERROR', NETWORK_ERROR_MESSAGE)
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    if (!payload && response.status >= 500) {
      throw new ApiError('NETWORK_ERROR', NETWORK_ERROR_MESSAGE, response.status)
    }
    throw new ApiError(
      payload?.error?.code ?? 'INTERNAL',
      payload?.error?.message ?? 'No pudimos calcular el presupuesto.',
      response.status,
      payload?.error?.details ?? null,
    )
  }

  return payload ?? {}
}

function cleanOptions(options = {}) {
  const result = {}
  const travelers = Number(options.travelers)
  const children = Number(options.children)
  const days = Number(options.days)
  const nights = Number(options.nights)
  if (Number.isInteger(travelers)) result.travelers = travelers
  if (Number.isInteger(children)) result.children = children
  if (Number.isInteger(days)) result.days = days
  if (Number.isInteger(nights)) result.nights = nights
  if (options.transportMode) result.transportMode = options.transportMode
  if (options.mealTier) result.mealTier = options.mealTier
  if (options.lodgingTier) result.lodgingTier = options.lodgingTier
  if (typeof options.includeLodging === 'boolean') {
    result.includeLodging = options.includeLodging
  }
  return result
}

export function calculateBudget(
  {
    itinerary,
    options = {},
    itineraryId = null,
    accessToken = null,
    signal,
    persist = true,
  } = {},
) {
  return requestBudget('/api/budget/calculate', {
    method: 'POST',
    body: {
      itinerary,
      options: cleanOptions(options),
      itineraryId: itineraryId ?? null,
      persist: persist !== false,
    },
    accessToken,
    signal,
  })
}

export function fetchBudgetHistory(
  { itineraryId = null, limit = 20, accessToken = null, signal } = {},
) {
  const params = new URLSearchParams()
  if (itineraryId) params.set('itineraryId', itineraryId)
  if (Number.isInteger(limit)) params.set('limit', String(limit))
  const query = params.toString()
  return requestBudget(`/api/budget/history${query ? `?${query}` : ''}`, {
    accessToken,
    signal,
  })
}

export function fetchAdminBudget({ accessToken = null, signal } = {}) {
  return requestBudget('/api/admin/budget', { accessToken, signal })
}

export function updateAdminBudgetSettings(
  settings,
  { accessToken = null, signal } = {},
) {
  return requestBudget('/api/admin/budget/settings', {
    method: 'PUT',
    body: { settings },
    accessToken,
    signal,
  })
}

export function saveAdminEntrance(entrance, { accessToken = null, signal } = {}) {
  return requestBudget('/api/admin/budget/entrances', {
    method: 'POST',
    body: { entrance },
    accessToken,
    signal,
  })
}

export function deleteAdminEntrance(id, { accessToken = null, signal } = {}) {
  return requestBudget('/api/admin/budget/entrances', {
    method: 'DELETE',
    body: { id },
    accessToken,
    signal,
  })
}
