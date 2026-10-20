import test from 'node:test'
import assert from 'node:assert/strict'
import { createChatService } from './chatService.js'
import { AppError, ERROR_CODES } from './errors.js'
import { buildItinerary, signItinerary, verifyItineraryToken } from './chatItinerary.js'

// Pruebas del orquestador con un proveedor de IA simulado y un servicio de
// lugares simulado. No se llama a ninguna IA real ni a OpenStreetMap.

const SECRET = 'secreto-de-prueba-suficientemente-largo'

function place(id, overrides = {}) {
  return {
    id,
    name: `Lugar ${id}`,
    address: 'La Libertad, El Salvador',
    category: 'Playa',
    icon: '🏖️',
    location: { latitude: 13.493, longitude: -89.383 },
    distanceMeters: 1200,
    osmUrl: 'https://www.openstreetmap.org/node/1',
    ...overrides,
  }
}

function createFakePlaceService({ searchPlaces = [], detailsPlace = null, locatePayload } = {}) {
  const calls = { search: [], details: [], locate: [] }

  return {
    calls,
    service: {
      async search(input) {
        calls.search.push(input)
        return {
          places: searchPlaces.slice(0, input.pageSize ?? searchPlaces.length),
          dataSource: 'nominatim',
          source: 'openstreetmap',
        }
      },
      async detailsById(placeId) {
        calls.details.push(placeId)
        if (!detailsPlace) {
          throw new AppError(ERROR_CODES.PLACE_NOT_FOUND, { status: 404 })
        }
        return { place: detailsPlace }
      },
      async locate(query) {
        calls.locate.push(query)
        return (
          locatePayload ?? {
            location: { latitude: 13.69, longitude: -89.19 },
            label: 'San Salvador',
            address: 'San Salvador, El Salvador',
          }
        )
      },
    },
  }
}

function createFakeAi(steps) {
  const calls = []
  let index = 0

  return {
    enabled: true,
    providerName: 'FakeAI',
    model: 'fake-1',
    calls,
    async createChatCompletion(input) {
      calls.push(input)
      const step = steps[Math.min(index, steps.length - 1)]
      index += 1
      return typeof step === 'function' ? step(input) : step
    },
  }
}

function toolStep(toolCalls) {
  return { content: null, toolCalls }
}

function finalStep(payload) {
  return { content: JSON.stringify(payload), toolCalls: [] }
}

function makeService({ steps, placeOptions, env = {} } = {}) {
  const fakePlaces = createFakePlaceService(placeOptions)
  const ai = createFakeAi(steps)
  const chatService = createChatService({
    aiClient: ai,
    placeService: fakePlaces.service,
    signingSecret: SECRET,
    env,
    now: () => 1_700_000_000_000,
    logError: () => {},
  })
  return { chatService, ai, places: fakePlaces }
}

const beach = place('osm-node-1', { name: 'Playa El Tunco' })
const lake = place('osm-node-2', {
  name: 'Lago de Coatepeque',
  location: { latitude: 13.87, longitude: -89.55 },
  category: 'Lago o laguna',
  icon: '🌊',
})

test('usa las herramientas, valida los IDs y construye el itinerario', async () => {
  const { chatService, ai, places } = makeService({
    placeOptions: { searchPlaces: [beach, lake] },
    steps: [
      toolStep([
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'search_places', arguments: '{"query":"El Tunco"}' },
          extraContent: { google: { thought_signature: 'firma-opaca' } },
        },
        {
          id: 'call_2',
          type: 'function',
          function: {
            name: 'locate_reference',
            arguments: '{"query":"San Salvador"}',
          },
        },
      ]),
      finalStep({
        message: 'Encontré lugares reales para tu plan.',
        recommendedPlaceIds: [beach.id, lake.id],
        suggestions: ['¿Quieres solo playas?', 'Agrega una parada histórica'],
        itinerary: {
          title: 'Playa y lago en un día',
          summary: 'Dos paradas verificadas.',
          date: null,
          travelers: 2,
          budget: { amount: 60, currency: 'USD', scope: 'total' },
          origin: { label: 'San Salvador', latitude: 13.69, longitude: -89.19 },
          stops: [
            { placeId: beach.id, reason: 'Primera parada junto al mar', visitMinutes: 90 },
            { placeId: lake.id, reason: 'Segunda parada para descansar' },
          ],
          warnings: [],
        },
      }),
    ],
  })

  const result = await chatService.handleChat({
    message: 'Quiero playa y lago',
    history: [{ role: 'user', content: 'Hola' }],
  })

  assert.equal(places.calls.search.length, 1)
  assert.equal(places.calls.locate.length, 1)
  assert.equal(ai.calls.length, 2)

  assert.equal(result.places.length, 2)
  assert.equal(result.places[0].id, beach.id)
  assert.equal(result.places[0].rating, undefined)
  assert.equal(result.itinerary.stops.length, 2)
  assert.equal(result.itinerary.stops[0].visitEstimate, true)
  assert.ok(result.itinerary.stops[1].distanceFromPreviousMeters > 0)
  assert.ok(result.itinerary.warnings.some((warning) => /línea recta/.test(warning)))
  assert.equal(result.meta.source, 'openstreetmap')
  assert.deepEqual(result.meta.dataSources, ['nominatim'])

  // La firma opaca del proveedor (Gemini 3) debe volver en el turno siguiente.
  const assistantToolMessage = ai.calls[1].messages.find(
    (message) => message.role === 'assistant' && Array.isArray(message.tool_calls),
  )
  assert.deepEqual(assistantToolMessage.tool_calls[0].extra_content, {
    google: { thought_signature: 'firma-opaca' },
  })
  assert.equal(assistantToolMessage.tool_calls[1].extra_content, undefined)

  const verified = verifyItineraryToken(result.itineraryToken, {
    secret: SECRET,
    now: 1_700_000_000_000,
  })
  assert.equal(verified.stops[1].place.id, lake.id)
})

