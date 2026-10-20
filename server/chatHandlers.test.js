import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequestHandler } from './handlers.js'
import { AppError, ERROR_CODES } from './errors.js'
import { resolveItinerarySigningSecret } from './chatItinerary.js'

// Pruebas del endpoint /api/chat con un cliente de IA y un cliente de OSM
// simulados. No se contacta ningún proveedor real ni se usa una clave real.

const TEST_SECRET = 'secreto-de-prueba-suficientemente-largo'
const TEST_AI_KEY = 'clave-de-ia-solo-para-pruebas'

function rawBeach(overrides = {}) {
  return {
    osmType: 'node',
    osmId: 123,
    name: 'Playa El Tunco',
    displayName: 'Playa El Tunco, La Libertad, El Salvador',
    latitude: 13.493,
    longitude: -89.383,
    tags: {},
    nominatimClass: 'natural',
    nominatimType: 'beach',
    ...overrides,
  }
}

function createFakeOsmClient({ searchResult } = {}) {
  const calls = { search: [], details: [], locate: [] }

  return {
    calls,
    client: {
      async search(input) {
        calls.search.push(input)
        if (searchResult instanceof Error) throw searchResult
        return searchResult ?? { source: 'nominatim', items: [] }
      },
      async details(placeId) {
        calls.details.push(placeId)
        throw new AppError(ERROR_CODES.PLACE_NOT_FOUND, { status: 404 })
      },
      async locate(query) {
        calls.locate.push(query)
        return {
          name: 'San Salvador',
          displayName: 'San Salvador, El Salvador',
          latitude: 13.69,
          longitude: -89.19,
        }
      },
    },
  }
}

function finalStep(payload) {
  return { content: JSON.stringify(payload), toolCalls: [] }
}

function toolStep(toolCalls) {
  return { content: null, toolCalls }
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
      return typeof step === 'function' ? await step(input) : step
    },
  }
}

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function makeHandler({ fake = {}, env = {}, aiClient, logError = () => {} } = {}) {
  const { client, calls } = createFakeOsmClient(fake)
  const handler = createRequestHandler({
    env: {
      NOMINATIM_MIN_INTERVAL_MS: '0',
      CHAT_SIGNING_SECRET: TEST_SECRET,
      ...env,
    },
    osmClient: client,
    aiClient,
    logError,
  })
  return { handler, calls }
}

function chatRequest(body, extras = {}) {
  return {
    method: 'POST',
    pathname: '/api/chat',
    body,
    query: {},
    headers: {},
    ip: '203.0.113.10',
    ...extras,
  }
}

test('/api/config no expone la clave de IA e indica si el chat está activo', async () => {
  const withoutAi = makeHandler({})
  const disabled = await withoutAi.handler({
    method: 'GET',
    pathname: '/api/config',
    body: {},
    query: {},
    headers: {},
    ip: 'ip',
  })

  assert.equal(disabled.json.chat.enabled, false)
  assert.equal(disabled.json.chat.provider, null)

  const withAi = makeHandler({
    env: { AI_API_KEY: TEST_AI_KEY },
    aiClient: createFakeAi([finalStep({ message: 'x', recommendedPlaceIds: [] })]),
  })
  const enabled = await withAi.handler({
    method: 'GET',
    pathname: '/api/config',
    body: {},
    query: {},
    headers: {},
    ip: 'ip',
  })

  assert.equal(enabled.json.chat.enabled, true)
  assert.equal(enabled.json.chat.provider, 'FakeAI')
  assert.equal(enabled.json.chat.model, 'fake-1')
  const serialized = JSON.stringify(enabled.json)
  assert.ok(!serialized.includes(TEST_AI_KEY), 'la clave no debe salir en /api/config')
})

test('/api/chat responde 503 y código AI_NOT_CONFIGURED sin clave', async () => {
  const { handler } = makeHandler({})

  const response = await handler(chatRequest({ message: 'Hola' }))

  assert.equal(response.status, 503)
  assert.equal(response.json.error.code, ERROR_CODES.AI_NOT_CONFIGURED)
  assert.ok(!JSON.stringify(response.json).includes(TEST_AI_KEY))
})

test('el chat valida mensajes vacíos y demasiado largos', async () => {
  const { handler } = makeHandler({
    env: { AI_API_KEY: TEST_AI_KEY },
    aiClient: createFakeAi([finalStep({ message: 'x', recommendedPlaceIds: [] })]),
  })

  const empty = await handler(chatRequest({ message: '   ' }))
  assert.equal(empty.status, 400)
  assert.equal(empty.json.error.code, ERROR_CODES.INVALID_REQUEST)

  const long = await handler(chatRequest({ message: 'a'.repeat(5000) }))
  assert.equal(long.status, 400)
  assert.equal(long.json.error.code, ERROR_CODES.INVALID_REQUEST)
})

