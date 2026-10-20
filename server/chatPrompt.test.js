import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSystemPrompt, FINAL_RESPONSE_FORMAT } from './chatPrompt.js'
import { buildItinerary } from './chatItinerary.js'

// Pruebas de las instrucciones del sistema. No llaman a ninguna IA.

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

test('las instrucciones incluyen las reglas clave de veracidad', () => {
  const prompt = buildSystemPrompt({ today: '2026-10-19' })

  assert.match(prompt, /No inventes IDs, nombres, direcciones/)
  assert.match(prompt, /search_places/)
  assert.match(prompt, /get_place_details/)
  assert.match(prompt, /locate_reference/)
  assert.match(prompt, /calculate_distances/)
  assert.match(prompt, /No ejecutes código/)
  assert.match(prompt, /2026-10-19/)
  assert.match(prompt, /No hay un itinerario activo/)
  assert.deepEqual(FINAL_RESPONSE_FORMAT, { type: 'json_object' })
})

test('las instrucciones no contienen IDs de ejemplo con forma real', () => {
  const prompt = buildSystemPrompt({ today: '2026-10-19' })

  // Si el prompt mostrara IDs con forma osm-node-123, un modelo podría
  // copiarlos como si fueran reales. El servidor los descartaría, pero es
  // mejor no incitarlos.
  assert.equal(/osm-(?:node|way|relation)-\d+/.test(prompt), false)
})

test('el itinerario actual se incluye de forma compacta y con IDs reales', () => {
  const beach = publicPlace('osm-node-777', { name: 'Playa El Tunco' })
  const itinerary = buildItinerary(
    { title: 'Plan de playa', stops: [{ placeId: beach.id, reason: 'parada' }] },
    { allowedPlaces: new Map([[beach.id, beach]]) },
  )

  const prompt = buildSystemPrompt({ today: '2026-10-19', currentItinerary: itinerary })

  assert.match(prompt, /osm-node-777/)
  assert.match(prompt, /Plan de playa/)
  assert.ok(!prompt.includes('No hay un itinerario activo'))
  // El resumen compacto no filtra la atribución ni enlaces internos.
  assert.ok(!prompt.includes('© OpenStreetMap contributors'))
})
