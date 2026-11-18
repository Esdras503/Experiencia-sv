import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateBudget,
  deleteAdminEntrance,
  fetchAdminBudget,
  fetchBudgetHistory,
  saveAdminEntrance,
  updateAdminBudgetSettings,
} from './budgetService.js'

// fetch simulado: valida el contrato del cliente sin llamar al API real.

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

test('calculateBudget envía el itinerario, las opciones y no confía en precios del cliente', async () => {
  const calls = []

  const payload = await withFetch(
    async (url, options) => {
      calls.push({ url, options })
      return jsonResponse(200, {
        currency: 'USD',
        totals: { minCents: 1000, maxCents: 1200 },
        persistence: { saved: false },
      })
    },
    () =>
      calculateBudget({
        itinerary: {
          title: 'Prueba',
          stops: [{ placeId: 'osm-node-1', latitude: 13.49, longitude: -89.38 }],
          budget: { amount: 80, currency: 'USD', scope: 'total' },
        },
        options: {
          travelers: '2',
          children: '1',
          days: '2',
          nights: '1',
          transportMode: 'publico',
          mealTier: 'economico',
          lodgingTier: 'premium',
          includeLodging: true,
          fuelPrice: 0.01,
        },
        itineraryId: 'itinerary-1',
        accessToken: 'token-123',
        persist: false,
      }),
  )

  assert.equal(payload.totals.minCents, 1000)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api/budget/calculate')
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token-123')
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json')

  const body = JSON.parse(calls[0].options.body)
  assert.equal(body.itineraryId, 'itinerary-1')
  assert.equal(body.persist, false)
  assert.deepEqual(body.options, {
    travelers: 2,
    children: 1,
    days: 2,
    nights: 1,
    transportMode: 'publico',
    mealTier: 'economico',
    lodgingTier: 'premium',
    includeLodging: true,
  })
  assert.equal('fuelPrice' in body.options, false)
})

test('fetchBudgetHistory codifica el itinerario y el límite', async () => {
  let requestedUrl = ''

  await withFetch(
    async (url) => {
      requestedUrl = url
      return jsonResponse(200, { estimates: [], currency: 'USD' })
    },
    () =>
      fetchBudgetHistory({
        itineraryId: 'itinerary/1',
        limit: 5,
        accessToken: 'token-123',
      }),
  )

  assert.equal(
    requestedUrl,
    '/api/budget/history?itineraryId=itinerary%2F1&limit=5',
  )
})

test('las funciones administrativas usan los métodos y cuerpos correctos', async () => {
  const calls = []

  await withFetch(
    async (url, options) => {
      calls.push({ url, options })
      return jsonResponse(200, { ok: true })
    },
    async () => {
      await fetchAdminBudget({ accessToken: 'admin-token' })
      await updateAdminBudgetSettings(
        { fuelPricePerLiterCents: 120 },
        { accessToken: 'admin-token' },
      )
      await saveAdminEntrance(
        { name: 'Parque' },
        { accessToken: 'admin-token' },
      )
      await deleteAdminEntrance('entrance-1', { accessToken: 'admin-token' })
    },
  )

  assert.equal(calls[0].url, '/api/admin/budget')
  assert.equal(calls[0].options.method, 'GET')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer admin-token')

  assert.equal(calls[1].url, '/api/admin/budget/settings')
  assert.equal(calls[1].options.method, 'PUT')
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    settings: { fuelPricePerLiterCents: 120 },
  })

  assert.equal(calls[2].url, '/api/admin/budget/entrances')
  assert.equal(calls[2].options.method, 'POST')
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    entrance: { name: 'Parque' },
  })

  assert.equal(calls[3].url, '/api/admin/budget/entrances')
  assert.equal(calls[3].options.method, 'DELETE')
  assert.deepEqual(JSON.parse(calls[3].options.body), { id: 'entrance-1' })
})

test('un error del API conserva el código, el mensaje y los detalles', async () => {
  await withFetch(
    async () =>
      jsonResponse(403, {
        error: {
          code: 'ADMIN_FORBIDDEN',
          message: 'No tienes permiso.',
          details: { field: 'admin' },
        },
      }),
    async () => {
      await assert.rejects(
        () => fetchAdminBudget({ accessToken: 'token' }),
        (error) =>
          error.code === 'ADMIN_FORBIDDEN' &&
          error.status === 403 &&
          error.message === 'No tienes permiso.' &&
          error.details.field === 'admin',
      )
    },
  )
})

test('un 5xx sin JSON se trata como error de red', async () => {
  await withFetch(
    async () => new Response('no-json', { status: 503 }),
    async () => {
      await assert.rejects(
        () => fetchBudgetHistory(),
        (error) => error.code === 'NETWORK_ERROR' && error.status === 503,
      )
    },
  )
})

test('la cancelación conserva el AbortError original', async () => {
  await withFetch(
    async () => {
      const error = new Error('cancelado')
      error.name = 'AbortError'
      throw error
    },
    async () => {
      await assert.rejects(
        () => calculateBudget({ itinerary: { stops: [] } }),
        (error) => error.name === 'AbortError',
      )
    },
  )
})
