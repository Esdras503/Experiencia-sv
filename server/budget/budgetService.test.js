import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_BUDGET_SETTINGS, createDefaultBudgetSettings } from '../../shared/budget.js'
import { createBudgetService } from './budgetService.js'

function settings(overrides = {}) {
  const base = createDefaultBudgetSettings()
  return {
    ...base,
    estimateRangePercent: 0,
    extrasPercent: 0,
    parkingPerDayCents: 0,
    tollsPerDayCents: 0,
    activityAllowancePerPersonPerDayCents: 0,
    unverifiedEntranceMinPerPersonCents: 0,
    unverifiedEntranceMaxPerPersonCents: 0,
    ...overrides,
    mealTiers: {
      ...base.mealTiers,
      ...(overrides.mealTiers ?? {}),
    },
  }
}

function itinerary(overrides = {}) {
  return {
    title: 'Plan de prueba',
    travelers: 1,
    durationDays: 1,
    origin: { label: 'San Salvador', latitude: 13.69, longitude: -89.22 },
    stops: [
      {
        place: {
          id: 'osm-node-1',
          name: 'Playa El Tunco',
          location: { latitude: 13.49, longitude: -89.38 },
        },
      },
    ],
    ...overrides,
  }
}

function fakeRepo(overrides = {}) {
  return {
    enabled: false,
    adminEnabled: false,
    readUser: async () => null,
    requireUser: async () => ({ id: 'user-1' }),
    requireAdmin: async () => ({ id: 'admin-1' }),
    readSettings: async () => null,
    listEntrancePrices: async () => [],
    updateSettings: async (value) => value,
    upsertEntrancePrice: async (value) => value,
    deleteEntrancePrice: async () => true,
    loadOwnedItinerary: async () => null,
    saveEstimate: async () => null,
    listEstimates: async () => [],
    ...overrides,
  }
}

function fakeRoute(route) {
  return {
    enabled: true,
    route: async () => route,
  }
}

test('calcula con valores por defecto cuando no hay almacenamiento', async () => {
  const service = createBudgetService({
    repository: fakeRepo(),
    routeService: fakeRoute({
      source: 'osrm',
      estimated: false,
      distanceMeters: 100_000,
      durationSeconds: 3600,
      legs: [],
    }),
    now: () => Date.UTC(2026, 10, 17),
  })

  const result = await service.calculate({
    input: { itinerary: itinerary(), options: { travelers: 1, days: 1 } },
    persist: false,
  })

  assert.equal(result.storage, 'none')
  assert.equal(result.pricingSource, 'defaults')
  assert.equal(result.persistence.saved, false)
  assert.equal(result.generatedAt, '2026-11-17T00:00:00.000Z')
  assert.ok(result.totals.minCents > 0)
})

test('usa la configuración del repositorio y no acepta precios del cliente', async () => {
  const custom = settings({
    fuelPricePerLiterCents: 200,
    vehicleConsumptionLitersPer100Km: 10,
    fuelSafetyMarginPercent: 0,
    mealTiers: {
      economico: { breakfastCents: 0, lunchCents: 0, dinnerCents: 0, snackCents: 0 },
      estandar: { breakfastCents: 0, lunchCents: 0, dinnerCents: 0, snackCents: 0 },
      premium: { breakfastCents: 0, lunchCents: 0, dinnerCents: 0, snackCents: 0 },
    },
  })
  const repo = fakeRepo({
    enabled: true,
    readSettings: async () => ({ ...custom, source: 'supabase' }),
    listEntrancePrices: async () => [],
  })
  const service = createBudgetService({
    repository: repo,
    routeService: fakeRoute({
      source: 'osrm',
      estimated: false,
      distanceMeters: 100_000,
      durationSeconds: 3600,
      legs: [],
    }),
  })

  const result = await service.calculate({
    input: {
      itinerary: itinerary(),
      options: { travelers: 1, days: 1, transportMode: 'particular' },
      settings: { fuelPricePerLiterCents: 1 },
    },
    persist: false,
  })

  assert.equal(result.pricingSource, 'supabase')
  assert.equal(
    result.breakdown.find((item) => item.key === 'transport').minCents,
    2000,
  )
})

