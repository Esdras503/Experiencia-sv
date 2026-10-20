import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequestHandler } from './handlers.js'
import { AppError, ERROR_CODES } from './errors.js'

// Cliente simulado de OpenStreetMap: sustituye a Nominatim/Overpass para
// comprobar validación, filtros, caché y manejo de errores del servidor.
// No representa una conexión real ni datos reales.

function rawBeach(overrides = {}) {
  return {
    osmType: 'node',
    osmId: 123,
    name: 'Playa El Tunco',
    displayName: 'Playa El Tunco, La Libertad, El Salvador',
    latitude: 13.493,
    longitude: -89.383,
    tags: {},
    nominatimClass: 'natural',
    nominatimType: 'beach',
    ...overrides,
  }
}

function createFakeOsmClient({ searchResult, detailsResult, locateResult } = {}) {
  const calls = { search: [], details: [], locate: [] }

  const client = {
    async search(input) {
      calls.search.push(input)
      if (searchResult instanceof Error) throw searchResult
      return searchResult ?? { source: 'nominatim', items: [] }
    },
    async details(placeId, options) {
      calls.details.push({ placeId, ...options })
      if (detailsResult instanceof Error) throw detailsResult
      if (detailsResult === undefined) {
        throw new AppError(ERROR_CODES.PLACE_NOT_FOUND, { status: 404 })
      }
      return detailsResult
    },
    async locate(query, options) {
      calls.locate.push({ query, ...options })
      if (locateResult instanceof Error) throw locateResult
      if (locateResult === undefined) {
        throw new AppError(ERROR_CODES.LOCATION_NOT_FOUND, { status: 404 })
      }
      return locateResult
    },
  }

  return { client, calls }
}

function makeHandler({ fake = {}, env = {}, logError = () => {} } = {}) {
  const { client, calls } = createFakeOsmClient(fake)
  const handler = createRequestHandler({
    env: { NOMINATIM_MIN_INTERVAL_MS: '0', ...env },
    osmClient: client,
    logError,
  })
  return { handler, calls }
}

function searchRequest(body, extras = {}) {
  return {
    method: 'POST',
    pathname: '/api/search',
    body,
    query: {},
    headers: {},
    ip: '203.0.113.10',
    ...extras,
  }
}

