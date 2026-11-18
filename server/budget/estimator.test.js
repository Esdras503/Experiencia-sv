import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_BUDGET_SETTINGS,
  createDefaultBudgetSettings,
} from '../../shared/budget.js'
import {
  buildEstimatedRoute,
  buildRoutePoints,
  estimateBudget,
} from './estimator.js'

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
      economico: { ...base.mealTiers.economico, ...(overrides.mealTiers?.economico ?? {}) },
      estandar: { ...base.mealTiers.estandar, ...(overrides.mealTiers?.estandar ?? {}) },
      premium: { ...base.mealTiers.premium, ...(overrides.mealTiers?.premium ?? {}) },
    },
    lodgingPerPersonNightCents: {
      ...base.lodgingPerPersonNightCents,
      ...(overrides.lodgingPerPersonNightCents ?? {}),
    },
  }
}

function stop(name, latitude = 13.49, longitude = -89.38, id = `osm-node-${name.length}`) {
  return {
    place: {
      id,
      name,
      location: { latitude, longitude },
    },
  }
}

function itinerary(overrides = {}) {
  return {
    title: 'Plan de prueba',
    travelers: 1,
    durationDays: 1,
    origin: { label: 'San Salvador', latitude: 13.69, longitude: -89.22 },
    stops: [stop('Playa El Tunco')],
    budget: null,
    ...overrides,
  }
}

function route({ distanceMeters = 0, durationSeconds = 0, legs = [], source = 'osrm' } = {}) {
  return {
    source,
    estimated: source !== 'osrm',
    distanceMeters,
    durationSeconds,
    legs,
    returnToOrigin: true,
  }
}

function category(estimate, key) {
  return estimate.breakdown.find((item) => item.key === key)
}

test('un viajero y un día obtiene total, por persona y por día coherentes', () => {
  const estimate = estimateBudget({
    itinerary: itinerary(),
    options: { travelers: 1, days: 1 },
    settings: settings(),
    route: route({ distanceMeters: 100_000, durationSeconds: 7200 }),
  })

  assert.equal(estimate.inputs.travelers, 1)
  assert.equal(estimate.inputs.days, 1)
  assert.equal(estimate.inputs.nights, 0)
  assert.equal(estimate.inputs.includeLodging, false)
  assert.equal(category(estimate, 'lodging').minCents, 0)
  assert.equal(estimate.totals.perPersonMinCents, estimate.totals.minCents)
  assert.equal(estimate.totals.perDayMinCents, estimate.totals.minCents)
  assert.ok(estimate.totals.minCents > 0)
})

test('cuatro viajeros comparten el transporte y el costo por persona baja', () => {
  const one = estimateBudget({
    itinerary: itinerary({ travelers: 1 }),
    options: { travelers: 1, days: 1 },
    settings: settings(),
    route: route({ distanceMeters: 100_000 }),
  })
  const four = estimateBudget({
    itinerary: itinerary({ travelers: 4 }),
    options: { travelers: 4, days: 1 },
    settings: settings(),
    route: route({ distanceMeters: 100_000 }),
  })

  assert.equal(category(four, 'transport').minCents, category(one, 'transport').minCents)
  assert.equal(category(four, 'meals').minCents, category(one, 'meals').minCents * 4)
  assert.ok(four.totals.perPersonMinCents < four.totals.minCents)
  assert.equal(
    four.totals.perPersonMinCents,
    Math.round(four.totals.minCents / 4),
  )
})

test('tres días con hospedaje calcula dos noches por persona', () => {
  const custom = settings({
    lodgingPerPersonNightCents: { economico: 1000, estandar: 2500, premium: 4000 },
  })
  const estimate = estimateBudget({
    itinerary: itinerary({ travelers: 2, durationDays: 3 }),
    options: {
      travelers: 2,
      days: 3,
      includeLodging: true,
      nights: 2,
      lodgingTier: 'estandar',
    },
    settings: custom,
    route: route({ distanceMeters: 120_000 }),
  })

  assert.equal(estimate.inputs.nights, 2)
  assert.equal(estimate.inputs.includeLodging, true)
  assert.equal(category(estimate, 'lodging').minCents, 2500 * 2 * 2)
  assert.equal(
    estimate.totals.perDayMinCents,
    Math.round(estimate.totals.minCents / 3),
  )
})

