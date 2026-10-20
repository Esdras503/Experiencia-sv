import { AppError, ERROR_CODES, isAbortError } from './errors.js'

const MAX_TOOL_CALLS_PER_RESPONSE = 8
const MAX_CONTENT_LENGTH = 20000
const MAX_EXTRA_CONTENT_LENGTH = 16000

// Algunos proveedores (por ejemplo Gemini 3) adjuntan datos opacos a cada
// llamada de herramienta, como la firma de pensamiento, y exigen devolverlos en
// el siguiente turno. No se interpretan ni se exponen: solo se conservan.
function normalizeExtraContent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  try {
    const serialized = JSON.stringify(value)
    if (!serialized || serialized.length > MAX_EXTRA_CONTENT_LENGTH) return null
    return JSON.parse(serialized)
  } catch {
    return null
  }
}

function classifyAiHttpError(status) {
  if (status === 429) {
    return new AppError(ERROR_CODES.AI_RATE_LIMITED, { status: 429 })
  }
  if (status === 408 || status === 504) {
    return new AppError(ERROR_CODES.AI_TIMEOUT, { status: 503 })
  }
  if (status === 400 || status === 422) {
    return new AppError(ERROR_CODES.AI_UNAVAILABLE, { status: 503 })
  }
  return new AppError(ERROR_CODES.AI_UNAVAILABLE, { status: 503 })
}

function normalizeToolCalls(rawToolCalls) {
  if (rawToolCalls === undefined || rawToolCalls === null) return []

  if (!Array.isArray(rawToolCalls) || rawToolCalls.length > MAX_TOOL_CALLS_PER_RESPONSE) {
    throw new AppError(ERROR_CODES.AI_BAD_RESPONSE, { status: 502 })
  }

  return rawToolCalls.map((call) => {
    const id = typeof call?.id === 'string' ? call.id.trim() : ''
    const name = typeof call?.function?.name === 'string' ? call.function.name.trim() : ''
    const args = typeof call?.function?.arguments === 'string' ? call.function.arguments : ''

    if (!id || !name) {
      throw new AppError(ERROR_CODES.AI_BAD_RESPONSE, { status: 502 })
    }

    return {
      id: id.slice(0, 120),
      type: 'function',
      function: { name: name.slice(0, 80), arguments: args.slice(0, 12000) },
      extraContent: normalizeExtraContent(call?.extra_content),
    }
  })
}

function normalizeCompletion(payload) {
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null
  const message = choice?.message
  if (!message || typeof message !== 'object') {
    throw new AppError(ERROR_CODES.AI_BAD_RESPONSE, { status: 502 })
  }

  const content = typeof message.content === 'string' ? message.content.slice(0, MAX_CONTENT_LENGTH) : null
  const toolCalls = normalizeToolCalls(message.tool_calls)

  return {
    content,
    toolCalls,
    finishReason: typeof choice?.finish_reason === 'string' ? choice.finish_reason : null,
    usage: {
      promptTokens: Number(payload?.usage?.prompt_tokens) || 0,
      completionTokens: Number(payload?.usage?.completion_tokens) || 0,
    },
  }
}

/**
 * Cliente mínimo de Chat Completions compatible con OpenAI.
 *
 * - La clave solo se envía al proveedor desde el servidor.
 * - No se registran mensajes, prompts ni cabeceras.
 * - Los errores se traducen a códigos públicos; nunca se filtran detalles
 *   internos del proveedor.
 */
export function createAiClient({
  config,
  fetchImpl = fetch,
  logError = console.error,
} = {}) {
  const resolved = config ?? { enabled: false }
  const enabled = Boolean(resolved.enabled && resolved.apiKey)

  async function createChatCompletion({
    messages,
    tools,
    toolChoice,
    responseFormat,
    maxOutputTokens,
    signal,
  }) {
    if (!enabled) {
      throw new AppError(ERROR_CODES.AI_NOT_CONFIGURED, { status: 503 })
    }

    const body = {
      model: resolved.model,
      messages,
      temperature: 0.35,
      max_tokens: maxOutputTokens ?? resolved.maxOutputTokens,
    }

    if (resolved.reasoningEffort) {
      body.reasoning_effort = resolved.reasoningEffort
    }

    if (Array.isArray(tools) && tools.length > 0) {
      body.tools = tools
      body.tool_choice = toolChoice ?? 'auto'
    }

    if (responseFormat) {
      body.response_format = responseFormat
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), resolved.timeoutMs)
    const handleExternalAbort = () => controller.abort()
    if (signal) {
      if (signal.aborted) handleExternalAbort()
      else signal.addEventListener('abort', handleExternalAbort, { once: true })
    }

    try {
      const response = await fetchImpl(`${resolved.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${resolved.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!response.ok) {
        // Solo se registra el estado HTTP: nunca el cuerpo ni la clave.
        logError?.('[ai] el proveedor respondió con error', { status: response.status })
        throw classifyAiHttpError(response.status)
      }

      let payload
      try {
        payload = await response.json()
      } catch {
        throw new AppError(ERROR_CODES.AI_BAD_RESPONSE, { status: 502 })
      }

      return normalizeCompletion(payload)
    } catch (error) {
      if (error instanceof AppError) throw error
      if (isAbortError(error)) {
        throw new AppError(ERROR_CODES.AI_TIMEOUT, { status: 503 })
      }
      throw new AppError(ERROR_CODES.AI_UNAVAILABLE, { status: 503 })
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', handleExternalAbort)
    }
  }

  return {
    enabled,
    providerName: resolved.providerName,
    model: resolved.model,
    createChatCompletion,
  }
}
