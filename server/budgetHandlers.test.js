import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequestHandler } from './handlers.js'
import { AppError, ERROR_CODES } from './errors.js'

// Pruebas de las rutas de presupuesto con un servicio simulado. No se llama a
// Supabase, OSRM ni a ningún proveedor real.

function createFakeOsmClient() {
  return {
    async search() {
      return { source: 'nominatim', items: [] }
    },
    async details() {
      throw new AppError(ERROR_CODES.PLACE_NOT_FOUND, { status: 404 })
    },
    async locate() {
      return {
        name: 'San Salvador',
        displayName: 'San Salvador, El Salvador',
        latitude: 13.69,
        longitude: -89.19,
      }
    },
  }
}

function createFakeBudgetService(overrides = {}) {
  const calls = {
    calculate: [],
    history: [],
    adminConfig: 0,
    settings: [],
    entrance: [],
    deleted: [],
  }

  const service = {
    publicConfig: () => ({
      enabled: true,
      currency: 'USD',
      storage: 'none',
      adminEnabled: true,
      transportModes: [{ id: 'particular', label: 'Vehículo particular' }],
      mealTiers: [{ id: 'estandar', label: 'Estándar' }],
      lodgingTiers: [{ id: 'estandar', label: 'Estándar' }],
    }),
    async estimateForItinerary() {
      return null
    },
    async calculate(input) {
      calls.calculate.push(input)
      return {
        currency: 'USD',
        totals: {
          minCents: 1000,
          maxCents: 1200,
          perPersonMinCents: 1000,
          perPersonMaxCents: 1200,
          perDayMinCents: 1000,
          perDayMaxCents: 1200,
        },
      }
    },
    async listHistory(input) {
      calls.history.push(input)
      return { estimates: [], currency: 'USD' }
    },
    async getAdminConfig(input) {
      calls.adminConfig += 1
      calls.adminHeaders = input?.headers
      return { settings: {}, entrancePrices: [] }
    },
    async updateAdminSettings(input) {
      calls.settings.push(input)
      return { settings: { currency: 'USD' }, entrancePrices: [] }
    },
    async upsertAdminEntrance(input) {
      calls.entrance.push(input)
      return { entrance: { id: 'entrance-1' } }
    },
    async deleteAdminEntrance(input) {
      calls.deleted.push(input)
      return { deleted: true }
    },
    ...overrides,
  }

  return { calls, service }
}

function createHandler({ service = createFakeBudgetService().service, env = {} } = {}) {
  return createRequestHandler({
    env: {
      NOMINATIM_MIN_INTERVAL_MS: '0',
      ...env,
    },
    osmClient: createFakeOsmClient(),
    aiClient: null,
    budgetService: service,
    logError: () => {},
  })
}

function request(overrides = {}) {
  return {
    method: 'POST',
    pathname: '/api/budget/calculate',
    body: {},
    query: {},
    headers: {},
    ip: '203.0.113.10',
    ...overrides,
  }
}

test('/api/budget/calculate calcula en el servidor y respeta persist=false', async () => {
  const fake = createFakeBudgetService()
  const handler = createHandler({ service: fake.service })
  const body = {
    itinerary: {
      title: 'Un día',
      travelers: 2,
      durationDays: 1,
      stops: [{ placeId: 'osm-node-1', name: 'Playa', latitude: 13.49, longitude: -89.38 }],
    },
    options: { travelers: 2, days: 1, transportMode: 'particular' },
    persist: false,
  }

  const response = await handler(request({ body }))

  assert.equal(response.status, 200)
  assert.equal(response.json.totals.minCents, 1000)
  assert.equal(fake.calls.calculate.length, 1)
  assert.deepEqual(fake.calls.calculate[0].input, body)
  assert.equal(fake.calls.calculate[0].persist, false)

  await handler(request({ body: { ...body, persist: true } }))
  assert.equal(fake.calls.calculate[1].persist, true)
})

