import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequestHandler } from './handlers.js'
import { createBillingService } from './billing/billingService.js'
import { AppError, ERROR_CODES } from './errors.js'

const TEST_SECRET = 'secreto-de-pruebas-suficientemente-largo'
const TEST_AI_KEY = 'clave-de-ia-solo-para-pruebas'
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function finalStep(payload) {
  return { content: JSON.stringify(payload), toolCalls: [] }
}

function createFakeAi(steps, { onCall } = {}) {
  const calls = []
  let index = 0
  return {
    enabled: true,
    providerName: 'FakeAI',
    model: 'fake-1',
    calls,
    async createChatCompletion(input) {
      calls.push(input)
      onCall?.(calls.length, input)
      const step = steps[Math.min(index, steps.length - 1)]
      index += 1
      if (step instanceof Error) throw step
      return typeof step === 'function' ? await step(input) : step
    },
  }
}

function createFakeOsmClient() {
  return {
    async search() {
      return { source: 'nominatim', items: [] }
    },
    async details() {
      throw new AppError(ERROR_CODES.PLACE_NOT_FOUND, { status: 404 })
    },
    async locate() {
      throw new AppError(ERROR_CODES.LOCATION_NOT_FOUND, { status: 404 })
    },
  }
}

function makeBilling(overrides = {}) {
  const calls = {
    resolveContext: [],
    reserveChat: [],
    commitChat: [],
    releaseChat: [],
    getStatus: [],
  }

  const billing = {
    enabled: true,
    paymentsEnabled: false,
    async resolveContext(input) {
      calls.resolveContext.push(input)
      return { userId: 'user-1', anonymousKey: null, authenticated: true, setCookie: null }
    },
    async reserveChat(input) {
      calls.reserveChat.push(input)
      return {
        allowed: true,
        reason: null,
        usage: {
          used: 1,
          limit: 10,
          remaining: 9,
          periodStart: '2026-10-01T00:00:00.000Z',
          periodEnd: '2026-11-01T00:00:00.000Z',
        },
        plan: { id: 'explorador', name: 'Explorador' },
        setCookie: null,
      }
    },
    async commitChat(requestId) {
      calls.commitChat.push(requestId)
      return true
    },
    async releaseChat(requestId) {
      calls.releaseChat.push(requestId)
      return true
    },
    async getStatus(input) {
      calls.getStatus.push(input)
      return {
        status: {
          enabled: true,
          billingEnabled: true,
          paymentsEnabled: false,
          authenticated: true,
          plan: { id: 'explorador', name: 'Explorador' },
          usage: { used: 1, limit: 10, remaining: 9 },
          savedItineraries: 0,
          canSaveItineraries: true,
          subscription: null,
          pass: null,
        },
        setCookie: null,
      }
    },
    calls,
    ...overrides,
  }

  return billing
}

function makeHandler({ billingService, aiClient, env = {}, logError = () => {} } = {}) {
  return createRequestHandler({
    env: {
      NOMINATIM_MIN_INTERVAL_MS: '0',
      AI_API_KEY: TEST_AI_KEY,
      CHAT_SIGNING_SECRET: TEST_SECRET,
      ...env,
    },
    osmClient: createFakeOsmClient(),
    aiClient:
      aiClient ??
      createFakeAi([finalStep({ message: 'Hola, plan listo.', recommendedPlaceIds: [] })]),
    billingService: billingService ?? makeBilling(),
    logError,
  })
}

function chatRequest(body = {}, extras = {}) {
  return {
    method: 'POST',
    pathname: '/api/chat',
    body: { message: 'Hola', requestId: REQUEST_ID, ...body },
    query: {},
    headers: {},
    ip: '203.0.113.55',
    ...extras,
  }
}