test('descarta lugares inventados y no los presenta como resultados', async () => {
  const { chatService } = makeService({
    placeOptions: { searchPlaces: [beach] },
    steps: [
      finalStep({
        message: 'Te recomiendo un lugar increíble que conozco.',
        recommendedPlaceIds: ['osm-node-999'],
        suggestions: [],
        itinerary: {
          title: 'Plan inventado',
          stops: [{ placeId: 'osm-node-999', reason: 'inventado' }],
        },
      }),
    ],
  })

  const result = await chatService.handleChat({ message: 'Recomiéndame algo' })

  assert.deepEqual(result.places, [])
  assert.equal(result.itinerary, null)
  assert.equal(result.itineraryToken, null)
  assert.match(result.message, /No se pudo crear un itinerario con lugares verificados/)
})

test('las modificaciones conservan las paradas del itinerario firmado', async () => {
  const current = buildItinerary(
    {
      title: 'Plan original',
      summary: 'Resumen original',
      stops: [{ placeId: beach.id, reason: 'parada original' }],
    },
    { allowedPlaces: new Map([[beach.id, beach]]) },
  )
  const currentToken = signItinerary(current, { secret: SECRET })

  const { chatService } = makeService({
    placeOptions: { searchPlaces: [lake] },
    steps: [
      toolStep([
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'search_places', arguments: '{"category":"lagos"}' },
        },
      ]),
      finalStep({
        message: 'Agregué el lago y mantuve la playa.',
        recommendedPlaceIds: [beach.id, lake.id],
        suggestions: ['Quita el lago'],
        itinerary: {
          title: 'Plan original',
          stops: [
            { placeId: beach.id, reason: 'parada original' },
            { placeId: lake.id, reason: 'nueva parada' },
          ],
        },
      }),
    ],
  })

  const result = await chatService.handleChat({
    message: 'Agrega un lago',
    itineraryToken: currentToken,
  })

  assert.deepEqual(
    result.itinerary.stops.map((stop) => stop.place.id),
    [beach.id, lake.id],
  )
  assert.equal(result.itinerary.title, 'Plan original')
  assert.ok(result.itinerary.stops[1].distanceFromPreviousMeters > 0)
})

test('limita la cantidad de llamadas a herramientas por turno', async () => {
  const { chatService, ai, places } = makeService({
    placeOptions: { searchPlaces: [beach] },
    steps: [
      toolStep(
        Array.from({ length: 6 }, (_, index) => ({
          id: `call_${index}`,
          type: 'function',
          function: { name: 'search_places', arguments: `{"query":"playa ${index}"}` },
        })),
      ),
      finalStep({
        message: 'Listo.',
        recommendedPlaceIds: [],
        suggestions: [],
        itinerary: null,
      }),
    ],
  })

  const result = await chatService.handleChat({ message: 'Busca varias cosas' })

  assert.ok(places.calls.search.length <= 3)
  assert.equal(ai.calls.length, 2)
  assert.equal(result.message, 'Listo.')
})

test('un error de OpenStreetMap se devuelve como herramienta fallida, sin inventar', async () => {
  const fakePlaces = createFakePlaceService()
  fakePlaces.service.search = async () => {
    throw new AppError(ERROR_CODES.UPSTREAM_UNAVAILABLE, { status: 503 })
  }
  const ai = createFakeAi([
    toolStep([
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'search_places', arguments: '{"query":"playa"}' },
      },
    ]),
    finalStep({
      message: 'No pude consultar OpenStreetMap en este momento.',
      recommendedPlaceIds: [],
      suggestions: ['Intenta de nuevo'],
      itinerary: null,
    }),
  ])
  const chatService = createChatService({
    aiClient: ai,
    placeService: fakePlaces.service,
    signingSecret: SECRET,
    logError: () => {},
  })

  const result = await chatService.handleChat({ message: 'Busca playas' })

  assert.deepEqual(result.places, [])
  assert.equal(result.itinerary, null)
})

