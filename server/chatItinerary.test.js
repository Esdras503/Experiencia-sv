import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildItinerary,
  compactItineraryForPrompt,
  extractMentionedDates,
  normalizePublicPlace,
  resolveItinerarySigningSecret,
  signItinerary,
  verifyItineraryToken,
} from './chatItinerary.js'
import { validateChatRequest } from './chatValidation.js'

// Pruebas del itinerario estructurado y de la firma del contexto.
// No dependen de la IA ni de OpenStreetMap real.

function publicPlace(id, overrides = {}) {
  return {
    id,
    name: `Lugar ${id}`,
    address: 'El Salvador',
    category: 'Playa',
    icon: '🏖️',
    location: { latitude: 13.493, longitude: -89.383 },
    distanceMeters: 1200,
    osmUrl: 'https://www.openstreetmap.org/node/1',
    ...overrides,
  }
}

function allowedMap(places) {
  return new Map(places.map((place) => [place.id, place]))
}

test('normalizePublicPlace descarta coordenadas inválidas y no inventa datos', () => {
  assert.equal(normalizePublicPlace({ id: 'osm-node-1' }), null)
  assert.equal(
    normalizePublicPlace({
      id: 'osm-node-1',
      name: 'X',
      location: { latitude: 999, longitude: -89 },
    }),
    null,
  )

  const normalized = normalizePublicPlace(publicPlace('osm-node-1'))
  assert.equal(normalized.id, 'osm-node-1')
  assert.equal(normalized.rating, undefined)
  assert.equal(normalized.photo, undefined)
  assert.deepEqual(normalized.location, { latitude: 13.493, longitude: -89.383 })
})

test('extractMentionedDates solo devuelve fechas escritas por la persona', () => {
  const today = '2026-10-19'

  assert.deepEqual(extractMentionedDates('Un plan de un día', { today }), [])
  assert.deepEqual(extractMentionedDates('Plan para el 21/10/2026', { today }), ['2026-10-21'])
  assert.deepEqual(extractMentionedDates('El 25 de diciembre', { today }), ['2026-12-25'])
  assert.deepEqual(extractMentionedDates('El 5 de enero', { today }), ['2027-01-05'])
  assert.deepEqual(extractMentionedDates('Para 2026-10-21', { today }), ['2026-10-21'])
  assert.deepEqual(extractMentionedDates('El 31 de febrero', { today }), [])
})

test('buildItinerary no acepta una fecha que la persona no mencionó', () => {
  const beach = publicPlace('osm-node-1', { name: 'Playa El Tunco' })
  const raw = {
    title: 'Plan de playa',
    date: '2026-10-21',
    stops: [{ placeId: beach.id, reason: 'Visitar la playa' }],
  }
  const allowedPlaces = allowedMap([beach])

  const withoutPermission = buildItinerary(raw, { allowedPlaces, allowedDates: [] })
  assert.equal(withoutPermission.date, null)

  const withPermission = buildItinerary(raw, {
    allowedPlaces,
    allowedDates: ['2026-10-21'],
  })
  assert.equal(withPermission.date, '2026-10-21')

  const modified = buildItinerary(
    { ...raw, date: '2026-12-31' },
    {
      allowedPlaces,
      allowedDates: [],
      currentItinerary: withPermission,
    },
  )
  assert.equal(modified.date, '2026-10-21')
})

