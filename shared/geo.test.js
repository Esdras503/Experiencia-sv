import test from 'node:test'
import assert from 'node:assert/strict'
import { haversineMeters, isValidLatitude, isValidLongitude } from './geo.js'

test('haversine devuelve 0 para el mismo punto', () => {
  const point = { latitude: 13.6929, longitude: -89.2182 }
  assert.equal(haversineMeters(point, point), 0)
})

test('haversine aproxima 1 grado de latitud a unos 111.2 km', () => {
  const distance = haversineMeters(
    { latitude: 13, longitude: -89 },
    { latitude: 14, longitude: -89 },
  )
  assert.ok(Math.abs(distance - 111195) < 500, `distancia inesperada: ${distance}`)
})

test('haversine es simétrica', () => {
  const a = { latitude: 13.6929, longitude: -89.2182 }
  const b = { latitude: 13.4928, longitude: -89.3815 }
  const ab = haversineMeters(a, b)
  const ba = haversineMeters(b, a)
  assert.ok(Math.abs(ab - ba) < 1e-6)
  assert.ok(ab > 20000 && ab < 35000, `distancia inesperada: ${ab}`)
})

test('valida rangos de coordenadas', () => {
  assert.equal(isValidLatitude(13.69), true)
  assert.equal(isValidLatitude(90), true)
  assert.equal(isValidLatitude(90.1), false)
  assert.equal(isValidLatitude(Number.NaN), false)
  assert.equal(isValidLongitude(-89.21), true)
  assert.equal(isValidLongitude(180), true)
  assert.equal(isValidLongitude(181), false)
  assert.equal(isValidLongitude('13'), false)
})