test('guarda el historial solo para el propietario autenticado', async () => {
  const saved = []
  const repo = fakeRepo({
    enabled: true,
    readUser: async () => ({ id: 'user-1', email: 'user@example.test' }),
    loadOwnedItinerary: async (userId, itineraryId) =>
      userId === 'user-1' && itineraryId === '11111111-1111-4111-8111-111111111111'
        ? { id: itineraryId, title: 'Mi itinerario' }
        : null,
    saveEstimate: async (input) => {
      saved.push(input)
      return 'estimate-1'
    },
    readSettings: async () => ({ ...settings(), source: 'supabase' }),
  })
  const service = createBudgetService({
    repository: repo,
    routeService: fakeRoute({
      source: 'osrm',
      estimated: false,
      distanceMeters: 1000,
      durationSeconds: 60,
      legs: [],
    }),
  })

  const result = await service.calculate({
    input: {
      itinerary: itinerary(),
      options: { travelers: 1, days: 1 },
      itineraryId: '11111111-1111-4111-8111-111111111111',
    },
    headers: { authorization: 'Bearer token' },
  })

  assert.equal(result.savedEstimateId, 'estimate-1')
  assert.equal(result.persistence.saved, true)
  assert.equal(saved[0].itineraryTitle, 'Mi itinerario')
})

test('un error al guardar no impide mostrar el presupuesto', async () => {
  const repo = fakeRepo({
    enabled: true,
    readUser: async () => ({ id: 'user-1' }),
    readSettings: async () => ({ ...settings(), source: 'supabase' }),
    saveEstimate: async () => {
      throw new Error('sin base de datos')
    },
  })
  const service = createBudgetService({
    repository: repo,
    routeService: fakeRoute({
      source: 'osrm',
      estimated: false,
      distanceMeters: 1000,
      durationSeconds: 60,
      legs: [],
    }),
    logError: () => {},
  })

  const result = await service.calculate({
    input: { itinerary: itinerary() },
    headers: { authorization: 'Bearer token' },
  })

  assert.equal(result.persistence.saved, false)
  assert.equal(result.persistence.reason, 'storage_error')
  assert.ok(result.totals.minCents > 0)
})

test('si OSRM falla usa el respaldo y lo marca', async () => {
  const service = createBudgetService({
    repository: fakeRepo(),
    routeService: {
      enabled: true,
      route: async () => {
        throw new Error('OSRM caído')
      },
    },
    logError: () => {},
  })

  const result = await service.calculate({
    input: { itinerary: itinerary() },
    persist: false,
  })

  assert.equal(result.route.source, 'haversine-estimate')
  assert.equal(result.route.estimated, true)
  assert.equal(result.route.fallbackReason, 'Error')
  assert.ok(result.warnings.some((warning) => /respaldo/i.test(warning)))
})

test('rechaza guardar en un itinerario de otra persona', async () => {
  const service = createBudgetService({
    repository: fakeRepo({
      enabled: true,
      readUser: async () => ({ id: 'user-1' }),
      loadOwnedItinerary: async () => null,
      readSettings: async () => ({ ...settings(), source: 'supabase' }),
    }),
    routeService: fakeRoute({
      source: 'osrm',
      estimated: false,
      distanceMeters: 1000,
      durationSeconds: 60,
      legs: [],
    }),
  })

  await assert.rejects(
    () =>
      service.calculate({
        input: {
          itinerary: itinerary(),
          itineraryId: '11111111-1111-4111-8111-111111111111',
        },
        headers: { authorization: 'Bearer token' },
      }),
    (error) => error.status === 403,
  )
})

test('la cancelación externa aborta el cálculo', async () => {
  const controller = new AbortController()
  controller.abort()
  const service = createBudgetService({
    repository: fakeRepo(),
    routeService: fakeRoute({
      source: 'osrm',
      estimated: false,
      distanceMeters: 1000,
      durationSeconds: 60,
      legs: [],
    }),
  })

  await assert.rejects(
    () => service.calculate({ input: { itinerary: itinerary() }, signal: controller.signal }),
    (error) => error.name === 'AbortError',
  )
})

test('expone historial y configuración administrativa', async () => {
  const adminSettings = { ...DEFAULT_BUDGET_SETTINGS, fuelPricePerLiterCents: 123 }
  const repo = fakeRepo({
    enabled: true,
    adminEnabled: true,
    listEstimates: async ({ userId }) => [{ id: 'estimate-1', userId }],
    readSettings: async () => ({ ...adminSettings, source: 'supabase' }),
    listEntrancePrices: async () => [{ id: 'entrance-1', name: 'Museo' }],
    updateSettings: async (value) => ({ ...value, source: 'supabase' }),
  })
  const service = createBudgetService({
    repository: repo,
    routeService: fakeRoute({ source: 'osrm', estimated: false }),
  })

  const history = await service.listHistory({ headers: { authorization: 'Bearer token' } })
  assert.equal(history.estimates[0].userId, 'user-1')

  const config = await service.getAdminConfig({ headers: { authorization: 'Bearer token' } })
  assert.equal(config.settings.fuelPricePerLiterCents, 123)
  assert.equal(config.entrancePrices.length, 1)

  const updated = await service.updateAdminSettings({
    headers: { authorization: 'Bearer token' },
    body: { settings: { fuelPricePerLiterCents: 250 } },
  })
  assert.equal(updated.settings.fuelPricePerLiterCents, 250)
})