test('buildItinerary valida lugares, calcula distancias y no inventa campos', () => {
  const beach = publicPlace('osm-node-1', { name: 'Playa El Tunco' })
  const lake = publicPlace('osm-node-2', {
    name: 'Lago de Coatepeque',
    location: { latitude: 13.87, longitude: -89.55 },
  })

  const itinerary = buildItinerary(
    {
      title: 'Un día entre playa y lago',
      summary: 'Dos paradas verificadas.',
      date: '2026-10-20',
      travelers: 4,
      budget: { amount: 120.5, currency: 'usd', scope: 'total' },
      origin: { label: 'San Salvador', latitude: 13.69, longitude: -89.19 },
      stops: [
        { placeId: beach.id, reason: 'Primera parada junto al mar', visitMinutes: 90 },
        { placeId: lake.id, reason: 'Segunda parada para descansar' },
      ],
      warnings: ['Llevar protector solar'],
    },
    { allowedPlaces: allowedMap([beach, lake]), now: 1_700_000_000_000 },
  )

  assert.equal(itinerary.stops.length, 2)
  assert.equal(itinerary.stops[0].place.name, 'Playa El Tunco')
  assert.ok(itinerary.stops[0].distanceFromPreviousMeters === null)
  assert.ok(itinerary.stops[0].distanceFromOriginMeters > 0)
  assert.ok(itinerary.stops[1].distanceFromPreviousMeters > 0)
  assert.equal(itinerary.stops[0].visitMinutes, 90)
  assert.equal(itinerary.stops[0].visitEstimate, true)
  assert.equal(itinerary.stops[1].visitMinutes, null)
  assert.equal(itinerary.stops[1].visitEstimate, false)
  assert.equal(itinerary.budget.currency, 'USD')
  assert.equal(itinerary.date, '2026-10-20')
  assert.equal(itinerary.travelers, 4)
  assert.ok(itinerary.warnings.some((warning) => /línea recta/.test(warning)))
  assert.ok(itinerary.warnings.some((warning) => /estimaciones/.test(warning)))
  assert.ok(itinerary.warnings.some((warning) => /presupuesto es solo una referencia/.test(warning)))
  assert.equal(itinerary.attribution, '© OpenStreetMap contributors')
  assert.equal(itinerary.distanceMethod, 'haversine')
})

test('buildItinerary descarta IDs inventados y devuelve null si no queda nada', () => {
  const beach = publicPlace('osm-node-1')

  const withUnknown = buildItinerary(
    {
      stops: [
        { placeId: 'osm-node-999', reason: 'inventado' },
        { placeId: beach.id, reason: 'real' },
      ],
    },
    { allowedPlaces: allowedMap([beach]) },
  )

  assert.equal(withUnknown.stops.length, 1)
  assert.equal(withUnknown.stops[0].place.id, beach.id)
  assert.ok(withUnknown.warnings.some((warning) => /no correspondía/.test(warning)))

  const onlyUnknown = buildItinerary(
    { stops: [{ placeId: 'osm-node-999', reason: 'x' }] },
    { allowedPlaces: allowedMap([beach]) },
  )
  assert.equal(onlyUnknown, null)
})

test('buildItinerary respeta el máximo de paradas y los tipos de datos', () => {
  const places = Array.from({ length: 8 }, (_, index) =>
    publicPlace(`osm-node-${index + 1}`, {
      location: { latitude: 13.4 + index * 0.1, longitude: -89.3 },
    }),
  )

  const itinerary = buildItinerary(
    {
      date: '2026-02-31',
      travelers: 0,
      budget: { amount: 10, currency: 'usd', scope: 'otro' },
      stops: places.slice(0, 8).map((place) => ({ placeId: place.id, reason: 'parada' })),
    },
    { allowedPlaces: allowedMap(places) },
  )

  assert.equal(itinerary.stops.length, 6)
  assert.equal(itinerary.date, null)
  assert.equal(itinerary.travelers, null)
  assert.equal(itinerary.budget, null)
})

test('buildItinerary conserva metadatos del itinerario firmado anterior', () => {
  const beach = publicPlace('osm-node-1')
  const current = buildItinerary(
    {
      title: 'Plan anterior',
      summary: 'Resumen anterior',
      date: '2026-11-01',
      travelers: 3,
      origin: { label: 'Santa Ana', latitude: 13.99, longitude: -89.56 },
      stops: [{ placeId: beach.id, reason: 'parada' }],
    },
    { allowedPlaces: allowedMap([beach]) },
  )

  const updated = buildItinerary(
    { stops: [{ placeId: beach.id, reason: 'parada actualizada' }] },
    { allowedPlaces: allowedMap([beach]), currentItinerary: current },
  )

  assert.equal(updated.title, 'Plan anterior')
  assert.equal(updated.date, '2026-11-01')
  assert.equal(updated.travelers, 3)
  assert.equal(updated.origin.label, 'Santa Ana')
  assert.equal(updated.stops[0].distanceFromOriginMeters > 0, true)
})

