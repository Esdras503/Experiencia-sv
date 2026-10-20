import { MAX_CHAT_PLACES } from '../shared/chat.js'
import { AppError, ERROR_CODES, redactSecrets } from './errors.js'
import { CHAT_TOOLS, createChatToolRunner } from './chatTools.js'
import { buildSystemPrompt, FINAL_RESPONSE_FORMAT } from './chatPrompt.js'
import {
  buildItinerary,
  extractMentionedDates,
  normalizePublicPlace,
  signItinerary,
  verifyItineraryToken,
} from './chatItinerary.js'

const MAX_AI_ROUNDS = 3
const MAX_ASSISTANT_MESSAGE_LENGTH = 2000
const MAX_SUGGESTION_LENGTH = 90
const MAX_SUGGESTIONS = 3
const DEFAULT_CHAT_TIMEOUT_MS = 27_000
const DEFAULT_ITINERARY_TTL_MS = 12 * 60 * 60 * 1000

function clampInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(maximum, Math.max(minimum, parsed))
}

function stripControlCharacters(value) {
  let output = ''

  for (const character of value) {
    const code = character.codePointAt(0)
    if (code === 13) continue
    if (code === 10 || code === 9) {
      output += character
      continue
    }
    if (code <= 31 || code === 127) {
      output += ' '
      continue
    }
    output += character
  }

  return output.replace(/\n{4,}/g, '\n\n\n')
}

function sanitizeAssistantMessage(value) {
  if (typeof value !== 'string') return null
  const cleaned = stripControlCharacters(redactSecrets(value)).trim()
  if (!cleaned) return null
  return cleaned.slice(0, MAX_ASSISTANT_MESSAGE_LENGTH)
}

function sanitizeSuggestions(value) {
  if (!Array.isArray(value)) return []
  const suggestions = []
  const seen = new Set()

  for (const item of value) {
    if (typeof item !== 'string') continue
    const cleaned = stripControlCharacters(item).trim()
    if (cleaned.length < 3 || cleaned.length > MAX_SUGGESTION_LENGTH) continue
    const key = cleaned.toLocaleLowerCase('es')
    if (seen.has(key)) continue
    seen.add(key)
    suggestions.push(cleaned)
    if (suggestions.length >= MAX_SUGGESTIONS) break
  }

  return suggestions
}

function parseToolArguments(rawArguments) {
  if (typeof rawArguments !== 'string' || !rawArguments.trim()) {
    return { ok: false, result: { ok: false, error: { code: 'INVALID_ARGUMENTS', message: 'La herramienta no recibió argumentos válidos.' } } }
  }

  try {
    const value = JSON.parse(rawArguments)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, result: { ok: false, error: { code: 'INVALID_ARGUMENTS', message: 'La herramienta no recibió argumentos válidos.' } } }
    }
    return { ok: true, value }
  } catch {
    return { ok: false, result: { ok: false, error: { code: 'INVALID_ARGUMENTS', message: 'Los argumentos de la herramienta no son JSON válido.' } } }
  }
}

function extractJsonObject(content) {
  const direct = content.trim()
  try {
    return JSON.parse(direct)
  } catch {
    // Algunos modelos añaden texto o bloques de código alrededor del JSON.
  }

  const start = direct.indexOf('{')
  const end = direct.lastIndexOf('}')
  if (start === -1 || end <= start) return null

  try {
    return JSON.parse(direct.slice(start, end + 1))
  } catch {
    return null
  }
}

function parseStructuredResponse(content) {
  if (typeof content !== 'string' || !content.trim()) return null
  const parsed = extractJsonObject(content)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  if (typeof parsed.message !== 'string' || !parsed.message.trim()) return null
  return parsed
}

/**
 * Servicio del chatbot: coordina el proveedor de IA, las herramientas de
 * OpenStreetMap y la validación de la respuesta.
 *
 * El navegador nunca decide qué lugares son reales: los identificadores se
 * filtran aquí contra el catálogo obtenido por las herramientas o contra el
 * itinerario firmado por el servidor.
 */
