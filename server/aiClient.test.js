import test from 'node:test'
import assert from 'node:assert/strict'
import { createAiClient } from './aiClient.js'

// Pruebas del cliente de IA con fetch simulado. No se contacta ningún
// proveedor real ni se usa una clave real.

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function completion(message) {
  return { choices: [{ message, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5 } }
}

function makeClient(fetchImpl, overrides = {}) {
  return createAiClient({
    config: {
      enabled: true,
      apiKey: 'clave-secreta-de-prueba',
      baseUrl: 'https://api.example.org/v1',
      model: 'modelo-de-prueba',
      providerName: 'Proveedor de prueba',
      timeoutMs: 1000,
      maxOutputTokens: 500,
      ...overrides,
    },
    fetchImpl,
    logError: () => {},
  })
}

test('envía el modelo, las herramientas y devuelve la respuesta normalizada', async () => {
  const calls = []
  const client = makeClient(async (url, init) => {
    calls.push({ url, init })
    return jsonResponse(
      200,
      completion({
        content: 'hola',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'search_places', arguments: '{"query":"playa"}' },
            extra_content: { google: { thought_signature: 'firma-opaca' } },
          },
        ],
      }),
    )
  })

  const result = await client.createChatCompletion({
    messages: [{ role: 'user', content: 'hola' }],
    tools: [{ type: 'function', function: { name: 'search_places', parameters: {} } }],
    toolChoice: 'auto',
    responseFormat: { type: 'json_object' },
  })

  const sent = JSON.parse(calls[0].init.body)
  assert.equal(calls[0].url, 'https://api.example.org/v1/chat/completions')
  assert.equal(calls[0].init.headers.Authorization, 'Bearer clave-secreta-de-prueba')
  assert.equal(sent.model, 'modelo-de-prueba')
  assert.equal(sent.tool_choice, 'auto')
  assert.deepEqual(sent.response_format, { type: 'json_object' })
  assert.equal(result.content, 'hola')
  assert.equal(result.toolCalls.length, 1)
  assert.equal(result.toolCalls[0].function.name, 'search_places')
  assert.deepEqual(result.toolCalls[0].extraContent, {
    google: { thought_signature: 'firma-opaca' },
  })
  assert.equal(result.usage.promptTokens, 10)
})

test('envía el esfuerzo de razonamiento solo cuando está configurado', async () => {
  const bodies = []
  const fetchImpl = async (_url, init) => {
    bodies.push(JSON.parse(init.body))
    return jsonResponse(200, completion({ content: 'ok' }))
  }

  await makeClient(fetchImpl, { reasoningEffort: 'low' }).createChatCompletion({ messages: [] })
  await makeClient(fetchImpl).createChatCompletion({ messages: [] })

  assert.equal(bodies[0].reasoning_effort, 'low')
  assert.equal('reasoning_effort' in bodies[1], false)
})

test('traduce cuota, credenciales y errores del proveedor sin filtrar la clave', async () => {
  const quota = makeClient(async () => jsonResponse(429, { error: { message: 'quota' } }))
  await assert.rejects(
    () => quota.createChatCompletion({ messages: [] }),
    (error) => error.code === 'AI_RATE_LIMITED',
  )

  const forbidden = makeClient(async () => jsonResponse(401, { error: { message: 'bad key' } }))
  await assert.rejects(
    () => forbidden.createChatCompletion({ messages: [] }),
    (error) => {
      assert.equal(error.code, 'AI_UNAVAILABLE')
      assert.ok(!error.message.includes('clave-secreta-de-prueba'))
      return true
    },
  )

  const serverError = makeClient(async () => jsonResponse(500, {}))
  await assert.rejects(
    () => serverError.createChatCompletion({ messages: [] }),
    (error) => error.code === 'AI_UNAVAILABLE',
  )
})

test('una respuesta que no es JSON válido se marca como respuesta inválida', async () => {
  const client = makeClient(async () => new Response('no-json', { status: 200 }))
  await assert.rejects(
    () => client.createChatCompletion({ messages: [] }),
    (error) => error.code === 'AI_BAD_RESPONSE',
  )

  const empty = makeClient(async () => jsonResponse(200, { choices: [] }))
  await assert.rejects(
    () => empty.createChatCompletion({ messages: [] }),
    (error) => error.code === 'AI_BAD_RESPONSE',
  )
})

test('un fallo de red se traduce en servicio no disponible', async () => {
  const client = makeClient(async () => {
    throw new TypeError('fetch failed')
  })

  await assert.rejects(
    () => client.createChatCompletion({ messages: [] }),
    (error) => error.code === 'AI_UNAVAILABLE',
  )
})

test('el tiempo de espera agotado se traduce en AI_TIMEOUT', async () => {
  const client = makeClient(
    async (url, init) =>
      new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        })
      }),
    { timeoutMs: 30 },
  )

  await assert.rejects(
    () => client.createChatCompletion({ messages: [] }),
    (error) => error.code === 'AI_TIMEOUT',
  )
})

test('una señal externa cancelada aborta la llamada', async () => {
  let fetchCalled = false
  const client = makeClient(async (url, init) => {
    fetchCalled = true
    if (init.signal.aborted) {
      const error = new Error('aborted')
      error.name = 'AbortError'
      throw error
    }
    return jsonResponse(200, completion({ content: 'ok' }))
  })

  const controller = new AbortController()
  controller.abort()

  await assert.rejects(
    () => client.createChatCompletion({ messages: [], signal: controller.signal }),
    (error) => error.code === 'AI_TIMEOUT',
  )
  assert.equal(fetchCalled, true)
})

test('sin clave configurada no se llama al proveedor', async () => {
  let fetchCalled = false
  const client = createAiClient({
    config: { enabled: false, model: 'x', timeoutMs: 1000, maxOutputTokens: 100 },
    fetchImpl: async () => {
      fetchCalled = true
      return jsonResponse(200, completion({ content: 'x' }))
    },
  })

  assert.equal(client.enabled, false)
  await assert.rejects(
    () => client.createChatCompletion({ messages: [] }),
    (error) => error.code === 'AI_NOT_CONFIGURED',
  )
  assert.equal(fetchCalled, false)
})