test('la firma detecta manipulación y expiración', () => {
  const beach = publicPlace('osm-node-1')
  const itinerary = buildItinerary(
    { stops: [{ placeId: beach.id, reason: 'parada' }] },
    { allowedPlaces: allowedMap([beach]) },
  )
  const secret = 'secreto-de-prueba-suficientemente-largo'

  const token = signItinerary(itinerary, { secret, now: 1000 })
  const verified = verifyItineraryToken(token, { secret, now: 2000 })
  assert.deepEqual(verified, itinerary)

  // Firma de otro payload: no debe validar.
  const otherToken = signItinerary(
    { ...itinerary, title: 'Otro' },
    { secret, now: 1000 },
  )
  const [payload, signature] = token.split('.')
  const [, otherSignature] = otherToken.split('.')
  assert.equal(verifyItineraryToken(`${payload}.${otherSignature}`, { secret, now: 2000 }), null)
  assert.equal(verifyItineraryToken(token, { secret: `${secret}-otro`, now: 2000 }), null)
  assert.equal(verifyItineraryToken(`${payload}.${signature}x`, { secret, now: 2000 }), null)

  // Expiración.
  assert.equal(verifyItineraryToken(token, { secret, now: 100_000_000 }), null)
  assert.equal(verifyItineraryToken('no-es-token', { secret, now: 2000 }), null)
})

test('compactItineraryForPrompt no incluye datos innecesarios', () => {
  const beach = publicPlace('osm-node-1')
  const itinerary = buildItinerary(
    {
      title: 'Plan',
      stops: [{ placeId: beach.id, reason: 'parada', visitMinutes: 60 }],
    },
    { allowedPlaces: allowedMap([beach]) },
  )

  const compact = compactItineraryForPrompt(itinerary)
  assert.equal(compact.stops[0].placeId, 'osm-node-1')
  assert.equal(compact.stops[0].visitMinutes, 60)
  assert.equal(compact.stops[0].osmUrl, undefined)
  assert.equal(compact.attribution, undefined)
})

test('resolveItinerarySigningSecret prefiere el secreto explícito y deriva de la clave de IA', () => {
  assert.equal(
    resolveItinerarySigningSecret({ CHAT_SIGNING_SECRET: 'secreto-explicito-1234567890' }, 'clave'),
    'secreto-explicito-1234567890',
  )

  const derivedA = resolveItinerarySigningSecret({}, 'clave-de-ia')
  const derivedB = resolveItinerarySigningSecret({}, 'clave-de-ia')
  assert.equal(derivedA, derivedB)
  assert.ok(!derivedA.includes('clave-de-ia'))

  const randomA = resolveItinerarySigningSecret({}, '')
  const randomB = resolveItinerarySigningSecret({}, '')
  assert.match(randomA, /^[a-f0-9]{64}$/)
  assert.notEqual(randomA, randomB)
})

test('un itinerario de seis paradas con textos largos cabe en el token que la validación acepta', () => {
  const places = Array.from({ length: 6 }, (_, index) =>
    publicPlace(`osm-node-${index + 1}`, {
      name: 'N'.repeat(200),
      address: 'A'.repeat(400),
      category: 'C'.repeat(120),
      osmUrl: `https://www.openstreetmap.org/node/${index + 1}`.padEnd(500, 'x'),
    }),
  )

  const itinerary = buildItinerary(
    {
      title: 'T'.repeat(120),
      summary: 'S'.repeat(600),
      origin: { label: 'O'.repeat(160), latitude: 13.69, longitude: -89.19 },
      stops: places.map((place, index) => ({
        placeId: place.id,
        reason: 'R'.repeat(320),
        visitMinutes: 60 + index,
      })),
      warnings: Array.from({ length: 6 }, (_, index) => `${index}`.padEnd(260, 'W')),
    },
    { allowedPlaces: allowedMap(places) },
  )

  const token = signItinerary(itinerary, { secret: 'secreto-de-prueba-1234567890' })
  assert.ok(token.length <= 24000, `el token mide ${token.length} caracteres`)

  const validated = validateChatRequest({
    message: 'Hola',
    sessionId: 'sesion-de-prueba',
    itineraryToken: token,
  })
  assert.equal(validated.itineraryToken, token)
})