test('una consulta con cupo reserva, responde con consumo y confirma el evento', async () => {
  const billing = makeBilling()
  const ai = createFakeAi([finalStep({ message: 'Hola, plan listo.', recommendedPlaceIds: [] })])
  const handler = makeHandler({ billingService: billing, aiClient: ai })

  const response = await handler(chatRequest())

  assert.equal(response.status, 200)
  assert.equal(response.json.usage.used, 1)
  assert.equal(response.json.plan.id, 'explorador')
  assert.equal(response.json.requestId, REQUEST_ID)
  assert.equal(billing.calls.reserveChat.length, 1)
  assert.equal(billing.calls.reserveChat[0].requestId, REQUEST_ID)
  assert.equal(billing.calls.commitChat[0], REQUEST_ID)
  assert.equal(billing.calls.releaseChat.length, 0)
  assert.equal(ai.calls.length, 1)
})

test('el límite se aplica antes de llamar a la IA y ofrece ver planes', async () => {
  const billing = makeBilling({
    async reserveChat(input) {
      billing.calls.reserveChat.push(input)
      return {
        allowed: false,
        reason: 'limit',
        usage: {
          used: 10,
          limit: 10,
          remaining: 0,
          periodEnd: '2026-11-01T00:00:00.000Z',
        },
        plan: { id: 'explorador', name: 'Explorador' },
        setCookie: null,
      }
    },
  })
  const ai = createFakeAi([finalStep({ message: 'no debería usarse', recommendedPlaceIds: [] })])
  const handler = makeHandler({ billingService: billing, aiClient: ai })

  const response = await handler(chatRequest())

  assert.equal(response.status, 429)
  assert.equal(response.json.error.code, ERROR_CODES.AI_QUOTA_EXCEEDED)
  assert.equal(response.json.error.details.remaining, 0)
  assert.equal(response.json.error.details.upgradeUrl, '/planes')
  assert.equal(ai.calls.length, 0)
  assert.equal(billing.calls.commitChat.length, 0)
  assert.equal(billing.calls.releaseChat.length, 0)
})

test('un fallo de la IA libera la reserva para no gastar la consulta', async () => {
  const billing = makeBilling()
  const ai = createFakeAi([
    new AppError(ERROR_CODES.AI_UNAVAILABLE, { status: 502 }),
  ])
  const handler = makeHandler({ billingService: billing, aiClient: ai })

  const response = await handler(chatRequest())

  assert.equal(response.status, 502)
  assert.equal(response.json.error.code, ERROR_CODES.AI_UNAVAILABLE)
  assert.equal(billing.calls.commitChat.length, 0)
  assert.equal(billing.calls.releaseChat[0], REQUEST_ID)
})

test('un requestId ya consumido no vuelve a llamar a la IA', async () => {
  const billing = makeBilling({
    async reserveChat(input) {
      billing.calls.reserveChat.push(input)
      return { allowed: false, reason: 'replayed', usage: null, plan: null, setCookie: null }
    },
  })
  const ai = createFakeAi([finalStep({ message: 'no debería usarse', recommendedPlaceIds: [] })])
  const handler = makeHandler({ billingService: billing, aiClient: ai })

  const response = await handler(chatRequest())

  assert.equal(response.status, 409)
  assert.equal(response.json.error.code, ERROR_CODES.AI_REQUEST_REPLAYED)
  assert.equal(ai.calls.length, 0)
})

test('el requestId inválido se rechaza antes de reservar', async () => {
  const billing = makeBilling()
  const handler = makeHandler({ billingService: billing })

  const response = await handler(chatRequest({ requestId: 'no-es-un-uuid' }))

  assert.equal(response.status, 400)
  assert.equal(response.json.error.code, ERROR_CODES.INVALID_REQUEST)
  assert.equal(billing.calls.reserveChat.length, 0)
})

test('sin IA configurada no se crea identidad ni reserva de cupo', async () => {
  const billing = makeBilling()
  const handler = makeHandler({
    billingService: billing,
    aiClient: { enabled: false },
  })

  const response = await handler(chatRequest())

  assert.equal(response.status, 503)
  assert.equal(response.json.error.code, ERROR_CODES.AI_NOT_CONFIGURED)
  assert.equal(billing.calls.resolveContext.length, 0)
  assert.equal(billing.calls.reserveChat.length, 0)
})

