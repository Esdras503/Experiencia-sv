import { getPlan } from '../../shared/plans.js'
import { ApiError } from './placesService.js'

const NETWORK_ERROR_MESSAGE =
  'No pudimos consultar tu plan. Revisa tu conexión e intenta de nuevo.'

async function requestPlan(path, { method = 'GET', body, accessToken, signal } = {}) {
  let response
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

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

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(
      data?.error?.code ?? 'INTERNAL',
      data?.error?.message ?? 'No pudimos consultar tu plan.',
      response.status,
      data?.error?.details ?? null,
    )
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ApiError('BILLING_BAD_RESPONSE', 'La respuesta de planes no es válida.')
  }

  return data
}

export function defaultPlanStatus() {
  return {
    enabled: false,
    billingEnabled: false,
    paymentsEnabled: false,
    authenticated: false,
    plan: getPlan('explorador'),
    period: null,
    usage: null,
    savedItineraries: null,
    canSaveItineraries: true,
    subscription: null,
    pass: null,
  }
}

export function normalizePlanStatus(data) {
  if (!data || typeof data !== 'object') return defaultPlanStatus()

  const fallback = defaultPlanStatus()
  const plan = data.plan?.id ? getPlan(data.plan.id) ?? fallback.plan : fallback.plan
  const used = Number(data.usage?.used)
  const limit = Number(data.usage?.limit)

  return {
    ...fallback,
    enabled: data.enabled === true,
    billingEnabled: data.billingEnabled === true,
    paymentsEnabled: data.paymentsEnabled === true,
    authenticated: data.authenticated === true,
    plan: {
      ...plan,
      ...(typeof data.plan === 'object' && data.plan ? data.plan : {}),
    },
    period: data.period && typeof data.period === 'object' ? data.period : null,
    usage:
      data.usage && Number.isFinite(used) && Number.isFinite(limit)
        ? {
            used,
            limit,
            remaining: Number.isFinite(Number(data.usage.remaining))
              ? Number(data.usage.remaining)
              : Math.max(limit - used, 0),
            periodStart: data.usage.periodStart ?? null,
            periodEnd: data.usage.periodEnd ?? null,
          }
        : null,
    savedItineraries: Number.isFinite(Number(data.savedItineraries))
      ? Number(data.savedItineraries)
      : null,
    canSaveItineraries: data.canSaveItineraries !== false,
    subscription: data.subscription ?? null,
    pass: data.pass ?? null,
  }
}

export async function fetchPlanStatus({ accessToken = null, signal } = {}) {
  const data = await requestPlan('/api/billing/status', { accessToken, signal })
  return normalizePlanStatus(data)
}

export async function requestPlanCheckout({ planId, accessToken = null, signal } = {}) {
  if (typeof planId !== 'string' || !planId.trim()) {
    throw new ApiError('INVALID_REQUEST', 'Elige un plan para continuar.')
  }

  return requestPlan('/api/billing/checkout', {
    method: 'POST',
    body: { planId: planId.trim() },
    accessToken,
    signal,
  })
}