test('si Overpass falla, una búsqueda con nombre y categoría se reintenta por nombre', async () => {
  for (const failureCode of [
    ERROR_CODES.UPSTREAM_UNAVAILABLE,
    ERROR_CODES.NETWORK_ERROR,
  ]) {
    const fakePlaces = createFakePlaceService({ searchPlaces: [beach] })
    const calls = []
    fakePlaces.service.search = async (input) => {
      calls.push(input)
      if (input.categoryKey !== 'todos') {
        throw new AppError(failureCode, { status: 503 })
      }
      return { places: [beach], dataSource: 'nominatim', source: 'openstreetmap' }
    }

    const ai = createFakeAi([
      toolStep([
        {
          id: 'call_1',
          type: 'function',
          function: {
            name: 'search_places',
            arguments: '{"query":"Tunco","category":"playas"}',
          },
        },
      ]),
      finalStep({
        message: 'Encontré Playa El Tunco en OpenStreetMap.',
        recommendedPlaceIds: [beach.id],
        suggestions: [],
        itinerary: null,
      }),
    ])

    const chatService = createChatService({
      aiClient: ai,
      placeService: fakePlaces.service,
      signingSecret: SECRET,
      logError: () => {},
    })

    const result = await chatService.handleChat({ message: 'Busca Playa El Tunco' })

    assert.equal(calls.length, 2)
    assert.equal(calls[0].categoryKey, 'playas')
    assert.equal(calls[1].categoryKey, 'todos')
    assert.equal(calls[1].searchText, 'Tunco')
    assert.deepEqual(
      result.places.map((item) => item.id),
      [beach.id],
    )
  }
})

test('no reintenta una búsqueda por categoría si Overpass ya falló en el turno', async () => {
  const fakePlaces = createFakePlaceService({ searchPlaces: [beach] })
  const calls = []
  fakePlaces.service.search = async (input) => {
    calls.push(input)
    throw new AppError(ERROR_CODES.UPSTREAM_TIMEOUT, { status: 503 })
  }

  const ai = createFakeAi([
    toolStep([
      {
        id: 'call_1',
        type: 'function',
        function: {
          name: 'search_places',
          arguments: '{"category":"playas"}',
        },
      },
    ]),
    toolStep([
      {
        id: 'call_2',
        type: 'function',
        function: {
          name: 'search_places',
          arguments: '{"category":"lagos"}',
        },
      },
    ]),
    finalStep({
      message: 'El servicio de categorías no está disponible; dime un lugar concreto.',
      recommendedPlaceIds: [],
      suggestions: ['Busca Playa El Tunco por nombre'],
      itinerary: null,
    }),
  ])

  const chatService = createChatService({
    aiClient: ai,
    placeService: fakePlaces.service,
    signingSecret: SECRET,
    logError: () => {},
  })

  const result = await chatService.handleChat({ message: 'Recomiéndame playas' })

  assert.equal(calls.length, 1, 'la segunda categoría no debe consultar Overpass')
  assert.equal(calls[0].timeoutMs, 10000)
  assert.equal(result.places.length, 0)

  const toolResults = ai.calls
    .at(-1)
    .messages.filter((message) => message.role === 'tool')
    .map((message) => JSON.parse(message.content))
  assert.equal(toolResults.length, 2)
  assert.equal(toolResults[0].error.code, 'TOOL_UNAVAILABLE')
  assert.equal(toolResults[1].error.code, 'TOOL_UNAVAILABLE')
  assert.match(toolResults[1].error.message, /No repitas la búsqueda por categoría/)
})

test('sin configuración de IA no se llama al proveedor', async () => {
  const ai = createFakeAi([finalStep({ message: 'x', recommendedPlaceIds: [] })])
  ai.enabled = false
  const chatService = createChatService({
    aiClient: ai,
    placeService: createFakePlaceService().service,
    signingSecret: SECRET,
    logError: () => {},
  })

  await assert.rejects(
    () => chatService.handleChat({ message: 'hola' }),
    (error) => error.code === ERROR_CODES.AI_NOT_CONFIGURED,
  )
  assert.equal(ai.calls.length, 0)
})

test('propaga los errores del proveedor sin detalles internos', async () => {
  const ai = createFakeAi([
    () => {
      throw new AppError(ERROR_CODES.AI_RATE_LIMITED, { status: 429 })
    },
  ])
  const chatService = createChatService({
    aiClient: ai,
    placeService: createFakePlaceService().service,
    signingSecret: SECRET,
    logError: () => {},
  })

  await assert.rejects(
    () => chatService.handleChat({ message: 'hola' }),
    (error) => error.code === ERROR_CODES.AI_RATE_LIMITED,
  )
})