export function createChatService({
  aiClient,
  placeService,
  signingSecret,
  env = {},
  now = Date.now,
  logError = console.error,
} = {}) {
  const enabled = Boolean(aiClient && aiClient.enabled !== false)
  const maxToolCalls = clampInteger(env.CHAT_MAX_TOOL_CALLS, 5, 1, 6)
  const maxSearches = clampInteger(env.CHAT_MAX_SEARCHES, 3, 1, 4)
  const maxLocates = clampInteger(env.CHAT_MAX_LOCATES, 2, 1, 3)
  const chatTimeoutMs = clampInteger(
    env.CHAT_TIMEOUT_MS,
    DEFAULT_CHAT_TIMEOUT_MS,
    10_000,
    29_000,
  )
  const itineraryTtlMs = clampInteger(
    env.CHAT_ITINERARY_TTL_MS,
    DEFAULT_ITINERARY_TTL_MS,
    5 * 60 * 1000,
    7 * 24 * 60 * 60 * 1000,
  )

  async function handleChat({ message, history = [], itineraryToken = null, signal } = {}) {
    if (!enabled) {
      throw new AppError(ERROR_CODES.AI_NOT_CONFIGURED, { status: 503 })
    }

    const startedAt = now()
    const currentItinerary = itineraryToken
      ? verifyItineraryToken(itineraryToken, { secret: signingSecret, now: now() })
      : null

    const toolRunner = createChatToolRunner({
      placeService,
      now,
      maxToolCalls,
      maxSearches,
      maxLocates,
      logError,
    })

    if (currentItinerary) {
      for (const stop of currentItinerary.stops) {
        toolRunner.registerPlace(stop.place)
      }
    }

    const messages = [
      {
        role: 'system',
        content: buildSystemPrompt({
          currentItinerary,
          today: new Date(now()).toISOString().slice(0, 10),
          maxPlaces: MAX_CHAT_PLACES,
        }),
      },
      ...history.map((item) => ({ role: item.role, content: item.content })),
      { role: 'user', content: message },
    ]

    // Plazo duro del turno: no basta con comprobar el tiempo entre llamadas,
    // porque una llamada al proveedor o a una herramienta puede empezar dentro
    // del presupuesto y terminarlo muy tarde. El temporizador aborta la
    // operación en curso para responder dentro del límite de la función.
    const deadline = new AbortController()
    const deadlineTimer = setTimeout(() => deadline.abort(), chatTimeoutMs)
    const turnSignal = signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal

    function ensureTimeBudget() {
      if (deadline.signal.aborted || now() - startedAt > chatTimeoutMs) {
        throw new AppError(ERROR_CODES.AI_TIMEOUT, { status: 503 })
      }
    }

    // Carrera de respaldo: una herramienta que no acepta señal (por ejemplo,
    // una consulta de Overpass ya iniciada) no puede alargar la respuesta más
    // allá del plazo, aunque su petición siga abierta hasta su propio timeout.
    const deadlinePromise = new Promise((_, reject) => {
      deadline.signal.addEventListener(
        'abort',
        () => reject(new AppError(ERROR_CODES.AI_TIMEOUT, { status: 503 })),
        { once: true },
      )
    })

    let finalPayload = null

    try {
      for (let round = 0; round < MAX_AI_ROUNDS; round += 1) {
        ensureTimeBudget()

        const response = await Promise.race([
          aiClient.createChatCompletion({
            messages,
            tools: CHAT_TOOLS,
            toolChoice: 'auto',
            signal: turnSignal,
          }),
          deadlinePromise,
        ])

        const toolCalls = response.toolCalls ?? []
        if (toolCalls.length === 0) {
          finalPayload = parseStructuredResponse(response.content)
          break
        }

        messages.push({
          role: 'assistant',
          content: response.content ?? null,
          tool_calls: toolCalls.map((call) => {
            const providerCall = {
              id: call.id,
              type: 'function',
              function: {
                name: call.function.name,
                arguments: call.function.arguments,
              },
            }
            // Firma u otros datos opacos del proveedor (Gemini 3 los exige).
            if (call.extraContent) providerCall.extra_content = call.extraContent
            return providerCall
          }),
        })

        for (const call of toolCalls) {
          const args = parseToolArguments(call.function.arguments)
          const result = args.ok
            ? await Promise.race([
                toolRunner.execute(call.function.name, args.value),
                deadlinePromise,
              ])
            : args.result
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result),
          })
        }

        ensureTimeBudget()
      }

      if (!finalPayload) {
        ensureTimeBudget()
        const response = await Promise.race([
          aiClient.createChatCompletion({
            messages,
            responseFormat: FINAL_RESPONSE_FORMAT,
            signal: turnSignal,
          }),
          deadlinePromise,
        ])
        finalPayload = parseStructuredResponse(response.content)
      }
    } catch (error) {
      if (error instanceof AppError) throw error
      // Nunca se registra el contenido de la conversación ni credenciales.
      logError?.('[chat] error inesperado al generar la respuesta', {
        code: error?.code ?? error?.name ?? 'UNKNOWN',
      })
      throw new AppError(ERROR_CODES.AI_UNAVAILABLE, { status: 503 })
    } finally {
      clearTimeout(deadlineTimer)
    }

    if (!finalPayload) {
      throw new AppError(ERROR_CODES.AI_BAD_RESPONSE, { status: 502 })
    }

    const knownPlaces = toolRunner.getKnownPlaces()
    const assistantMessage = sanitizeAssistantMessage(finalPayload.message)
    if (!assistantMessage) {
      throw new AppError(ERROR_CODES.AI_BAD_RESPONSE, { status: 502 })
    }

    const allowedIds = Array.isArray(finalPayload.recommendedPlaceIds)
      ? finalPayload.recommendedPlaceIds
      : []
    const places = []
    const seenPlaceIds = new Set()

    const addPlaceById = (id) => {
      if (typeof id !== 'string' || seenPlaceIds.has(id)) return
      const place = normalizePublicPlace(knownPlaces.get(id))
      if (!place) return
      seenPlaceIds.add(id)
      places.push(place)
    }

    for (const id of allowedIds.slice(0, MAX_CHAT_PLACES)) addPlaceById(id)

    // Si el modelo propuso un itinerario pero no repitió los IDs en la lista
    // de tarjetas, se derivan de las paradas verificadas.
    if (places.length === 0 && finalPayload.itinerary?.stops) {
      for (const stop of finalPayload.itinerary.stops.slice(0, MAX_CHAT_PLACES)) {
        addPlaceById(stop?.placeId)
      }
    }

    const allowedDates = extractMentionedDates(message, {
      today: new Date(now()).toISOString().slice(0, 10),
    })
    const itinerary = buildItinerary(finalPayload.itinerary, {
      allowedPlaces: knownPlaces,
      allowedDates,
      currentItinerary,
      now: now(),
    })

    let messageText = assistantMessage
    if (finalPayload.itinerary && !itinerary) {
      messageText += currentItinerary
        ? '\n\nNo se pudo aplicar el cambio al itinerario con datos verificados; se mantiene el plan anterior.'
        : '\n\nNo se pudo crear un itinerario con lugares verificados. Intenta precisar una zona o categoría.'
    }

    const stats = toolRunner.getStats()
    const itineraryTokenOut = itinerary
      ? signItinerary(itinerary, { secret: signingSecret, now: now(), ttlMs: itineraryTtlMs })
      : null

    return {
      message: messageText,
      places: places.slice(0, MAX_CHAT_PLACES),
      suggestions: sanitizeSuggestions(finalPayload.suggestions),
      itinerary,
      itineraryToken: itineraryTokenOut,
      meta: {
        source: 'openstreetmap',
        provider: aiClient?.providerName ?? null,
        dataSources: stats.dataSources,
        placesFound: knownPlaces.size,
        dataNotice:
          'Los lugares provienen de OpenStreetMap y pueden estar incompletos o desactualizados. OpenStreetMap no incluye calificaciones, reseñas, fotos ni precios.',
      },
    }
  }

  return {
    enabled,
    providerName: aiClient?.providerName ?? null,
    model: aiClient?.model ?? null,
    handleChat,
  }
}
