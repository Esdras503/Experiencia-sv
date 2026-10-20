import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateSearchQuery,
  validatePlaceQuery,
  validateLocateInput,
} from './validation.js'

test('la búsqueda recorta espacios y acepta categoría y página', () => {
  const result = validateSearchQuery({ query: '  playas  ', category: 'playas', pageSize: 5 })
  assert.equal(result.searchText, 'playas')
  assert.equal(result.categoryKey, 'playas')
  assert.equal(result.pageSize, 5)
  assert.equal(result.center, null)
  assert.equal(result.radiusKm, null)
})

test('la búsqueda rechaza textos demasiado largos y caracteres de control', () => {
  assert.throws(() => validateSearchQuery({ query: 'a'.repeat(201) }), /200 caracteres/)
  assert.throws(() => validateSearchQuery({ query: 'playas\u0000' }), /caracteres no permitidos/)
})

test('la búsqueda exige coordenadas válidas', () => {
  assert.throws(
    () => validateSearchQuery({ query: 'x', center: { latitude: 200, longitude: -89 } }),
    /coordenadas/,
  )
})

test('el radio exige centro y valores permitidos', () => {
  assert.throws(() => validateSearchQuery({ query: 'x', radiusKm: 10 }), /radio requiere/)
  assert.throws(
    () => validateSearchQuery({ query: 'x', center: { latitude: 13, longitude: -89 }, radiusKm: 7 }),
    /radio debe ser/,
  )

  const result = validateSearchQuery({
    query: 'x',
    center: { latitude: 13.7, longitude: -89.2 },
    radiusKm: 25,
  })
  assert.deepEqual(result.center, { latitude: 13.7, longitude: -89.2 })
  assert.equal(result.radiusKm, 25)
})

test('la búsqueda valida el tamaño de página', () => {
  assert.throws(() => validateSearchQuery({ query: 'x', pageSize: 0 }), /entre 1 y 20/)
  assert.throws(() => validateSearchQuery({ query: 'x', pageSize: 21 }), /entre 1 y 20/)
})

test('el identificador de lugar se valida contra la forma de OSM', () => {
  assert.deepEqual(validatePlaceQuery({ id: 'osm-node-123' }), { placeId: 'osm-node-123' })
  assert.deepEqual(validatePlaceQuery({ id: 'osm-way-456' }), { placeId: 'osm-way-456' })
  assert.deepEqual(validatePlaceQuery({ id: 'osm-relation-789' }), {
    placeId: 'osm-relation-789',
  })

  assert.throws(() => validatePlaceQuery({ id: '' }), /identificador/)
  assert.throws(() => validatePlaceQuery({ id: 'corto' }), /identificador/)
  assert.throws(() => validatePlaceQuery({ id: 'places/ChIJ123456' }), /identificador/)
  assert.throws(() => validatePlaceQuery({ id: 'osm-node-0' }), /identificador/)
  assert.throws(() => validatePlaceQuery({ id: 'osm-node-abc' }), /identificador/)
  assert.throws(() => validatePlaceQuery({ id: 'osm-city-123' }), /identificador/)
})

test('la referencia de ubicación exige al menos 3 caracteres', () => {
  assert.deepEqual(validateLocateInput({ query: '  San Salvador ' }), {
    searchText: 'San Salvador',
  })
  assert.throws(() => validateLocateInput({ query: 'ab' }), /3 caracteres/)
})