test('/api/billing/status devuelve el estado y la cookie de visitante', async () => {
  const billing = makeBilling({
    async getStatus(input) {
      billing.calls.getStatus.push(input)
      return {
        status: {
          enabled: true,
          billingEnabled: true,
          paymentsEnabled: false,
          authenticated: false,
          plan: { id: 'explorador', name: 'Explorador' },
          usage: { used: 0, limit: 10, remaining: 10 },
          savedItineraries: 0,
          canSaveItineraries: false,
          subscription: null,
          pass: null,
        },
        setCookie: 'experiencia_sv_anon=prueba; Path=/; HttpOnly',
      }
    },
  })
  const handler = makeHandler({ billingService: billing })

  const response = await handler({
    method: 'GET',
    pathname: '/api/billing/status',
    body: {},
    query: {},
    headers: { cookie: 'otra=1' },
    ip: '203.0.113.56',
  })

  assert.equal(response.status, 200)
  assert.equal(response.json.plan.id, 'explorador')
  assert.equal(response.headers['Set-Cookie'], 'experiencia_sv_anon=prueba; Path=/; HttpOnly')
  assert.equal(billing.calls.getStatus.length, 1)
})

test('el checkout sin pasarela no crea pagos ni activa beneficios', async () => {
  const billing = makeBilling()
  const handler = makeHandler({ billingService: billing })

  const paid = await handler({
    method: 'POST',
    pathname: '/api/billing/checkout',
    body: { planId: 'pro' },
    query: {},
    headers: {},
    ip: '203.0.113.57',
  })
  assert.equal(paid.status, 503)
  assert.equal(paid.json.error.code, ERROR_CODES.PAYMENTS_NOT_CONFIGURED)

  const free = await handler({
    method: 'POST',
    pathname: '/api/billing/checkout',
    body: { planId: 'explorador' },
    query: {},
    headers: {},
    ip: '203.0.113.57',
  })
  assert.equal(free.status, 400)
  assert.equal(free.json.error.code, ERROR_CODES.INVALID_REQUEST)
  assert.equal(billing.calls.commitChat.length, 0)
})

test('/api/config informa los planes sin secretos', async () => {
  const handler = makeHandler({ billingService: makeBilling({ enabled: true }) })
  const response = await handler({
    method: 'GET',
    pathname: '/api/config',
    body: {},
    query: {},
    headers: {},
    ip: '203.0.113.58',
  })

  assert.equal(response.status, 200)
  assert.equal(response.json.billing.enabled, true)
  assert.equal(response.json.billing.paymentsEnabled, false)
  assert.equal(response.json.billing.plansUrl, '/planes')
  const serialized = JSON.stringify(response.json)
  assert.equal(serialized.includes(TEST_AI_KEY), false)
  assert.equal(serialized.includes(TEST_SECRET), false)
})

test('el modo demostración omite la reserva y no devuelve consumo de plan', async () => {
  const billing = makeBilling()
  const ai = createFakeAi([
    finalStep({ message: 'Todo listo para la feria.', recommendedPlaceIds: [] }),
  ])
  const handler = makeHandler({
    billingService: billing,
    aiClient: ai,
    env: { VITE_DEMO_MODE: 'true' },
  })

  const response = await handler(chatRequest())

  assert.equal(response.status, 200)
  assert.equal(response.json.message, 'Todo listo para la feria.')
  assert.equal('usage' in response.json, false)
  assert.equal('plan' in response.json, false)
  assert.equal(ai.calls.length, 1)
  assert.equal(billing.calls.resolveContext.length, 0)
  assert.equal(billing.calls.reserveChat.length, 0)
  assert.equal(billing.calls.commitChat.length, 0)
  assert.equal(billing.calls.releaseChat.length, 0)
})

