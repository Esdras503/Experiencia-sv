import test from 'node:test'
import assert from 'node:assert/strict'
import { sendChatMessage } from './chatService.js'

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

test('sendChatMessage envía el turno a /api/chat y devuelve el JSON', async () => {
  const calls = []

  await withFetch(
    async (url, options) => {
      calls.push({ url, options })
      return jsonResponse(200, {
        message: 'Hola, encontré lugares reales.',
        places: [{ id: 'osm-node-123', name: 'Playa El Tunco' }],
        suggestions: ['Ver más playas'],
        itinerary: null,
        itineraryToken: null,
      })
    },
    async () => {
      const payload = await sendChatMessage({
        message: '  Recomiéndame playas  ',
        sessionId: 'sesion-123',
        history: [{ role: 'user', content: 'Hola' }],
        itineraryToken: 'token.firma',
      })

      assert.equal(payload.message, 'Hola, encontré lugares reales.')
      assert.equal(payload.places[0].id, 'osm-node-123')

      const body = JSON.parse(calls[0].options.body)
      assert.equal(calls[0].url, '/api/chat')
      assert.equal(calls[0].options.method, 'POST')
      assert.equal(calls[0].options.headers['Content-Type'], 'application/json')
      assert.equal(body.message, 'Recomiéndame playas')
      assert.equal(body.sessionId, 'sesion-123')
      assert.equal(body.itineraryToken, 'token.firma')
      assert.deepEqual(body.history, [{ role: 'user', content: 'Hola' }])
    },
  )
})

test('envía el requestId y el token de sesión sin exponerlos', async () => {
  const calls = []
  const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

  await withFetch(
    async (url, options) => {
      calls.push({ url, options })
      return jsonResponse(200, {
        message: 'Hola',
        usage: { used: 3, limit: 10, remaining: 7 },
      })
    },
    async () => {
      await sendChatMessage(
        { message: 'Hola', requestId },
        { accessToken: 'token-de-sesion-de-prueba' },
      )

      const body = JSON.parse(calls[0].options.body)
      assert.equal(body.requestId, requestId)
      assert.equal(
        calls[0].options.headers.Authorization,
        'Bearer token-de-sesion-de-prueba',
      )
      assert.equal(calls[0].options.headers['Content-Type'], 'application/json')
    },
  )
})

test('un error del API conserva el código, el mensaje y los detalles', async () => {
  await withFetch(
    async () =>
      jsonResponse(429, {
        error: {
          code: 'AI_QUOTA_EXCEEDED',
          message: 'Alcanzaste el límite.',
          details: { used: 10, limit: 10, upgradeUrl: '/planes' },
        },
      }),
    async () => {
      await assert.rejects(
        () => sendChatMessage({ message: 'Hola' }),
        (error) => {
          assert.equal(error.code, 'AI_QUOTA_EXCEEDED')
          assert.equal(error.message, 'Alcanzaste el límite.')
          assert.equal(error.status, 429)
          assert.equal(error.details.upgradeUrl, '/planes')
          return true
        },
      )
    },
  )
})

test('un 5xx sin JSON se trata como error de conexión', async () => {
  await withFetch(
    async () => new Response('', { status: 502 }),
    async () => {
      await assert.rejects(
        () => sendChatMessage({ message: 'Hola' }),
        (error) => error.code === 'NETWORK_ERROR',
      )
    },
  )
})

test('una respuesta sin mensaje se rechaza como respuesta inválida', async () => {
  await withFetch(
    async () => jsonResponse(200, { places: [] }),
    async () => {
      await assert.rejects(
        () => sendChatMessage({ message: 'Hola' }),
        (error) => error.code === 'AI_BAD_RESPONSE',
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
        () => sendChatMessage({ message: 'Hola' }),
        (error) => error.code === 'NETWORK_ERROR',
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
        () => sendChatMessage({ message: 'Hola' }),
        (error) => error.name === 'AbortError',
      )
    },
  )
})

test('rechaza mensajes vacíos sin llamar al servidor', async () => {
  let called = false

  await withFetch(
    async () => {
      called = true
      return jsonResponse(200, { message: 'x' })
    },
    async () => {
      await assert.rejects(
        () => sendChatMessage({ message: '   ' }),
        (error) => error.code === 'INVALID_REQUEST',
      )
    },
  )

  assert.equal(called, false)
})
