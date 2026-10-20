import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOverpassQuery,
  createOsmClient,
  DEFAULT_OSM_USER_AGENT,
  SV_BBOX,
} from './osmClient.js'
import { ERROR_CODES } from './errors.js'

// Respuestas simuladas de Nominatim y Overpass: sirven para comprobar la
// construcción de consultas, el mapeo y el manejo de errores, no representan
// una conexión real.

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }
}

function createFetcher(responses) {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options })
    const next = responses.shift()
    if (next === undefined) throw new Error('respuesta simulada no definida')
    if (typeof next === 'function') return next(url, options)
    return next
  }
  return { fetchImpl, calls }
}

function nominatimPlace(overrides = {}) {
  return {
    osm_type: 'node',
    osm_id: 123,
    lat: '13.49',
    lon: '-89.32',
    display_name: 'Playa El Tunco, La Libertad, El Salvador',
    name: 'Playa El Tunco',
    namedetails: { name: 'Playa El Tunco', 'name:es': 'Playa El Tunco' },
    category: 'natural',
    type: 'beach',
    extratags: { opening_hours: 'Mo-Su 08:00-18:00' },
    ...overrides,
  }
}

test('la búsqueda por texto usa Nominatim con país, idioma y User-Agent', async () => {
  const { fetchImpl, calls } = createFetcher([jsonResponse(200, [nominatimPlace()])])
  const client = createOsmClient({
    fetchImpl,
    userAgent: 'TestApp/1.0 (contacto@example.org)',
    minIntervalMs: 0,
  })

  const result = await client.search({ textQuery: 'El Tunco', pageSize: 10 })

  assert.equal(result.source, 'nominatim')
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].osmType, 'node')
  assert.equal(result.items[0].osmId, 123)
  assert.equal(result.items[0].latitude, 13.49)
  assert.equal(result.items[0].tags.opening_hours, 'Mo-Su 08:00-18:00')

  const url = new URL(calls[0].url)
  assert.equal(url.origin + url.pathname, 'https://nominatim.openstreetmap.org/search')
  assert.equal(url.searchParams.get('q'), 'El Tunco')
  assert.equal(url.searchParams.get('countrycodes'), 'sv')
  assert.equal(url.searchParams.get('accept-language'), 'es')
  assert.equal(url.searchParams.get('extratags'), '1')
  assert.equal(url.searchParams.get('limit'), '10')
  assert.equal(calls[0].options.headers['User-Agent'], 'TestApp/1.0 (contacto@example.org)')
})

test('la búsqueda por texto con centro y radio acota con viewbox y bounded', async () => {
  const { fetchImpl, calls } = createFetcher([jsonResponse(200, [])])
  const client = createOsmClient({ fetchImpl, minIntervalMs: 0 })

  await client.search({
    textQuery: 'parque',
    center: { latitude: 13.7, longitude: -89.2 },
    radiusMeters: 10000,
    pageSize: 5,
  })

  const url = new URL(calls[0].url)
  assert.equal(url.searchParams.get('bounded'), '1')
  const viewbox = url.searchParams.get('viewbox').split(',').map(Number)
  assert.equal(viewbox.length, 4)
  assert.ok(viewbox[0] < -89.2 && viewbox[2] > -89.2, 'el viewbox debe contener el centro')
  assert.ok(viewbox[1] > 13.7 && viewbox[3] < 13.7, 'el viewbox debe contener el centro')
})

test('la búsqueda por categoría usa Overpass con etiquetas y área', async () => {
  const { fetchImpl, calls } = createFetcher([
    jsonResponse(200, {
      elements: [
        {
          type: 'way',
          id: 55,
          center: { lat: 13.4, lon: -89.1 },
          tags: { name: 'Parque Nacional', leisure: 'park' },
        },
      ],
    }),
  ])
  const client = createOsmClient({ fetchImpl, minIntervalMs: 0 })

  const result = await client.search({
    category: { key: 'parques', osmFilters: [{ leisure: 'park' }] },
    center: { latitude: 13.4, longitude: -89.1 },
    radiusMeters: 5000,
    pageSize: 20,
  })

  assert.equal(result.source, 'overpass')
  assert.equal(result.items[0].osmType, 'way')
  assert.equal(result.items[0].latitude, 13.4)
  assert.equal(result.items[0].longitude, -89.1)

  assert.equal(calls[0].url, 'https://overpass-api.de/api/interpreter')
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(
    calls[0].options.headers['Content-Type'],
    'application/x-www-form-urlencoded',
  )

  const query = new URLSearchParams(calls[0].options.body).get('data')
  assert.ok(query.includes('["leisure"="park"]'))
  assert.ok(query.includes('(around:5000,13.4,-89.1)'))
  assert.ok(query.includes('out center 20;'))
})