test('las recomendaciones y el itinerario usan lugares reales de la búsqueda', async () => {
  const { handler, calls } = makeHandler({
    fake: { searchResult: { source: 'nominatim', items: [rawBeach()] } },
    env: { AI_API_KEY: TEST_AI_KEY, CHAT_RATE_LIMIT_PER_MINUTE: '50' },
    aiClient: createFakeAi([
      toolStep([
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'search_places', arguments: '{"query":"El Tunco"}' },
        },
      ]),
      finalStep({
        message: 'Encontré Playa El Tunco en OpenStreetMap.',
        recommendedPlaceIds: ['osm-node-123'],
        suggestions: ['¿Quieres más playas?'],
        itinerary: {
          title: 'Tarde en El Tunco',
          summary: 'Una parada verificada.',
          date: null,
          travelers: 2,
          budget: { amount: 40, currency: 'USD', scope: 'total' },
          origin: { label: 'San Salvador', latitude: 13.69, longitude: -89.19 },
          stops: [
            { placeId: 'osm-node-123', reason: 'Playa buscada por el usuario', visitMinutes: 120 },
          ],
          warnings: [],
        },
      }),
    ]),
  })

  const response = await handler(chatRequest({ message: 'Recomiéndame El Tunco' }))

  assert.equal(response.status, 200)
  assert.equal(calls.search.length, 1)
  assert.equal(response.json.places.length, 1)
  assert.equal(response.json.places[0].id, 'osm-node-123')
  assert.equal(response.json.places[0].rating, undefined)
  assert.equal(response.json.itinerary.stops.length, 1)
  assert.equal(response.json.itinerary.stops[0].visitEstimate, true)
  assert.ok(response.json.itinerary.stops[0].distanceFromOriginMeters > 0)
  assert.equal(typeof response.json.itineraryToken, 'string')

  // El token lo firma el servidor con el secreto configurado.
  assert.equal(
    resolveItinerarySigningSecret({ CHAT_SIGNING_SECRET: TEST_SECRET }, TEST_AI_KEY),
    TEST_SECRET,
  )
})

test('el límite de solicitudes del chat se aplica en el servidor', async () => {
  const aiClient = createFakeAi([
    finalStep({ message: 'Hola.', recommendedPlaceIds: [], suggestions: [], itinerary: null }),
  ])
  const { handler } = makeHandler({
    env: { AI_API_KEY: TEST_AI_KEY, CHAT_RATE_LIMIT_PER_MINUTE: '1' },
    aiClient,
  })

  const first = await handler(chatRequest({ message: 'Hola' }))
  assert.equal(first.status, 200)

  const second = await handler(chatRequest({ message: 'Otra vez' }))
  assert.equal(second.status, 429)
  assert.equal(second.json.error.code, ERROR_CODES.RATE_LIMITED)
})

test('rechaza solicitudes concurrentes por encima del máximo configurado', async () => {
  const started = createDeferred()
  const release = createDeferred()
  const aiClient = createFakeAi([
    async () => {
      started.resolve()
      await release.promise
      return finalStep({
        message: 'Listo.',
        recommendedPlaceIds: [],
        suggestions: [],
        itinerary: null,
      })
    },
  ])
  const { handler } = makeHandler({
    env: { AI_API_KEY: TEST_AI_KEY, CHAT_MAX_CONCURRENT: '1' },
    aiClient,
  })

  const firstRequest = handler(chatRequest({ message: 'Primera' }))
  await started.promise

  const second = await handler(chatRequest({ message: 'Segunda' }))
  assert.equal(second.status, 429)
  assert.equal(second.json.error.code, ERROR_CODES.CHAT_BUSY)

  release.resolve()
  const first = await firstRequest
  assert.equal(first.status, 200)
})

test('respeta ALLOWED_ORIGIN en el chat', async () => {
  const { handler } = makeHandler({
    env: { AI_API_KEY: TEST_AI_KEY, ALLOWED_ORIGIN: 'https://app.example.org' },
    aiClient: createFakeAi([
      finalStep({ message: 'Hola.', recommendedPlaceIds: [], suggestions: [], itinerary: null }),
    ]),
  })

  const rejected = await handler(
    chatRequest({ message: 'Hola' }, { headers: { origin: 'https://evil.example.org' } }),
  )
  assert.equal(rejected.status, 403)
  assert.equal(rejected.json.error.code, ERROR_CODES.FORBIDDEN)

  const accepted = await handler(
    chatRequest({ message: 'Hola' }, { headers: { origin: 'https://app.example.org' } }),
  )
  assert.equal(accepted.status, 200)
})

test('un token de itinerario manipulado no se usa como contexto', async () => {
  const { handler } = makeHandler({
    env: { AI_API_KEY: TEST_AI_KEY },
    aiClient: createFakeAi([
      finalStep({ message: 'Sigo sin itinerario.', recommendedPlaceIds: [], suggestions: [], itinerary: null }),
    ]),
  })

  const response = await handler(
    chatRequest({
      message: 'Modifica el plan',
      itineraryToken: 'cGF5bG9hZA.firma-falsa',
    }),
  )

  assert.equal(response.status, 200)
  assert.equal(response.json.itinerary, null)
})
