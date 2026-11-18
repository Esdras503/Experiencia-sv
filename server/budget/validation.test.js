import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeAdminBudgetSettings,
  normalizeAdminEntrancePrice,
  normalizeBudgetRequest,
  normalizeBudgetItinerary,
} from './validation.js'
import { createDefaultBudgetSettings } from '../../shared/budget.js'

function itinerary(overrides = {}) {
  return {
    title: 'Plan',
    travelers: 2,
    durationDays: 2,
    origin: { label: 'San Salvador', latitude: 13.69, longitude: -89.22 },
    budget: { amount: 80, currency: 'USD', scope: 'total' },
    stops: [
      {
        place: {
          id: 'osm-node-1',
          name: 'Playa El Tunco',
          address: 'La Libertad',
          category: 'Playa',
          location: { latitude: 13.49, longitude: -89.38 },
        },
        reason: 'Visitar',
      },
    ],
    ...overrides,
  }
}

test('normaliza el itinerario y descarta precios enviados por el cliente', () => {
  const normalized = normalizeBudgetRequest({
    itinerary: itinerary({
      fuelPricePerLiterCents: 1,
      entrancePrices: [{ adultCents: 0 }],
    }),
    options: {
      travelers: 3,
      children: 1,
      days: 2,
      transportMode: 'publico',
      mealTier: 'economico',
      lodgingTier: 'premium',
      includeLodging: true,
      nights: 1,
      fuelPricePerLiterCents: 1,
    },
    settings: { fuelPricePerLiterCents: 1 },
    entrancePrices: [],
  })

  assert.equal(normalized.itinerary.stops[0].place.name, 'Playa El Tunco')
  assert.equal(normalized.itinerary.fuelPricePerLiterCents, undefined)
  assert.equal(normalized.options.travelers, 3)
  assert.equal(normalized.options.adults, 2)
  assert.equal(normalized.options.children, 1)
  assert.equal(normalized.options.lodgingTier, 'premium')
  assert.equal(normalized.options.nights, 1)
  assert.equal(normalized.options.transportMode, 'publico')
})

test('usa los valores del itinerario cuando faltan opciones', () => {
  const normalized = normalizeBudgetRequest({ itinerary: itinerary() })
  assert.equal(normalized.options.travelers, 2)
  assert.equal(normalized.options.days, 2)
  assert.equal(normalized.options.includeLodging, true)
  assert.equal(normalized.options.nights, 1)
  assert.equal(normalized.options.transportMode, 'particular')
  assert.equal(normalized.options.mealTier, 'estandar')
  assert.equal(normalized.options.lodgingTier, 'estandar')
})

test('rechaza más niños que personas y medios de transporte desconocidos', () => {
  assert.throws(
    () =>
      normalizeBudgetRequest({
        itinerary: itinerary(),
        options: { travelers: 2, children: 3 },
      }),
    /entre 0 y 2/,
  )
  assert.throws(
    () =>
      normalizeBudgetRequest({
        itinerary: itinerary(),
        options: { transportMode: 'telepatía' },
      }),
    /transporte/i,
  )
})

test('acepta paradas sin coordenadas para informar el faltante en el cálculo', () => {
  const normalized = normalizeBudgetItinerary(
    itinerary({
      stops: [
        {
          place: {
            id: 'osm-node-1',
            name: 'Parada sin ubicación',
            location: { latitude: 999, longitude: 999 },
          },
        },
      ],
    }),
  )
  assert.equal(normalized.stops[0].place.location, null)
  assert.equal(normalized.stops[0].place.id, 'osm-node-1')
})

test('valida la configuración administrativa y conserva los valores ausentes', () => {
  const current = createDefaultBudgetSettings()
  const settings = normalizeAdminBudgetSettings(
    {
      settings: {
        fuelPricePerLiterCents: 200,
        mealTiers: {
          estandar: { lunchCents: 900 },
        },
        lodgingPerPersonNightCents: { premium: 9000 },
      },
    },
    current,
  )

  assert.equal(settings.fuelPricePerLiterCents, 200)
  assert.equal(settings.mealTiers.estandar.lunchCents, 900)
  assert.equal(settings.mealTiers.estandar.breakfastCents, current.mealTiers.estandar.breakfastCents)
  assert.equal(settings.lodgingPerPersonNightCents.premium, 9000)
  assert.throws(
    () =>
      normalizeAdminBudgetSettings(
        { settings: { unverifiedEntranceMinPerPersonCents: 2000, unverifiedEntranceMaxPerPersonCents: 1000 } },
        current,
      ),
    /no puede ser menor/,
  )
})

test('una entrada verificada exige fuente y fecha de verificación', () => {
  assert.throws(
    () =>
      normalizeAdminEntrancePrice({
        name: 'Museo',
        adultCents: 500,
        verificationStatus: 'verified',
      }),
    /fuente y la fecha/,
  )

  const entrance = normalizeAdminEntrancePrice({
    name: 'Museo',
    adultCents: 500,
    groupCents: 1200,
    verificationStatus: 'verified',
    source: 'Taquilla',
    verifiedAt: '2026-10-01',
  })
  assert.equal(entrance.groupMinPeople, 1)
  assert.equal(entrance.verificationStatus, 'verified')
})