test('buildOverpassQuery usa el bbox de El Salvador sin centro y escapa el texto', () => {
  const category = { key: 'playas', osmFilters: [{ natural: 'beach' }] }
  const query = buildOverpassQuery({
    category,
    textQuery: 'El Tunco',
    pageSize: 8,
  })

  assert.ok(query.includes('["natural"="beach"]'))
  assert.ok(query.includes(`["name"~"El Tunco",i]`))
  assert.ok(query.includes(`(${SV_BBOX})`))
  assert.ok(query.includes('out center 8;'))
})

test('buildOverpassQuery acepta un timeout más corto para el chat', () => {
  const category = { key: 'playas', osmFilters: [{ natural: 'beach' }] }
  const query = buildOverpassQuery({ category, timeoutSeconds: 9 })

  assert.ok(query.includes('[out:json][timeout:9];'))
})

test('buildOverpassQuery escapa comillas y caracteres especiales del texto', () => {
  const category = { key: 'playas', osmFilters: [{ natural: 'beach' }] }
  const query = buildOverpassQuery({ category, textQuery: 'x"y.z' })

  assert.ok(query.includes('x\\"y'))
  assert.ok(query.includes('\\\\.z') || query.includes('\\.z'))
  assert.ok(!query.includes('name"~"x"y'))
})

test('el detalle consulta Nominatim lookup con el prefijo correcto', async () => {
  const { fetchImpl, calls } = createFetcher([
    jsonResponse(200, [nominatimPlace({ osm_type: 'way', osm_id: 456 })]),
  ])
  const client = createOsmClient({ fetchImpl, minIntervalMs: 0 })

  const item = await client.details('osm-way-456')

  assert.equal(item.osmType, 'way')
  assert.equal(item.osmId, 456)

  const url = new URL(calls[0].url)
  assert.equal(url.origin + url.pathname, 'https://nominatim.openstreetmap.org/lookup')
  assert.equal(url.searchParams.get('osm_ids'), 'W456')
})

test('el detalle cae a Overpass cuando Nominatim no encuentra el elemento', async () => {
  const { fetchImpl, calls } = createFetcher([
    jsonResponse(200, []),
    jsonResponse(200, {
      elements: [
        {
          type: 'node',
          id: 9,
          lat: 13.2,
          lon: -88.9,
          tags: { name: 'Lugar', historic: 'monument' },
        },
      ],
    }),
  ])
  const client = createOsmClient({ fetchImpl, minIntervalMs: 0 })

  const item = await client.details('osm-node-9')

  assert.equal(item.osmType, 'node')
  assert.equal(item.name, 'Lugar')
  assert.equal(calls.length, 2)
  assert.equal(calls[1].url, 'https://overpass-api.de/api/interpreter')
  const query = new URLSearchParams(calls[1].options.body).get('data')
  assert.ok(query.includes('node(9);'))
})

test('el detalle falla con PLACE_NOT_FOUND si no existe en ninguna fuente', async () => {
  const { fetchImpl } = createFetcher([
    jsonResponse(200, []),
    jsonResponse(200, { elements: [] }),
  ])
  const client = createOsmClient({ fetchImpl, minIntervalMs: 0 })

  await assert.rejects(
    () => client.details('osm-node-404'),
    (error) => error.code === ERROR_CODES.PLACE_NOT_FOUND,
  )
})