test('vehículo particular aplica la fórmula de combustible y suma parqueo/peajes', () => {
  const custom = settings({
    fuelPricePerLiterCents: 100,
    vehicleConsumptionLitersPer100Km: 10,
    fuelSafetyMarginPercent: 20,
    parkingPerDayCents: 500,
    tollsPerDayCents: 200,
    mealTiers: {
      estandar: {
        breakfastCents: 0,
        lunchCents: 0,
        dinnerCents: 0,
        snackCents: 0,
      },
    },
  })
  const estimate = estimateBudget({
    itinerary: itinerary(),
    options: { travelers: 1, days: 1, transportMode: 'particular' },
    settings: custom,
    route: route({ distanceMeters: 100_000 }),
  })

  // 100 km × 10 L/100 km = 10 L × 100 centavos = 1000 centavos,
  // más 20 % de margen = 1200; parqueo 500 + peajes 200.
  assert.equal(category(estimate, 'transport').minCents, 1900)
  assert.equal(category(estimate, 'transport').maxCents, 1900)
  assert.match(
    category(estimate, 'transport').notes.join(' '),
    /Combustible calculado con 10\.00 L/,
  )
})

test('transporte público usa tarifas editables por tramo y persona', () => {
  const custom = settings({
    publicTransportPerKmPerPersonCents: 5,
    publicTransportMinimumPerLegCents: 100,
    mealTiers: {
      estandar: {
        breakfastCents: 0,
        lunchCents: 0,
        dinnerCents: 0,
        snackCents: 0,
      },
    },
  })
  const estimate = estimateBudget({
    itinerary: itinerary({ travelers: 3 }),
    options: { travelers: 3, days: 1, transportMode: 'publico' },
    settings: custom,
    route: route({
      distanceMeters: 80_000,
      legs: [
        { distanceMeters: 60_000 },
        { distanceMeters: 20_000 },
      ],
    }),
  })

  // Tramo 1: 60 km × 5 = 300; tramo 2: 20 km × 5 = 100; total 400 por
  // persona × 3 = 1200.
  assert.equal(category(estimate, 'transport').minCents, 1200)
  assert.match(
    category(estimate, 'transport').source,
    /Tarifas configurables/,
  )
})

test('entradas verificadas usan tarifas adulto e infantil del catálogo', () => {
  const estimate = estimateBudget({
    itinerary: itinerary({
      travelers: 3,
      stops: [stop('Museo Nacional', 13.7, -89.2, 'osm-node-10')],
    }),
    options: { travelers: 3, children: 1, days: 1 },
    settings: settings(),
    entrancePrices: [
      {
        placeId: 'osm-node-10',
        name: 'Museo Nacional',
        adultCents: 500,
        childCents: 300,
        verificationStatus: 'verified',
        verifiedAt: '2026-10-01',
        source: 'Taquilla del museo',
      },
    ],
    route: route(),
  })

  assert.equal(category(estimate, 'admissions').minCents, 500 * 2 + 300)
  assert.equal(category(estimate, 'admissions').maxCents, 500 * 2 + 300)
  assert.equal(estimate.verification.entranceStatus, 'verified')
  assert.equal(estimate.entranceItems[0].verification, 'verified')
})

test('entradas sin precio muestran rango y advertencia, sin asumir gratis', () => {
  const custom = settings({
    unverifiedEntranceMinPerPersonCents: 100,
    unverifiedEntranceMaxPerPersonCents: 500,
  })
  const estimate = estimateBudget({
    itinerary: itinerary({
      travelers: 2,
      stops: [stop('Parque A'), stop('Parque B', 13.5, -89.4, 'osm-node-20')],
    }),
    options: { travelers: 2, days: 1 },
    settings: custom,
    entrancePrices: [],
    route: route(),
  })

  const admissions = category(estimate, 'admissions')
  assert.equal(admissions.minCents, 400)
  assert.equal(admissions.maxCents, 2000)
  assert.equal(admissions.verification, 'unverified')
  assert.equal(estimate.verification.unverifiedEntrances, 2)
  assert.ok(estimate.warnings.some((warning) => /no verificado/i.test(warning)))
})

