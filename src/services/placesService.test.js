import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, getApiConfig, searchPlaces } from './placesService.js'

// fetch simulado: comprueba el contrato del cliente sin llamar al API real.

async function withFetch(fakeFetch, run) {
  const original = globalThis.fetch
  globalThis.fetch = fakeFetch
  try {
    return await run()
  } finally {
    globalThis.fetch = original
  }
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

test('searchPlaces envía el cuerpo a /api/search y devuelve el JSON', async () => {
  const calls = []

  await withFetch(
    async (url, options) => {
      calls.push({ url, options })
      return jsonResponse(200, { places: [], source: 'openstreetmap' })
    },
    async () => {
      const payload = await searchPlaces({
        query: 'El Tunco',
        category: 'playas',
        center: { latitude: 13.5, longitude: -89.3 },
        radiusKm: 10,
      })
      assert.deepEqual(payload.places, [])
    },
  )

  assert.equal(calls[0].url, '/api/search')
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json')

  const body = JSON.parse(calls[0].options.body)
  assert.equal(body.query, 'El Tunco')
  assert.equal(body.category, 'playas')
  assert.deepEqual(body.center, { latitude: 13.5, longitude: -89.3 })
  assert.equal(body.radiusKm, 10)
})

test('getApiConfig no envía cuerpo y lee /api/config', async () => {
  const calls = []

  await withFetch(
    async (url, options) => {
      calls.push({ url, options })
      return jsonResponse(200, { configured: true })
    },
    async () => {
      const payload = await getApiConfig()
      assert.equal(payload.configured, true)
    },
  )

  assert.equal(calls[0].url, '/api/config')
  assert.equal(calls[0].options.body, undefined)
  assert.equal(calls[0].options.headers, undefined)
})

test('un error JSON del API conserva el código y el mensaje', async () => {
  await withFetch(
    async () => jsonResponse(503, { error: { code: 'UPSTREAM_TIMEOUT', message: 'Tardó.' } }),
    async () => {
      await assert.rejects(
        () => searchPlaces({ query: 'x' }),
        (error) =>
          error instanceof ApiError &&
          error.code === 'UPSTREAM_TIMEOUT' &&
          error.message === 'Tardó.' &&
          error.status === 503,
      )
    },
  )
})

test('un 5xx sin JSON se trata como error de conexión', async () => {
  await withFetch(
    async () => new Response('<html>Error</html>', { status: 500 }),
    async () => {
      await assert.rejects(
        () => getApiConfig(),
        (error) => error instanceof ApiError && error.code === 'NETWORK_ERROR',
      )
    },
  )
})

test('un fallo de red se convierte en ApiError de red', async () => {
  await withFetch(
    async () => {
      throw new TypeError('fetch failed')
    },
    async () => {
      await assert.rejects(
        () => searchPlaces({ query: 'x' }),
        (error) => error instanceof ApiError && error.code === 'NETWORK_ERROR',
      )
    },
  )
})

test('la cancelación conserva el AbortError original', async () => {
  await withFetch(
    async () => {
      const error = new Error('aborted')
      error.name = 'AbortError'
      throw error
    },
    async () => {
      await assert.rejects(
        () => searchPlaces({ query: 'x' }),
        (error) => error.name === 'AbortError',
      )
    },
  )
})
