import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_SAVED_STOPS,
  ItineraryValidationError,
  buildItineraryUpdate,
  createItineraryInsert,
  formValuesFromRecord,
  isValidPlaceId,
  itineraryToView,
  moveStop,
  normalizeCurrency,
  normalizeIsoDate,
  normalizeOrigin,
  parseOptionalBudgetAmount,
  parseOptionalInteger,
  recalculateStopDistances,
  removeStopAt,
  replaceStopPlace,
  stopFromPlace,
} from './itineraryPayload.js'

const USER_ID = '11111111-1111-4111-8111-111111111111'

function makeStop(index, overrides = {}) {
  return {
    order: index + 1,
    place: {
      id: `osm-node-935729888${index}`,
      name: `Parada ${index + 1}`,
      address: `Dirección ${index + 1}, El Salvador`,
      category: 'Mirador',
      icon: '✦',
      location: { latitude: 13.5 + index * 0.01, longitude: -89.3 - index * 0.01 },
      osmUrl: `https://www.openstreetmap.org/node/935729888${index}`,
    },
    reason: `Motivo real de la parada ${index + 1}.`,
    visitMinutes: 60,
    visitEstimate: true,
    ...overrides,
  }
}

function makeChatItinerary(overrides = {}) {
  return {
    title: '  Un día en la costa  ',
    summary: '  Plan con lugares reales de OpenStreetMap.  ',
    date: '2026-11-12',
    travelers: 2,
    budget: { amount: 75, currency: 'usd', scope: 'total' },
    origin: { label: 'San Salvador', latitude: 13.6929, longitude: -89.2182 },
    stops: [makeStop(0), makeStop(1)],
    warnings: ['Confirma el horario antes de salir.', 'Horario no disponible.'],
    dataSource: 'openstreetmap',
    attribution: '© OpenStreetMap contributors',
    attributionUrl: 'https://www.openstreetmap.org/copyright',
    distanceMethod: 'haversine',
    generatedAt: '2026-10-19T12:00:00.000Z',
    ...overrides,
  }
}

test('convierte el itinerario del chat en una fila sin inventar campos', () => {
  const record = createItineraryInsert(makeChatItinerary(), USER_ID)

  assert.equal(record.title, 'Un día en la costa')
  assert.equal(record.description, 'Plan con lugares reales de OpenStreetMap.')
  assert.equal(record.start_date, '2026-11-12')
  assert.equal(record.duration_days, null)
  assert.equal(record.party_size, 2)
  assert.equal(record.budget_amount, 75)
  assert.equal(record.budget_currency, 'USD')
  assert.equal(record.preferences.budgetScope, 'total')
  assert.equal(record.preferences.origin.label, 'San Salvador')
  assert.equal(record.preferences.notes, '')
  assert.equal(record.stops.length, 2)
  assert.equal(record.stops[0].placeId, 'osm-node-9357298880')
  assert.equal(record.stops[0].order, 1)
  assert.equal(record.stops[1].order, 2)
  assert.equal(record.stops[0].distanceFromOriginMeters > 0, true)
  assert.equal(record.stops[1].distanceFromPreviousMeters > 0, true)
  assert.equal('place' in record.stops[0], false)
  assert.equal('rating' in record.stops[0], false)
  assert.equal('photo' in record.stops[0], false)
  assert.deepEqual(record.preferences.warnings, [
    'Confirma el horario antes de salir.',
    'Horario no disponible.',
  ])
})

test('omite campos opcionales ausentes en lugar de rellenarlos', () => {
  const record = createItineraryInsert(
    {
      title: 'Solo una parada',
      stops: [makeStop(0)],
    },
    USER_ID,
  )

  assert.equal(record.description, null)
  assert.equal(record.start_date, null)
  assert.equal(record.duration_days, null)
  assert.equal(record.party_size, null)
  assert.equal(record.budget_amount, null)
  assert.equal(record.budget_currency, null)
  assert.equal(record.preferences.budgetScope, null)
  assert.equal(record.preferences.origin, null)
  assert.deepEqual(record.preferences.warnings, [])
  assert.equal(record.stops[0].reason, 'Motivo real de la parada 1.')
})

test('rechaza itinerarios sin paradas, con IDs inválidos o duplicados', () => {
  assert.throws(
    () => createItineraryInsert({ title: 'Sin paradas', stops: [] }, USER_ID),
    /al menos una parada/,
  )
  assert.throws(
    () =>
      createItineraryInsert(
        {
          title: 'ID inventado',
          stops: [makeStop(0, { place: { ...makeStop(0).place, id: 'inventado' } })],
        },
        USER_ID,
      ),
    /identificador real/,
  )
  assert.throws(
    () =>
      createItineraryInsert(
        {
          title: 'Duplicado',
          stops: [makeStop(0), makeStop(0)],
        },
        USER_ID,
      ),
    /repetir el mismo lugar/,
  )
  assert.throws(
    () => createItineraryInsert(makeChatItinerary(), 'no-es-uuid'),
    /usuario válido/,
  )
  assert.throws(
    () => createItineraryInsert({ summary: 'Sin título', stops: [makeStop(0)] }, USER_ID),
    /título/,
  )
})

