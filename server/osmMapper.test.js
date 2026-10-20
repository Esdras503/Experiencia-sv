import test from 'node:test'
import assert from 'node:assert/strict'
import { toPublicPlace, toPublicPlaceDetails } from './osmMapper.js'

const center = { latitude: 13.5, longitude: -89.3 }

test('toPublicPlace mapea un resultado de Nominatim sin inventar campos', () => {
  const place = toPublicPlace(
    {
      osmType: 'node',
      osmId: 123,
      name: 'Playa El Tunco',
      displayName: 'Playa El Tunco, La Libertad, El Salvador',
      latitude: 13.493,
      longitude: -89.383,
      tags: { opening_hours: 'Mo-Su 08:00-18:00' },
      nominatimClass: 'natural',
      nominatimType: 'beach',
    },
    { center },
  )

  assert.equal(place.id, 'osm-node-123')
  assert.equal(place.name, 'Playa El Tunco')
  assert.equal(place.address, 'Playa El Tunco, La Libertad, El Salvador')
  assert.equal(place.category, 'Playa')
  assert.equal(place.icon, '🏖️')
  assert.equal(place.osmUrl, 'https://www.openstreetmap.org/node/123')
  assert.ok(Number.isInteger(place.distanceMeters) && place.distanceMeters > 0)

  assert.equal('rating' in place, false, 'OSM no ofrece calificaciones')
  assert.equal('reviewCount' in place, false)
  assert.equal('photo' in place, false, 'OSM no ofrece fotos')
  assert.equal('openNow' in place, false)
})

test('toPublicPlace compone la dirección desde etiquetas addr:* de Overpass', () => {
  const place = toPublicPlace({
    osmType: 'way',
    osmId: 9,
    name: 'Hotel X',
    displayName: null,
    latitude: 13.7,
    longitude: -89.2,
    tags: {
      tourism: 'hotel',
      'addr:street': 'Calle 1',
      'addr:house_number': '5',
      'addr:city': 'Santa Ana',
    },
  })

  assert.equal(place.address, 'Calle 1 5, Santa Ana')
  assert.equal(place.category, 'Hotel')
  assert.equal(place.icon, '🛏️')
  assert.equal(place.distanceMeters, null)
})

test('toPublicPlace usa la categoría solicitada como respaldo', () => {
  const place = toPublicPlace(
    {
      osmType: 'node',
      osmId: 7,
      name: 'Lugar sin tipo conocido',
      displayName: null,
      latitude: 13.1,
      longitude: -88.5,
      tags: { amenity: 'unknown_value' },
    },
    { category: { key: 'restaurantes', typeLabel: 'Restaurante', icon: '🍽️' } },
  )

  assert.equal(place.category, 'Restaurante')
  assert.equal(place.icon, '🍽️')
})

test('toPublicPlace toma el nombre de display_name si el elemento no tiene name', () => {
  const place = toPublicPlace({
    osmType: 'relation',
    osmId: 3,
    name: null,
    displayName: 'Volcán de San Salvador, El Salvador',
    latitude: 13.73,
    longitude: -89.28,
    tags: {},
    nominatimClass: 'natural',
    nominatimType: 'volcano',
  })

  assert.equal(place.name, 'Volcán de San Salvador')
  assert.equal(place.osmUrl, 'https://www.openstreetmap.org/relation/3')
})

test('toPublicPlace descarta elementos sin coordenadas o identificador válido', () => {
  assert.equal(
    toPublicPlace({
      osmType: 'node',
      osmId: 1,
      name: 'Sin coordenadas',
      latitude: null,
      longitude: -89,
      tags: {},
    }),
    null,
  )

  assert.equal(
    toPublicPlace({
      osmType: 'unknown',
      osmId: 1,
      name: 'Tipo inválido',
      latitude: 13,
      longitude: -89,
      tags: {},
    }),
    null,
  )
})

test('toPublicPlaceDetails añade sitio, teléfono, horario y descripción reales', () => {
  const place = toPublicPlaceDetails({
    osmType: 'node',
    osmId: 1,
    name: 'Hotel X',
    displayName: 'Hotel X, San Salvador, El Salvador',
    latitude: 13.7,
    longitude: -89.2,
    tags: {
      tourism: 'hotel',
      website: 'https://example.org',
      phone: '+503 2222 2222',
      opening_hours: '24/7',
      description: 'Un hotel de ejemplo.',
    },
  })

  assert.equal(place.website, 'https://example.org/')
  assert.equal(place.phone, '+503 2222 2222')
  assert.equal(place.openingHours, '24/7')
  assert.equal(place.description, 'Un hotel de ejemplo.')
})

test('toPublicPlaceDetails descarta enlaces con protocolos no seguros', () => {
  const place = toPublicPlaceDetails({
    osmType: 'node',
    osmId: 2,
    name: 'Lugar',
    displayName: null,
    latitude: 13.6,
    longitude: -89.1,
    tags: { website: 'javascript:alert(1)' },
  })

  assert.equal(place.website, null)
})

test('toPublicPlaceDetails acepta http y https de las etiquetas de OpenStreetMap', () => {
  const httpPlace = toPublicPlaceDetails({
    osmType: 'node',
    osmId: 3,
    name: 'Lugar',
    displayName: null,
    latitude: 13.6,
    longitude: -89.1,
    tags: { website: 'http://example.org' },
  })
  assert.equal(httpPlace.website, 'http://example.org/')

  const contactPlace = toPublicPlaceDetails({
    osmType: 'node',
    osmId: 4,
    name: 'Lugar',
    displayName: null,
    latitude: 13.6,
    longitude: -89.1,
    tags: { 'contact:website': 'https://example.org/contacto' },
  })
  assert.equal(contactPlace.website, 'https://example.org/contacto')
})
