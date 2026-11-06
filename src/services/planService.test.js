import test from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultPlanStatus,
  fetchPlanStatus,
  normalizePlanStatus,
  requestPlanCheckout,
} from './planService.js'

async function withFetch(fakeFetch, run) {
  const original = globalThis.fetch
  globalThis.fetch = fakeFetch
  try {
    return await run()
  } finally {
    globalThis.fetch = original
  }
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

test('normaliza el estado de un plan de pago y su consumo', () => {
  const status = normalizePlanStatus({
    enabled: true,
    billingEnabled: true,
    paymentsEnabled: false,
    authenticated: true,
    plan: { id: 'pro', name: 'Experiencia Pro', aiQueryLimit: 200 },
    period: { start: '2026-10-01T00:00:00.000Z', end: '2026-11-01T00:00:00.000Z' },
    usage: { used: 42, limit: 200, remaining: 158 },
    savedItineraries: 3,
    canSaveItineraries: true,
    subscription: { planId: 'pro', status: 'active' },
    pass: null,
  })

  assert.equal(status.plan.id, 'pro')
  assert.equal(status.plan.price, '$7.99')
  assert.equal(status.plan.features.length > 0, true)
  assert.equal(status.usage.used, 42)
  assert.equal(status.usage.remaining, 158)
  assert.equal(status.savedItineraries, 3)
  assert.equal(status.authenticated, true)
  assert.equal(status.subscription.planId, 'pro')
})

test('sin datos válidos devuelve Explorador sin inventar consumo', () => {
  const fallback = defaultPlanStatus()
  assert.equal(fallback.plan.id, 'explorador')
  assert.equal(fallback.usage, null)
  assert.equal(fallback.paymentsEnabled, false)
  assert.equal(normalizePlanStatus(null).plan.id, 'explorador')
  assert.equal(
    normalizePlanStatus({ usage: { used: 'no', limit: 10 } }).usage,
    null,
  )
})

test('normaliza el modo demostración sin cuotas ni límites de itinerarios', () => {
  const status = normalizePlanStatus({
    enabled: true,
    billingEnabled: false,
    paymentsEnabled: false,
    demoMode: true,
    plan: { id: 'explorador', name: 'Explorador' },
    usage: null,
    savedItineraries: null,
    canSaveItineraries: true,
  })

  assert.equal(status.demoMode, true)
  assert.equal(status.billingEnabled, false)
  assert.equal(status.usage, null)
  assert.equal(status.canSaveItineraries, true)
  assert.equal(normalizePlanStatus({ demoMode: false }).demoMode, false)
})

test('fetchPlanStatus envía el token de sesión y no lo pone en la URL', async () => {
  const calls = []

  await withFetch(
    async (url, options) => {
      calls.push({ url, options })
      return jsonResponse(200, {
        enabled: true,
        plan: { id: 'explorador', name: 'Explorador' },
        usage: { used: 2, limit: 10, remaining: 8 },
        savedItineraries: 1,
        canSaveItineraries: true,
      })
    },
    async () => {
      const status = await fetchPlanStatus({ accessToken: 'token-de-prueba' })
      assert.equal(status.usage.used, 2)
    },
  )

  assert.equal(calls[0].url, '/api/billing/status')
  assert.equal(calls[0].options.method, 'GET')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token-de-prueba')
  assert.equal(calls[0].url.includes('token'), false)
})

test('el checkout envía solo el plan y conserva los errores del backend', async () => {
  const calls = []

  await withFetch(
    async (url, options) => {
      calls.push({ url, options })
      return jsonResponse(503, {
        error: {
          code: 'PAYMENTS_NOT_CONFIGURED',
          message: 'El pago aún no está habilitado.',
          details: { charged: false },
        },
      })
    },
    async () => {
      await assert.rejects(
        () => requestPlanCheckout({ planId: 'pro', accessToken: 'token' }),
        (error) => {
          assert.equal(error.code, 'PAYMENTS_NOT_CONFIGURED')
          assert.equal(error.details.charged, false)
          assert.equal(error.status, 503)
          return true
        },
      )
    },
  )

  assert.equal(calls[0].url, '/api/billing/checkout')
  assert.equal(calls[0].options.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].options.body), { planId: 'pro' })
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token')
})