test('respeta el máximo de paradas y el límite del chat', () => {
  const stops = Array.from({ length: MAX_SAVED_STOPS + 1 }, (_, index) => makeStop(index))
  assert.throws(
    () => createItineraryInsert({ title: 'Demasiadas', stops }, USER_ID),
    new RegExp(`no puede superar ${MAX_SAVED_STOPS}`),
  )
})

test('valida fechas, números y moneda con límites explícitos', () => {
  assert.equal(normalizeIsoDate('2026-02-28'), '2026-02-28')
  assert.equal(normalizeIsoDate('2026-02-29'), null)
  assert.equal(normalizeIsoDate('2024-02-29'), '2024-02-29')
  assert.equal(normalizeIsoDate('12/11/2026'), null)
  assert.equal(parseOptionalInteger('2', { min: 1, max: 50, label: 'Personas' }), 2)
  assert.equal(parseOptionalInteger('', { min: 1, max: 50, label: 'Personas' }), null)
  assert.throws(
    () => parseOptionalInteger('2.5', { min: 1, max: 50, label: 'Personas' }),
    /entero/,
  )
  assert.throws(
    () => parseOptionalBudgetAmount('100000001'),
    /presupuesto/,
  )
  assert.equal(normalizeCurrency('usd', 10), 'USD')
  assert.equal(normalizeCurrency('', 10), 'USD')
  assert.throws(() => normalizeCurrency('dólar', 10), /ISO 4217/)
})

test('normaliza el origen solo con coordenadas válidas', () => {
  assert.deepEqual(
    normalizeOrigin({ label: '  San Salvador ', latitude: 13.69, longitude: -89.21 }),
    { label: 'San Salvador', latitude: 13.69, longitude: -89.21 },
  )
  assert.equal(normalizeOrigin({ label: 'Sin coordenadas' }), null)
  assert.equal(normalizeOrigin({ label: '', latitude: 13.69, longitude: -89.21 }), null)
})

test('recalcula distancias al reordenar y permite quitar paradas', () => {
  const stops = [
    { ...makeStop(0), order: 1, location: { latitude: 13.5, longitude: -89.3 } },
    { ...makeStop(1), order: 2, location: { latitude: 13.51, longitude: -89.31 } },
  ]
  const origin = { label: 'Origen', latitude: 13.49, longitude: -89.29 }
  const reordered = recalculateStopDistances(moveStop(stops, 0, 1), origin)

  assert.equal(reordered[0].place.id, stops[1].place.id)
  assert.equal(reordered[0].order, 1)
  assert.equal(reordered[0].distanceFromOriginMeters > 0, true)
  assert.equal(reordered[1].distanceFromPreviousMeters > 0, true)

  const removed = removeStopAt(stops, 0, origin)
  assert.equal(removed.length, 1)
  assert.equal(removed[0].order, 1)
  assert.throws(() => removeStopAt([stops[0]], 0, origin), /al menos una parada/)
})

test('convierte un lugar de búsqueda en parada y actualiza su instantánea', () => {
  const place = {
    id: 'osm-way-123456',
    name: 'Lugar real',
    address: 'Calle real',
    category: 'Playa',
    icon: '≈',
    location: { latitude: 13.2, longitude: -89.5 },
    osmUrl: 'https://www.openstreetmap.org/way/123456',
  }
  const stop = stopFromPlace(place, { order: 2 })
  assert.equal(stop.order, 2)
  assert.equal(stop.placeId, 'osm-way-123456')
  assert.equal(stop.reason, 'Parada añadida manualmente desde OpenStreetMap.')
  assert.equal(stop.name, 'Lugar real')

  const updated = replaceStopPlace(stop, { ...place, name: 'Lugar actualizado' })
  assert.equal(updated.name, 'Lugar actualizado')
  assert.equal(updated.reason, stop.reason)
  assert.equal(isValidPlaceId(updated.placeId), true)
})