test('/api/config informa OpenStreetMap y no expone credenciales', async () => {
  const { handler } = makeHandler({
    env: { OSM_USER_AGENT: 'AppPrivada/1.0 (contacto: privado@example.org)' },
  })

  const response = await handler({
    method: 'GET',
    pathname: '/api/config',
    body: {},
    query: {},
    headers: {},
    ip: '203.0.113.1',
  })

  assert.equal(response.status, 200)
  assert.equal(response.json.configured, true)
  assert.equal(response.json.source, 'openstreetmap')
  assert.equal(response.json.map.tileUrl, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png')
  assert.match(response.json.map.attribution, /OpenStreetMap/)
  assert.ok(response.json.radiusOptionsKm.includes(25))

  const serialized = JSON.stringify(response.json)
  assert.ok(!serialized.includes('privado@example.org'), 'no debe salir el User-Agent')
  assert.ok(!/AIza/.test(serialized), 'no debe haber claves')
})

test('/api/config usa la URL de teselas propia solo si es https', async () => {
  const custom = makeHandler({
    env: { OSM_TILE_URL: 'https://teselas.example.org/{z}/{x}/{y}.png' },
  })
  const customResponse = await custom.handler({
    method: 'GET',
    pathname: '/api/config',
    body: {},
    query: {},
    headers: {},
    ip: 'ip',
  })
  assert.equal(customResponse.json.map.tileUrl, 'https://teselas.example.org/{z}/{x}/{y}.png')

  const insecure = makeHandler({
    env: { OSM_TILE_URL: 'http://teselas.example.org/{z}/{x}/{y}.png' },
  })
  const insecureResponse = await insecure.handler({
    method: 'GET',
    pathname: '/api/config',
    body: {},
    query: {},
    headers: {},
    ip: 'ip',
  })
  assert.equal(insecureResponse.json.map.tileUrl, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png')
})

test('la búsqueda por texto mapea resultados de OpenStreetMap sin campos inventados', async () => {
  const { handler, calls } = makeHandler({
    fake: { searchResult: { source: 'nominatim', items: [rawBeach()] } },
  })

  const response = await handler(searchRequest({ query: 'El Tunco', pageSize: 5 }))

  assert.equal(response.status, 200)
  assert.equal(calls.search.length, 1)
  assert.equal(calls.search[0].textQuery, 'El Tunco')
  assert.equal(calls.search[0].category, null)
  assert.equal(calls.search[0].pageSize, 5)

  const [place] = response.json.places
  assert.equal(place.id, 'osm-node-123')
  assert.equal(place.name, 'Playa El Tunco')
  assert.equal(place.category, 'Playa')
  assert.equal(place.osmUrl, 'https://www.openstreetmap.org/node/123')
  assert.equal(place.distanceMeters, null)

  assert.equal('rating' in place, false)
  assert.equal('photo' in place, false)
  assert.equal('reviewCount' in place, false)

  assert.equal(response.json.source, 'openstreetmap')
  assert.equal(response.json.dataSource, 'nominatim')
  assert.match(response.json.attribution, /OpenStreetMap/)
  assert.match(response.json.rankingNotice, /OpenStreetMap/)

  const serialized = JSON.stringify(response.json)
  assert.ok(!serialized.includes('nominatimClass'), 'no debe filtrar la forma interna')
})

test('la búsqueda colapsa el mismo lugar devuelto como nodo y relación', async () => {
  const items = [
    rawBeach({ osmType: 'relation', osmId: 100, latitude: 13.4929, longitude: -89.3841 }),
    rawBeach({ osmType: 'node', osmId: 101, latitude: 13.4926, longitude: -89.3839 }),
    rawBeach({
      osmType: 'node',
      osmId: 102,
      name: 'Otra playa',
      latitude: 13.4926,
      longitude: -89.3839,
    }),
    rawBeach({ osmType: 'node', osmId: 103, latitude: 13.9, longitude: -89.9 }),
  ]
  const { handler } = makeHandler({
    fake: { searchResult: { source: 'nominatim', items } },
  })

  const response = await handler(searchRequest({ query: 'El Tunco', pageSize: 10 }))

  assert.deepEqual(
    response.json.places.map((place) => place.id),
    ['osm-relation-100', 'osm-node-102', 'osm-node-103'],
  )
})

test('la búsqueda por categoría filtra por radio y ordena por distancia', async () => {
  const items = [
    rawBeach({
      osmId: 1,
      name: 'Cerca',
      latitude: 13.501,
      longitude: -89.3,
      nominatimClass: 'natural',
      nominatimType: 'beach',
    }),
    rawBeach({
      osmId: 2,
      name: 'Lejos',
      latitude: 13.6,
      longitude: -89.3,
      nominatimClass: 'natural',
      nominatimType: 'beach',
    }),
  ]

  const { handler, calls } = makeHandler({
    fake: { searchResult: { source: 'overpass', items } },
  })

  const body = {
    category: 'playas',
    center: { latitude: 13.5, longitude: -89.3 },
    radiusKm: 25,
  }

  const response = await handler(searchRequest(body))

  assert.equal(response.status, 200)
  assert.equal(calls.search[0].category.key, 'playas')
  assert.equal(calls.search[0].radiusMeters, 25000)
  assert.deepEqual(
    response.json.places.map((place) => place.name),
    ['Cerca', 'Lejos'],
  )
  assert.ok(response.json.places[0].distanceMeters < response.json.places[1].distanceMeters)
  assert.deepEqual(response.json.center, { latitude: 13.5, longitude: -89.3 })
  assert.equal(response.json.radiusKm, 25)

  const nearResponse = await handler(searchRequest({ ...body, radiusKm: 5 }))
  assert.deepEqual(
    nearResponse.json.places.map((place) => place.name),
    ['Cerca'],
  )
  assert.equal(calls.search[1].radiusMeters, 5000)
})

test('la búsqueda exige texto o categoría válidos', async () => {
  const empty = makeHandler()
  const emptyResponse = await empty.handler(searchRequest({}))
  assert.equal(emptyResponse.status, 400)
  assert.equal(emptyResponse.json.error.code, ERROR_CODES.INVALID_REQUEST)
  assert.equal(empty.calls.search.length, 0)

  const short = makeHandler()
  const shortResponse = await short.handler(searchRequest({ query: 'a' }))
  assert.equal(shortResponse.status, 400)

  const unknown = makeHandler()
  const unknownResponse = await unknown.handler(searchRequest({ category: 'no-existe' }))
  assert.equal(unknownResponse.status, 400)
  assert.match(unknownResponse.json.error.message, /categoría/i)
})

test('el detalle mapea sitio, teléfono y horario reales de OpenStreetMap', async () => {
  const { handler, calls } = makeHandler({
    fake: {
      detailsResult: {
        osmType: 'node',
        osmId: 123,
        name: 'Hotel X',
        displayName: 'Hotel X, San Salvador, El Salvador',
        latitude: 13.7,
        longitude: -89.2,
        tags: {
          tourism: 'hotel',
          website: 'https://example.org',
          phone: '+503 2222 2222',
          opening_hours: '24/7',
        },
      },
    },
  })

  const response = await handler({
    method: 'GET',
    pathname: '/api/place',
    query: { id: 'osm-node-123' },
    body: {},
    headers: {},
    ip: '203.0.113.2',
  })

  assert.equal(response.status, 200)
  assert.equal(calls.details[0].placeId, 'osm-node-123')
  assert.equal(response.json.place.id, 'osm-node-123')
  assert.equal(response.json.place.website, 'https://example.org/')
  assert.equal(response.json.place.phone, '+503 2222 2222')
  assert.equal(response.json.place.openingHours, '24/7')
  assert.equal('openNow' in response.json.place, false)
})

test('el detalle rechaza identificadores ajenos a OSM y traduce el 404', async () => {
  const invalid = makeHandler()
  const invalidResponse = await invalid.handler({
    method: 'GET',
    pathname: '/api/place',
    query: { id: 'ChIJabcdefghijklmnop' },
    body: {},
    headers: {},
    ip: 'ip',
  })
  assert.equal(invalidResponse.status, 400)

  const missing = makeHandler({
    fake: {
      detailsResult: new AppError(ERROR_CODES.PLACE_NOT_FOUND, { status: 404 }),
    },
  })
  const missingResponse = await missing.handler({
    method: 'GET',
    pathname: '/api/place',
    query: { id: 'osm-node-404' },
    body: {},
    headers: {},
    ip: 'ip',
  })
  assert.equal(missingResponse.status, 404)
  assert.equal(missingResponse.json.error.code, ERROR_CODES.PLACE_NOT_FOUND)
})

test('la referencia de ubicación devuelve coordenadas, etiqueta y fuente', async () => {
  const { handler, calls } = makeHandler({
    fake: {
      locateResult: {
        osmType: 'relation',
        osmId: 1,
        name: 'San Salvador',
        displayName: 'San Salvador, El Salvador',
        latitude: 13.69,
        longitude: -89.19,
        tags: {},
      },
    },
  })

  const response = await handler({
    method: 'POST',
    pathname: '/api/locate',
    body: { query: 'San Salvador' },
    query: {},
    headers: {},
    ip: '203.0.113.3',
  })

  assert.equal(response.status, 200)
  assert.equal(calls.locate[0].query, 'San Salvador')
  assert.deepEqual(response.json.location, { latitude: 13.69, longitude: -89.19 })
  assert.equal(response.json.label, 'San Salvador')
  assert.equal(response.json.address, 'San Salvador, El Salvador')
  assert.equal(response.json.source, 'openstreetmap')

  const short = makeHandler()
  const shortResponse = await short.handler({
    method: 'POST',
    pathname: '/api/locate',
    body: { query: 'ab' },
    query: {},
    headers: {},
    ip: 'ip',
  })
  assert.equal(shortResponse.status, 400)
})

test('la referencia de ubicación traduce LOCATION_NOT_FOUND', async () => {
  const { handler } = makeHandler({
    fake: {
      locateResult: new AppError(ERROR_CODES.LOCATION_NOT_FOUND, { status: 404 }),
    },
  })

  const response = await handler({
    method: 'POST',
    pathname: '/api/locate',
    body: { query: 'Ciudad Inexistente' },
    query: {},
    headers: {},
    ip: 'ip',
  })

  assert.equal(response.status, 404)
  assert.equal(response.json.error.code, ERROR_CODES.LOCATION_NOT_FOUND)
})

test('las búsquedas repetidas se responden desde la caché', async () => {
  const { handler, calls } = makeHandler({
    fake: { searchResult: { source: 'nominatim', items: [rawBeach()] } },
  })

  const first = await handler(searchRequest({ query: 'El Tunco', pageSize: 5 }))
  const second = await handler(searchRequest({ query: 'El Tunco', pageSize: 5 }))

  assert.equal(first.status, 200)
  assert.equal(second.status, 200)
  assert.equal(calls.search.length, 1)
})

test('el límite por IP bloquea ráfagas excesivas', async () => {
  const { handler } = makeHandler({
    fake: { searchResult: { source: 'nominatim', items: [] } },
  })

  for (let index = 0; index < 30; index += 1) {
    const response = await handler(searchRequest({ query: `consulta ${index}` }))
    assert.equal(response.status, 200)
  }

  const blocked = await handler(searchRequest({ query: 'consulta extra' }))
  assert.equal(blocked.status, 429)
  assert.equal(blocked.json.error.code, ERROR_CODES.RATE_LIMITED)
})

test('el origen permitido se exige cuando ALLOWED_ORIGIN está definido', async () => {
  const { handler } = makeHandler({ env: { ALLOWED_ORIGIN: 'https://experiencia.sv' } })

  const blocked = await handler(
    searchRequest({ query: 'playas' }, { headers: { origin: 'https://otro.example' } }),
  )
  assert.equal(blocked.status, 403)
  assert.equal(blocked.json.error.code, ERROR_CODES.FORBIDDEN)

  const allowed = await handler(
    searchRequest({ query: 'playas' }, { headers: { origin: 'https://experiencia.sv' } }),
  )
  assert.equal(allowed.status, 200)
})

test('los errores del proveedor llegan clasificados y sin detalles internos', async () => {
  const logged = []
  const { handler } = makeHandler({
    fake: {
      searchResult: new AppError(ERROR_CODES.UPSTREAM_TIMEOUT, { status: 503 }),
    },
    logError: (context, detail) => logged.push({ context, detail }),
  })

  const response = await handler(searchRequest({ query: 'playas' }))

  assert.equal(response.status, 503)
  assert.equal(response.json.error.code, ERROR_CODES.UPSTREAM_TIMEOUT)
  assert.match(response.json.error.message, /OpenStreetMap/)
  assert.equal(logged.length, 1)
  assert.equal(logged[0].detail.code, ERROR_CODES.UPSTREAM_TIMEOUT)
})

test('un error inesperado del servidor no filtra su mensaje', async () => {
  const logged = []
  const { handler } = makeHandler({
    fake: { searchResult: new Error('detalle interno secreto') },
    logError: (context, detail) => logged.push({ context, detail }),
  })

  const response = await handler(searchRequest({ query: 'playas' }))

  assert.equal(response.status, 500)
  assert.equal(response.json.error.code, ERROR_CODES.INTERNAL)
  assert.ok(!JSON.stringify(response.json).includes('detalle interno secreto'))
  assert.ok(logged.length >= 1)
})

test('los métodos incorrectos y las rutas eliminadas se rechazan', async () => {
  const { handler } = makeHandler()

  const wrongSearch = await handler({
    method: 'GET',
    pathname: '/api/search',
    body: {},
    query: {},
    headers: {},
    ip: 'ip',
  })
  assert.equal(wrongSearch.status, 405)

  const wrongPlace = await handler({
    method: 'POST',
    pathname: '/api/place',
    body: {},
    query: {},
    headers: {},
    ip: 'ip',
  })
  assert.equal(wrongPlace.status, 405)

  const oldPhoto = await handler({
    method: 'GET',
    pathname: '/api/photo',
    body: {},
    query: {},
    headers: {},
    ip: 'ip',
  })
  assert.equal(oldPhoto.status, 404)
  assert.equal(oldPhoto.json.error.code, ERROR_CODES.NOT_FOUND)

  const unknown = await handler({
    method: 'GET',
    pathname: '/api/no-existe',
    body: {},
    query: {},
    headers: {},
    ip: 'ip',
  })
  assert.equal(unknown.status, 404)
})
