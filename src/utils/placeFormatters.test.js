import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOsmLink, formatDistance } from './placeFormatters.js'

test('formatDistance usa metros y kilómetros con coma decimal', () => {
  assert.equal(formatDistance(0), '0 m')
  assert.equal(formatDistance(840), '840 m')
  assert.equal(formatDistance(12400), '12,4 km')
  assert.equal(formatDistance(null), null)
  assert.equal(formatDistance(-5), null)
  assert.equal(formatDistance('100'), null)
})

test('buildOsmLink prioriza el enlace del elemento que devuelve el servidor', () => {
  const withUrl = {
    osmUrl: 'https://www.openstreetmap.org/node/123',
    osmType: 'node',
    osmId: 123,
    location: { latitude: 13.5, longitude: -89.38 },
  }
  assert.equal(buildOsmLink(withUrl), 'https://www.openstreetmap.org/node/123')
})

test('buildOsmLink construye el elemento con tipo e id cuando no hay enlace', () => {
  assert.equal(
    buildOsmLink({ osmType: 'way', osmId: 456 }),
    'https://www.openstreetmap.org/way/456',
  )
})

test('buildOsmLink cae a coordenadas y a null cuando no hay datos', () => {
  const withLocation = { location: { latitude: 13.5, longitude: -89.38 } }
  assert.equal(
    buildOsmLink(withLocation),
    'https://www.openstreetmap.org/?mlat=13.5&mlon=-89.38#map=16/13.5/-89.38',
  )

  assert.equal(buildOsmLink({}), null)
  assert.equal(buildOsmLink({ location: { latitude: 200, longitude: 0 } }), null)
})