test('la referencia de ubicación devuelve el primer resultado o falla con LOCATION_NOT_FOUND', async () => {
  const withCity = createFetcher([
    jsonResponse(200, [
      nominatimPlace({
        osm_type: 'relation',
        osm_id: 1,
        lat: '13.69',
        lon: '-89.19',
        display_name: 'San Salvador, El Salvador',
        namedetails: { name: 'San Salvador' },
        category: 'boundary',
        type: 'administrative',
      }),
    ]),
  ])
  const client = createOsmClient({ fetchImpl: withCity.fetchImpl, minIntervalMs: 0 })

  const item = await client.locate('San Salvador')
  assert.equal(item.latitude, 13.69)
  assert.equal(item.name, 'San Salvador')

  const url = new URL(withCity.calls[0].url)
  assert.equal(url.searchParams.get('countrycodes'), 'sv')
  assert.equal(url.searchParams.get('limit'), '1')

  const empty = createFetcher([jsonResponse(200, [])])
  const emptyClient = createOsmClient({ fetchImpl: empty.fetchImpl, minIntervalMs: 0 })
  await assert.rejects(
    () => emptyClient.locate('No existe'),
    (error) => error.code === ERROR_CODES.LOCATION_NOT_FOUND,
  )
})

test('los errores HTTP de OpenStreetMap se clasifican sin filtrar detalles', async () => {
  const cases = [
    [429, ERROR_CODES.UPSTREAM_RATE_LIMITED],
    [403, ERROR_CODES.FORBIDDEN],
    [400, ERROR_CODES.UPSTREAM_BAD_REQUEST],
    [500, ERROR_CODES.UPSTREAM_UNAVAILABLE],
    [503, ERROR_CODES.UPSTREAM_UNAVAILABLE],
  ]

  for (const [status, code] of cases) {
    const { fetchImpl } = createFetcher([jsonResponse(status, { error: 'x' })])
    const client = createOsmClient({ fetchImpl, minIntervalMs: 0 })

    await assert.rejects(
      () => client.search({ textQuery: 'algo', pageSize: 5 }),
      (error) => error.code === code,
      `estado ${status} debería ser ${code}`,
    )
  }
})

test('los errores de red y de tiempo de espera se traducen', async () => {
  const network = createFetcher([
    () => {
      throw new TypeError('fetch failed')
    },
  ])
  const networkClient = createOsmClient({ fetchImpl: network.fetchImpl, minIntervalMs: 0 })
  await assert.rejects(
    () => networkClient.search({ textQuery: 'x', pageSize: 5 }),
    (error) => error.code === ERROR_CODES.NETWORK_ERROR,
  )

  const aborted = createFetcher([
    () => {
      const error = new Error('aborted')
      error.name = 'AbortError'
      throw error
    },
  ])
  const abortedClient = createOsmClient({ fetchImpl: aborted.fetchImpl, minIntervalMs: 0 })
  await assert.rejects(
    () => abortedClient.search({ textQuery: 'x', pageSize: 5 }),
    (error) => error.code === ERROR_CODES.UPSTREAM_TIMEOUT,
  )
})

test('una respuesta con forma inesperada se trata como servicio no disponible', async () => {
  const { fetchImpl } = createFetcher([jsonResponse(200, { unexpected: true })])
  const client = createOsmClient({ fetchImpl, minIntervalMs: 0 })

  await assert.rejects(
    () => client.search({ textQuery: 'x', pageSize: 5 }),
    (error) => error.code === ERROR_CODES.UPSTREAM_UNAVAILABLE,
  )
})

test('el limitador de Nominatim espera entre solicitudes seguidas', async () => {
  const { fetchImpl } = createFetcher([
    jsonResponse(200, []),
    jsonResponse(200, []),
  ])
  const sleeps = []
  const client = createOsmClient({
    fetchImpl,
    now: () => 1000,
    sleep: async (milliseconds) => {
      sleeps.push(milliseconds)
    },
  })

  await client.search({ textQuery: 'uno', pageSize: 5 })
  await client.search({ textQuery: 'dos', pageSize: 5 })

  assert.deepEqual(sleeps, [1100])
})

test('usa el User-Agent por defecto cuando no se configura otro', async () => {
  const { fetchImpl, calls } = createFetcher([jsonResponse(200, [])])
  const client = createOsmClient({ fetchImpl, minIntervalMs: 0 })

  await client.search({ textQuery: 'x', pageSize: 5 })
  assert.equal(calls[0].options.headers['User-Agent'], DEFAULT_OSM_USER_AGENT)
})