test('reconstruye la vista guardada y conserva identificadores reales', () => {
  const record = {
    title: 'Guardado',
    description: 'Resumen',
    start_date: '2026-12-01',
    duration_days: 2,
    party_size: 3,
    budget_amount: '100.50',
    budget_currency: 'USD',
    preferences: {
      budgetScope: 'persona',
      origin: { label: 'Santa Ana', latitude: 13.99, longitude: -89.56 },
      warnings: ['Advertencia'],
      notes: 'Notas',
    },
    stops: [
      {
        order: 1,
        placeId: 'osm-node-9357298880',
        name: 'Parada 1',
        address: 'Dirección',
        category: 'Mirador',
        icon: '✦',
        location: { latitude: 13.5, longitude: -89.3 },
        osmUrl: 'https://www.openstreetmap.org/node/9357298880',
        reason: 'Motivo',
        visitMinutes: 90,
        visitEstimate: true,
      },
      {
        order: 2,
        placeId: 'osm-node-9357298881',
        name: 'Parada 2',
        location: { latitude: 13.52, longitude: -89.32 },
      },
      {
        order: 3,
        placeId: 'inválido',
        name: 'Parada corrupta',
      },
    ],
  }
  const view = itineraryToView(record)

  assert.equal(view.title, 'Guardado')
  assert.equal(view.durationDays, 2)
  assert.equal(view.travelers, 3)
  assert.equal(view.budget.amount, 100.5)
  assert.equal(view.budget.currency, 'USD')
  assert.equal(view.budget.scope, 'persona')
  assert.equal(view.origin.label, 'Santa Ana')
  assert.equal(view.stops.length, 2)
  assert.equal(view.stops[0].place.id, 'osm-node-9357298880')
  assert.equal(view.stops[0].distanceFromOriginMeters > 0, true)
  assert.equal(view.stops[1].distanceFromPreviousMeters > 0, true)
  assert.equal(view.stops[0].place.name, 'Parada 1')
})

test('prepara la actualización conservando preferencias y validando los campos', () => {
  const currentRecord = {
    preferences: {
      origin: { label: 'San Salvador', latitude: 13.69, longitude: -89.21 },
      dataSource: 'openstreetmap',
      warnings: ['Advertencia previa'],
    },
    stops: [makeStop(0)],
  }
  const patch = buildItineraryUpdate({
    currentRecord,
    values: {
      title: '  Título editado ',
      description: 'Nueva descripción',
      startDate: '2026-12-02',
      durationDays: '2',
      partySize: '4',
      budgetAmount: '100.25',
      budgetCurrency: 'usd',
      budgetScope: 'persona',
      notes: '  Accesible y tranquilo. ',
    },
    stops: [
      {
        order: 1,
        placeId: 'osm-node-9357298881',
        name: 'Parada 2',
        location: { latitude: 13.51, longitude: -89.31 },
      },
      {
        order: 2,
        placeId: 'osm-node-9357298880',
        name: 'Parada 1',
        location: { latitude: 13.5, longitude: -89.3 },
      },
    ],
  })

  assert.equal(patch.title, 'Título editado')
  assert.equal(patch.start_date, '2026-12-02')
  assert.equal(patch.duration_days, 2)
  assert.equal(patch.party_size, 4)
  assert.equal(patch.budget_amount, 100.25)
  assert.equal(patch.budget_currency, 'USD')
  assert.equal(patch.preferences.budgetScope, 'persona')
  assert.equal(patch.preferences.notes, 'Accesible y tranquilo.')
  assert.equal(patch.preferences.dataSource, 'openstreetmap')
  assert.deepEqual(patch.preferences.warnings, ['Advertencia previa'])
  assert.equal(patch.stops[0].placeId, 'osm-node-9357298881')
  assert.equal(patch.stops[0].order, 1)

  const noBudget = buildItineraryUpdate({
    currentRecord,
    values: { title: 'Sin presupuesto', budgetAmount: '', budgetCurrency: 'EUR' },
    stops: [makeStop(0)],
  })
  assert.equal(noBudget.budget_amount, null)
  assert.equal(noBudget.budget_currency, null)

  assert.throws(
    () =>
      buildItineraryUpdate({
        currentRecord,
        values: { title: 'Fecha mala', startDate: '2026-02-31' },
        stops: [makeStop(0)],
      }),
    /fecha de inicio no es válida/,
  )
})

test('extrae los valores del formulario desde una fila de PostgreSQL', () => {
  assert.deepEqual(
    formValuesFromRecord({
      title: 'Plan',
      description: null,
      start_date: '2026-12-01',
      duration_days: 2,
      party_size: 3,
      budget_amount: '50.00',
      budget_currency: 'USD',
      preferences: { budgetScope: 'persona', notes: 'Nota' },
    }),
    {
      title: 'Plan',
      description: '',
      startDate: '2026-12-01',
      durationDays: '2',
      partySize: '3',
      budgetAmount: '50',
      budgetCurrency: 'USD',
      budgetScope: 'persona',
      notes: 'Nota',
    },
  )
})

test('los errores de validación son reconocibles por la interfaz', () => {
  assert.throws(
    () => createItineraryInsert({ title: 'Sin paradas', stops: [] }, USER_ID),
    (error) =>
      error instanceof ItineraryValidationError &&
      error.code === 'VALIDATION_ERROR' &&
      /parada/.test(error.message),
  )
})
