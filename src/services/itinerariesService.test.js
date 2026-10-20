import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ItineraryDataError,
  createItinerariesRepository,
  describeDatabaseError,
} from './itinerariesService.js'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ID = '22222222-2222-4222-8222-222222222222'
const ITINERARY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function createFakeClient({ listResponse, singleResponse, maybeResponse } = {}) {
  const state = {
    table: null,
    action: null,
    payload: null,
    select: null,
    filters: [],
    order: null,
    limit: null,
  }

  const builder = {
    from(table) {
      state.table = table
      return builder
    },
    select(columns) {
      state.select = columns
      return builder
    },
    insert(payload) {
      state.action = 'insert'
      state.payload = payload
      return builder
    },
    update(payload) {
      state.action = 'update'
      state.payload = payload
      return builder
    },
    delete() {
      state.action = 'delete'
      return builder
    },
    eq(column, value) {
      state.filters.push([column, value])
      return builder
    },
    order(column, options) {
      state.order = [column, options]
      return builder
    },
    limit(value) {
      state.limit = value
      return builder
    },
    maybeSingle() {
      return Promise.resolve(maybeResponse ?? { data: null, error: null })
    },
    single() {
      return Promise.resolve(singleResponse ?? { data: null, error: null })
    },
    then(resolve, reject) {
      return Promise.resolve(listResponse ?? { data: [], error: null }).then(resolve, reject)
    },
  }

  return {
    client: { from: builder.from },
    state,
  }
}

test('lista solo los itinerarios del usuario, con orden y límite', async () => {
  const { client, state } = createFakeClient({
    listResponse: { data: [{ id: ITINERARY_ID }], error: null },
  })
  const repository = createItinerariesRepository(client)
  const items = await repository.list(USER_ID)

  assert.equal(state.table, 'itineraries')
  assert.equal(state.action, null)
  assert.deepEqual(state.filters, [['user_id', USER_ID]])
  assert.deepEqual(state.order, ['updated_at', { ascending: false }])
  assert.equal(state.limit, 100)
  assert.equal(items.length, 1)
})

test('crea con el propietario de la sesión y descarta campos no permitidos', async () => {
  const { client, state } = createFakeClient({
    singleResponse: { data: { id: ITINERARY_ID }, error: null },
  })
  const repository = createItinerariesRepository(client)
  await repository.create(USER_ID, {
    id: 'intento-de-id',
    user_id: OTHER_ID,
    title: 'Plan',
    stops: [{ placeId: 'osm-node-1' }],
    created_at: '2020-01-01',
  })

  assert.equal(state.action, 'insert')
  assert.equal(state.payload.user_id, USER_ID)
  assert.equal(state.payload.id, undefined)
  assert.equal(state.payload.created_at, undefined)
  assert.equal(state.payload.title, 'Plan')
  assert.equal(state.payload.user_id, USER_ID)
})

test('actualiza y elimina filtrando por id y propietario', async () => {
  const update = createFakeClient({
    maybeResponse: { data: { id: ITINERARY_ID }, error: null },
  })
  const repository = createItinerariesRepository(update.client)
  await repository.update(USER_ID, ITINERARY_ID, {
    title: 'Nuevo',
    user_id: OTHER_ID,
    created_at: '2020-01-01',
  })

  assert.equal(update.state.action, 'update')
  assert.deepEqual(update.state.payload, { title: 'Nuevo' })
  assert.deepEqual(update.state.filters, [
    ['id', ITINERARY_ID],
    ['user_id', USER_ID],
  ])

  const remove = createFakeClient({
    maybeResponse: { data: { id: ITINERARY_ID }, error: null },
  })
  await createItinerariesRepository(remove.client).remove(USER_ID, ITINERARY_ID)
  assert.equal(remove.state.action, 'delete')
  assert.equal(remove.state.select, 'id')
  assert.deepEqual(remove.state.filters, [
    ['id', ITINERARY_ID],
    ['user_id', USER_ID],
  ])
})

test('un itinerario ajeno o inexistente no se revela como encontrado', async () => {
  const { client } = createFakeClient({
    maybeResponse: { data: null, error: null },
  })
  const repository = createItinerariesRepository(client)
  await assert.rejects(
    () => repository.get(USER_ID, ITINERARY_ID),
    (error) => error instanceof ItineraryDataError && error.code === 'NOT_FOUND',
  )
})

test('clasifica errores de RLS, sesión, validación y red', () => {
  assert.equal(
    describeDatabaseError({ code: '42501', message: 'new row violates row-level security policy' })
      .code,
    'FORBIDDEN',
  )
  assert.equal(describeDatabaseError({ status: 401 }).code, 'SESSION_EXPIRED')
  assert.equal(describeDatabaseError({ code: '23514' }).code, 'VALIDATION_ERROR')
  assert.equal(
    describeDatabaseError({ message: 'TypeError: Failed to fetch' }).code,
    'NETWORK_ERROR',
  )
  const generic = describeDatabaseError({ code: 'XX000', message: 'detalle interno' })
  assert.equal(generic.code, 'INTERNAL')
  assert.doesNotMatch(generic.message, /detalle interno/)
})

test('rechaza identificadores inválidos antes de consultar', async () => {
  const { client, state } = createFakeClient()
  const repository = createItinerariesRepository(client)

  await assert.rejects(() => repository.get('mal', ITINERARY_ID), /sesión no es válida/)
  await assert.rejects(() => repository.get(USER_ID, 'mal'), /no existe/)
  assert.equal(state.table, null)
})
