import test from 'node:test'
import assert from 'node:assert/strict'
import { collectMapPoints } from './mapData.js'

function place(id, latitude, longitude, extra = {}) {
  return { id, name: `Lugar ${id}`, location: { latitude, longitude }, ...extra }
}

test('collectMapPoints conserva solo lugares con coordenadas válidas y sin duplicados', () => {
  const { points } = collectMapPoints(
    [
      place('a', 13.5, -89.3),
      place('a', 13.5, -89.3),
      place('b', 200, -89.3),
      place('c', null, -89.3),
      { id: 'd', name: 'Sin ubicación' },
      place('e', 13.7, -89.2),
    ],
    null,
  )

  assert.deepEqual(
    points.map((point) => point.id),
    ['a', 'e'],
  )
  assert.equal(points[0].name, 'Lugar a')
})

test('collectMapPoints incluye la referencia y calcula los límites', () => {
  const { points, origin, bounds } = collectMapPoints(
    [place('a', 13.4, -89.5), place('b', 13.9, -88.9)],
    { latitude: 13.6, longitude: -89.2, label: 'San Salvador' },
  )

  assert.equal(points.length, 2)
  assert.deepEqual(origin, {
    latitude: 13.6,
    longitude: -89.2,
    label: 'San Salvador',
  })
  assert.deepEqual(bounds, [
    [13.4, -89.5],
    [13.9, -88.9],
  ])
})

test('collectMapPoints descarta una referencia inválida y no inventa límites', () => {
  const invalidOrigin = collectMapPoints([place('a', 13.5, -89.3)], {
    latitude: 200,
    longitude: -89.2,
  })
  assert.equal(invalidOrigin.origin, null)
  assert.deepEqual(invalidOrigin.bounds, [
    [13.5, -89.3],
    [13.5, -89.3],
  ])

  const empty = collectMapPoints([], null)
  assert.deepEqual(empty.points, [])
  assert.equal(empty.origin, null)
  assert.equal(empty.bounds, null)

  const onlyOrigin = collectMapPoints([], { latitude: 13.5, longitude: -89.3 })
  assert.deepEqual(onlyOrigin.points, [])
  assert.deepEqual(onlyOrigin.bounds, [
    [13.5, -89.3],
    [13.5, -89.3],
  ])
})
