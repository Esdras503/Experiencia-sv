import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRoute } from './routes.js'

test('reconoce la ruta de inicio', () => {
  assert.deepEqual(parseRoute('/'), { name: 'home' })
  assert.deepEqual(parseRoute(''), { name: 'home' })
})

test('reconoce una ruta de detalle estable', () => {
  assert.deepEqual(parseRoute('/lugares/el-tunco'), {
    name: 'place',
    placeId: 'el-tunco',
  })
  assert.deepEqual(parseRoute('/lugares/el-tunco/'), {
    name: 'place',
    placeId: 'el-tunco',
  })
})

test('decodifica identificadores codificados', () => {
  assert.deepEqual(parseRoute('/lugares/lago%20de%20coatepeque'), {
    name: 'place',
    placeId: 'lago de coatepeque',
  })
})

test('reconoce las rutas de cuenta y autenticación', () => {
  assert.deepEqual(parseRoute('/cuenta'), { name: 'account' })
  assert.deepEqual(parseRoute('/cuenta/iniciar-sesion'), { name: 'login' })
  assert.deepEqual(parseRoute('/cuenta/registro'), { name: 'register' })
  assert.deepEqual(parseRoute('/cuenta/recuperar'), { name: 'forgot-password' })
  assert.deepEqual(parseRoute('/cuenta/restablecer'), { name: 'reset-password' })
  assert.deepEqual(parseRoute('/cuenta/iniciar-sesion/'), { name: 'login' })
})

test('reconoce la lista y el detalle de itinerarios', () => {
  assert.deepEqual(parseRoute('/itinerarios'), { name: 'itineraries' })
  assert.deepEqual(parseRoute('/itinerarios/abc-123'), {
    name: 'itinerary',
    itineraryId: 'abc-123',
  })
  assert.deepEqual(parseRoute('/itinerarios/abc%20123'), {
    name: 'itinerary',
    itineraryId: 'abc 123',
  })
})

test('marca como no encontrada cualquier otra ruta', () => {
  assert.deepEqual(parseRoute('/ruta-inexistente'), { name: 'not-found' })
  assert.deepEqual(parseRoute('/lugares/a/b'), { name: 'not-found' })
  assert.deepEqual(parseRoute('/itinerarios/a/b'), { name: 'not-found' })
  assert.deepEqual(parseRoute('/lugares/%E0%A4%A'), { name: 'not-found' })
  assert.deepEqual(parseRoute('/itinerarios/%E0%A4%A'), { name: 'not-found' })
})