test('acepta una respuesta JSON directa sin llamada extra de finalización', async () => {
  const { chatService, ai } = makeService({
    steps: [
      finalStep({
        message: 'Hola, soy tu asistente.',
        recommendedPlaceIds: [],
        suggestions: [],
        itinerary: null,
      }),
    ],
  })

  const result = await chatService.handleChat({ message: 'Hola' })

  assert.equal(ai.calls.length, 1)
  assert.equal(result.message, 'Hola, soy tu asistente.')
})

test('si la primera respuesta no es JSON, hace una finalización estructurada', async () => {
  const { chatService, ai } = makeService({
    steps: [
      { content: 'Claro, te ayudo con gusto.', toolCalls: [] },
      finalStep({
        message: 'Respuesta estructurada.',
        recommendedPlaceIds: [],
        suggestions: [],
        itinerary: null,
      }),
    ],
  })

  const result = await chatService.handleChat({ message: 'Hola' })

  assert.equal(ai.calls.length, 2)
  assert.deepEqual(ai.calls[1].responseFormat, { type: 'json_object' })
  assert.equal(result.message, 'Respuesta estructurada.')
})

test('redacta posibles secretos que aparezcan en el texto del asistente', async () => {
  const { chatService } = makeService({
    steps: [
      finalStep({
        message: 'Usa sk-abcdefghijklmnopqrstuvwxyz y Bearer abcdefghijklmnop, no los compartas.',
        recommendedPlaceIds: [],
        suggestions: [],
        itinerary: null,
      }),
    ],
  })

  const result = await chatService.handleChat({ message: 'Hola' })

  assert.ok(!result.message.includes('sk-abcdefghijklmnopqrstuvwxyz'))
  assert.ok(!result.message.includes('Bearer abcdefghijklmnop'))
})

test('los campos ausentes del itinerario quedan en null y sin datos inventados', async () => {
  const { chatService } = makeService({
    placeOptions: { searchPlaces: [beach] },
    steps: [
      toolStep([
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'search_places', arguments: '{"query":"playa"}' },
        },
      ]),
      finalStep({
        message: 'Una parada.',
        recommendedPlaceIds: [beach.id],
        suggestions: [],
        itinerary: {
          title: 'Plan sencillo',
          stops: [{ placeId: beach.id, reason: 'única parada' }],
        },
      }),
    ],
  })

  const result = await chatService.handleChat({ message: 'Planea algo' })

  assert.equal(result.itinerary.date, null)
  assert.equal(result.itinerary.travelers, null)
  assert.equal(result.itinerary.budget, null)
  assert.equal(result.itinerary.stops[0].visitMinutes, null)
  assert.equal(result.itinerary.stops[0].place.rating, undefined)
  assert.equal(result.itinerary.stops[0].place.photo, undefined)
})

test('no acepta una fecha que la persona no mencionó en el mensaje', async () => {
  const payload = {
    message: 'Plan listo.',
    recommendedPlaceIds: [beach.id],
    suggestions: [],
    itinerary: {
      title: 'Plan de playa',
      date: '2026-10-21',
      stops: [{ placeId: beach.id, reason: 'Visitar la playa' }],
    },
  }
  const steps = [
    toolStep([
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'search_places', arguments: '{"query":"Playa El Tunco"}' },
      },
    ]),
    finalStep(payload),
  ]

  const { chatService: withoutDate } = makeService({
    placeOptions: { searchPlaces: [beach] },
    steps,
  })
  const invented = await withoutDate.handleChat({ message: 'Planea un día de playa' })
  assert.equal(invented.itinerary.date, null)

  const { chatService: withDate } = makeService({
    placeOptions: { searchPlaces: [beach] },
    steps,
  })
  const mentioned = await withDate.handleChat({ message: 'Planea para el 21/10/2026' })
  assert.equal(mentioned.itinerary.date, '2026-10-21')
})

test('el plazo duro del turno corta una llamada al proveedor que no responde', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })

  const ai = {
    enabled: true,
    createChatCompletion: () => new Promise(() => {}),
  }
  const chatService = createChatService({
    aiClient: ai,
    placeService: createFakePlaceService().service,
    signingSecret: SECRET,
    env: { CHAT_TIMEOUT_MS: '10000' },
    logError: () => {},
  })

  const assertion = assert.rejects(
    chatService.handleChat({ message: 'Hola' }),
    (error) => error.code === ERROR_CODES.AI_TIMEOUT,
  )

  t.mock.timers.tick(10_000)
  await assertion
})