test('/api/budget/calculate conserva el estado de error seguro', async () => {
  const fake = createFakeBudgetService({
    async calculate() {
      throw new AppError(ERROR_CODES.BUDGET_UNAVAILABLE, { status: 503 })
    },
  })
  const handler = createHandler({ service: fake.service })
  const response = await handler(
    request({
      body: {
        itinerary: {
          stops: [
            { placeId: 'osm-node-1', latitude: 13.49, longitude: -89.38 },
          ],
        },
      },
    }),
  )

  assert.equal(response.status, 503)
  assert.equal(response.json.error.code, ERROR_CODES.BUDGET_UNAVAILABLE)
})

test('/api/budget/history exige GET y transmite el propietario por cabecera', async () => {
  const fake = createFakeBudgetService()
  const handler = createHandler({ service: fake.service })
  const headers = { authorization: 'Bearer token-123' }

  const response = await handler(
    request({
      method: 'GET',
      pathname: '/api/budget/history',
      body: undefined,
      query: { itineraryId: 'itinerary-1', limit: '500' },
      headers,
    }),
  )

  assert.equal(response.status, 200)
  assert.equal(fake.calls.history.length, 1)
  assert.equal(fake.calls.history[0].itineraryId, 'itinerary-1')
  assert.equal(fake.calls.history[0].limit, 50)
  assert.equal(fake.calls.history[0].headers, headers)

  const wrongMethod = await handler(
    request({ method: 'POST', pathname: '/api/budget/history' }),
  )
  assert.equal(wrongMethod.status, 405)
  assert.equal(wrongMethod.json.error.code, ERROR_CODES.METHOD_NOT_ALLOWED)
})

test('las rutas administrativas delegan el control de acceso al servicio', async () => {
  const fake = createFakeBudgetService()
  const handler = createHandler({ service: fake.service })
  const headers = { authorization: 'Bearer admin-token' }

  const config = await handler(
    request({ method: 'GET', pathname: '/api/admin/budget', body: undefined, headers }),
  )
  assert.equal(config.status, 200)
  assert.equal(fake.calls.adminConfig, 1)
  assert.equal(fake.calls.adminHeaders, headers)

  const settings = await handler(
    request({
      method: 'PUT',
      pathname: '/api/admin/budget/settings',
      body: { settings: { fuelPricePerLiterCents: 125 } },
      headers,
    }),
  )
  assert.equal(settings.status, 200)
  assert.deepEqual(fake.calls.settings[0].body, {
    settings: { fuelPricePerLiterCents: 125 },
  })

  const created = await handler(
    request({
      method: 'POST',
      pathname: '/api/admin/budget/entrances',
      body: { entrance: { name: 'Parque' } },
      headers,
    }),
  )
  assert.equal(created.status, 200)
  assert.deepEqual(fake.calls.entrance[0].body, {
    entrance: { name: 'Parque' },
  })

  const deleted = await handler(
    request({
      method: 'DELETE',
      pathname: '/api/admin/budget/entrances',
      body: { id: 'entrance-1' },
      headers,
    }),
  )
  assert.equal(deleted.status, 200)
  assert.deepEqual(fake.calls.deleted[0].body, { id: 'entrance-1' })
  assert.equal(fake.calls.entrance.length, 1)
})

test('las rutas administrativas respetan el error de autorización del servicio', async () => {
  const fake = createFakeBudgetService({
    async getAdminConfig() {
      throw new AppError(ERROR_CODES.ADMIN_FORBIDDEN, { status: 403 })
    },
  })
  const handler = createHandler({ service: fake.service })
  const response = await handler(
    request({ method: 'GET', pathname: '/api/admin/budget', body: undefined }),
  )

  assert.equal(response.status, 403)
  assert.equal(response.json.error.code, ERROR_CODES.ADMIN_FORBIDDEN)
})

test('/api/config publica la configuración de presupuesto sin tarifas privadas', async () => {
  const fake = createFakeBudgetService()
  const handler = createHandler({ service: fake.service })
  const response = await handler(
    request({ method: 'GET', pathname: '/api/config', body: undefined }),
  )

  assert.equal(response.status, 200)
  assert.equal(response.json.budget.enabled, true)
  assert.equal(response.json.budget.adminEnabled, true)
  assert.equal(response.json.budget.storage, 'none')
})