test('un cambio de paradas o distancia vuelve a calcular el presupuesto', () => {
  const first = estimateBudget({
    itinerary: itinerary({ stops: [stop('Parque A')] }),
    options: { travelers: 1, days: 1 },
    settings: settings(),
    route: route({ distanceMeters: 10_000 }),
  })
  const second = estimateBudget({
    itinerary: itinerary({
      stops: [stop('Parque A'), stop('Parque B', 13.5, -89.4, 'osm-node-20')],
    }),
    options: { travelers: 1, days: 1 },
    settings: settings(),
    route: route({ distanceMeters: 40_000 }),
  })

  assert.notEqual(first.totals.minCents, second.totals.minCents)
  assert.equal(second.route.distanceMeters, 40_000)
})

test('cambiar el presupuesto máximo cambia la comparación', () => {
  const estimate = {
    itinerary: itinerary({
      budget: { amount: 5, currency: 'USD', scope: 'total' },
    }),
    options: { travelers: 1, days: 1 },
    settings: settings(),
    route: route(),
  }
  const over = estimateBudget(estimate)
  const within = estimateBudget({
    ...estimate,
    itinerary: itinerary({
      budget: { amount: 100, currency: 'USD', scope: 'total' },
    }),
  })

  assert.equal(over.budgetComparison.status, 'over')
  assert.equal(within.budgetComparison.status, 'within')
})

test('recalcular con más personas reparte los costos compartidos', () => {
  const one = estimateBudget({
    itinerary: itinerary({ travelers: 1 }),
    options: { travelers: 1, days: 2 },
    settings: settings(),
    route: route({ distanceMeters: 50_000 }),
  })
  const four = estimateBudget({
    itinerary: itinerary({ travelers: 4 }),
    options: { travelers: 4, days: 2 },
    settings: settings(),
    route: route({ distanceMeters: 50_000 }),
  })

  assert.equal(category(four, 'transport').minCents, category(one, 'transport').minCents)
  assert.ok(four.totals.perPersonMinCents < one.totals.perPersonMinCents)
  assert.equal(four.inputs.travelers, 4)
})

test('sin coordenadas suficientes devuelve transporte cero y una advertencia', () => {
  const estimate = estimateBudget({
    itinerary: itinerary({
      origin: null,
      stops: [
        { place: { id: 'osm-node-1', name: 'Sin ubicación', location: null } },
      ],
    }),
    options: { travelers: 1, days: 1 },
    settings: settings(),
    route: null,
  })

  assert.equal(estimate.route.distanceMeters, 0)
  assert.equal(category(estimate, 'transport').minCents, 0)
  assert.ok(estimate.warnings.some((warning) => /suficientes coordenadas/i.test(warning)))
})

test('el respaldo haversine queda marcado y usa el factor de carretera', () => {
  const points = buildRoutePoints(itinerary())
  const fallback = buildEstimatedRoute(points, settings({ roadFactor: 1.5 }))
  assert.equal(fallback.source, 'haversine-estimate')
  assert.equal(fallback.estimated, true)
  assert.ok(fallback.distanceMeters > 0)
  assert.ok(fallback.legs.length >= 1)
})

test('la configuración por defecto sigue siendo coherente', () => {
  assert.equal(DEFAULT_BUDGET_SETTINGS.currency, 'USD')
  assert.ok(DEFAULT_BUDGET_SETTINGS.estimateRangePercent >= 0)
  assert.ok(DEFAULT_BUDGET_SETTINGS.unverifiedEntranceMaxPerPersonCents >= 0)
})
