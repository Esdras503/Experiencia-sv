import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ALL_CATEGORIES_KEY,
  categories,
  describeOsmTags,
  getCategoryByKey,
} from './categories.js'

test('cada categoría tiene clave, nombre, icono, etiqueta y filtros OSM', () => {
  for (const category of categories) {
    assert.ok(category.key, 'clave faltante')
    assert.ok(category.name, `nombre faltante en ${category.key}`)
    assert.ok(category.icon, `icono faltante en ${category.key}`)
    assert.ok(category.typeLabel, `etiqueta de tipo faltante en ${category.key}`)
    assert.notEqual(category.key, ALL_CATEGORIES_KEY)

    assert.ok(
      Array.isArray(category.osmFilters) && category.osmFilters.length > 0,
      `faltan filtros OSM en ${category.key}`,
    )

    for (const filter of category.osmFilters) {
      const entries = Object.entries(filter)
      assert.ok(entries.length > 0, `filtro vacío en ${category.key}`)
      for (const [key, value] of entries) {
        assert.equal(typeof key, 'string', `clave de etiqueta inválida en ${category.key}`)
        assert.equal(typeof value, 'string', `valor de etiqueta inválido en ${category.key}`)
      }
    }
  }
})

test('getCategoryByKey distingue "todos" y claves desconocidas', () => {
  assert.equal(getCategoryByKey(ALL_CATEGORIES_KEY), null)
  assert.equal(getCategoryByKey(''), null)
  assert.equal(getCategoryByKey('no-existe'), null)
  assert.deepEqual(getCategoryByKey('playas').osmFilters, [{ natural: 'beach' }])
})

test('describeOsmTags traduce etiquetas conocidas de OpenStreetMap', () => {
  assert.deepEqual(describeOsmTags({ natural: 'beach' }), { label: 'Playa', icon: '🏖️' })
  assert.equal(describeOsmTags({ natural: 'volcano' }).label, 'Volcán')
  assert.equal(describeOsmTags({ leisure: 'park' }).label, 'Parque')
  assert.equal(describeOsmTags({ tourism: 'museum' }).label, 'Museo')
  assert.equal(describeOsmTags({ amenity: 'restaurant' }).label, 'Restaurante')
  assert.equal(describeOsmTags({ historic: 'monument' }).label, 'Sitio histórico')
})

test('describeOsmTags usa la categoría solicitada como respaldo y un genérico si no hay nada', () => {
  assert.deepEqual(describeOsmTags({}, { typeLabel: 'Restaurante', icon: '🍽️' }), {
    label: 'Restaurante',
    icon: '🍽️',
  })
  assert.deepEqual(describeOsmTags({}), { label: null, icon: '📍' })
})