test('el alias de runtime DEMO_MODE también desactiva la validación de plan', async () => {
  const billing = makeBilling({
    async resolveContext() {
      throw new AppError(ERROR_CODES.BILLING_UNAVAILABLE, { status: 503 })
    },
    async reserveChat() {
      throw new AppError(ERROR_CODES.BILLING_UNAVAILABLE, { status: 503 })
    },
  })
  const ai = createFakeAi([
    finalStep({ message: 'Modo feria activo.', recommendedPlaceIds: [] }),
  ])
  const handler = makeHandler({
    billingService: billing,
    aiClient: ai,
    env: { DEMO_MODE: 'true' },
  })

  const response = await handler(chatRequest())

  assert.equal(response.status, 200)
  assert.equal(response.json.message, 'Modo feria activo.')
  assert.equal(billing.calls.resolveContext.length, 0)
  assert.equal(billing.calls.reserveChat.length, 0)

  const config = await handler({
    method: 'GET',
    pathname: '/api/config',
    body: {},
    query: {},
    headers: {},
    ip: '203.0.113.57',
  })
  assert.equal(config.json.demo.enabled, true)
  assert.equal(config.json.billing.demoMode, true)
})

test('con DEMO_MODE=true una sesión expirada no bloquea el chat', async () => {
  const billing = makeBilling({
    async resolveContext() {
      throw new AppError(ERROR_CODES.SESSION_EXPIRED, { status: 401 })
    },
  })
  const ai = createFakeAi([
    finalStep({ message: 'La feria sigue disponible.', recommendedPlaceIds: [] }),
  ])
  const handler = makeHandler({
    billingService: billing,
    aiClient: ai,
    env: { DEMO_MODE: 'true' },
  })

  const response = await handler(
    chatRequest({}, { headers: { authorization: 'Bearer token-vencido' } }),
  )

  assert.equal(response.status, 200)
  assert.equal(response.json.message, 'La feria sigue disponible.')
  assert.equal(billing.calls.resolveContext.length, 0)
  assert.equal(billing.calls.reserveChat.length, 0)
})

test('/api/billing/status y /api/config exponen el modo demostración sin cuotas', async () => {
  const billing = createBillingService({ env: { VITE_DEMO_MODE: 'true' } })
  const handler = makeHandler({
    billingService: billing,
    env: { VITE_DEMO_MODE: 'true' },
  })

  const status = await handler({
    method: 'GET',
    pathname: '/api/billing/status',
    body: {},
    query: {},
    headers: {},
    ip: '203.0.113.59',
  })
  assert.equal(status.status, 200)
  assert.equal(status.json.demoMode, true)
  assert.equal(status.json.billingEnabled, false)
  assert.equal(status.json.usage, null)
  assert.equal(status.json.canSaveItineraries, true)

  const config = await handler({
    method: 'GET',
    pathname: '/api/config',
    body: {},
    query: {},
    headers: {},
    ip: '203.0.113.59',
  })
  assert.equal(config.status, 200)
  assert.equal(config.json.demo.enabled, true)
  assert.equal(config.json.billing.enabled, false)
  assert.equal(config.json.billing.paymentsEnabled, false)
  assert.equal(config.json.billing.demoMode, true)
})

test('el checkout en demostración no crea pagos ni activa planes', async () => {
  const billing = makeBilling()
  const handler = makeHandler({
    billingService: billing,
    env: { VITE_DEMO_MODE: 'true' },
  })

  const response = await handler({
    method: 'POST',
    pathname: '/api/billing/checkout',
    body: { planId: 'pro' },
    query: {},
    headers: {},
    ip: '203.0.113.60',
  })

  assert.equal(response.status, 503)
  assert.equal(response.json.error.code, ERROR_CODES.PAYMENTS_NOT_CONFIGURED)
  assert.match(response.json.error.message, /demostración/i)
  assert.equal(billing.calls.commitChat.length, 0)
})
