import { ApiError } from './placesService.js'

const NETWORK_ERROR_MESSAGE =
  'No se pudo contactar al asistente. Revisa tu conexión e intenta de nuevo.'

const EMPTY_RESPONSE_MESSAGE =
  'El asistente no devolvió una respuesta válida. Intenta reformular tu mensaje.'

async function requestChat(payload, { signal } = {}) {
  let response

  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new ApiError('NETWORK_ERROR', NETWORK_ERROR_MESSAGE)
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    if (!data && response.status >= 500) {
      throw new ApiError('NETWORK_ERROR', NETWORK_ERROR_MESSAGE, response.status)
    }

    throw new ApiError(
      data?.error?.code ?? 'INTERNAL',
      data?.error?.message ?? 'No se pudo obtener respuesta del asistente.',
      response.status,
    )
  }

  if (!data || typeof data.message !== 'string' || !data.message.trim()) {
    throw new ApiError('AI_BAD_RESPONSE', EMPTY_RESPONSE_MESSAGE, response.status)
  }

  return data
}

/**
 * Envía un turno de conversación al backend seguro. La clave de IA nunca
 * viaja al navegador.
 *
 * `history` solo contiene turnos de texto; el itinerario viaja en un token
 * firmado (`itineraryToken`) que el servidor valida antes de usarlo.
 */
export async function sendChatMessage(
  { message, sessionId = null, history = [], itineraryToken = null },
  options = {},
) {
  if (typeof message !== 'string' || !message.trim()) {
    throw new ApiError('INVALID_REQUEST', 'Escribe un mensaje antes de enviar.')
  }

  return requestChat(
    {
      message: message.trim(),
      sessionId,
      history: Array.isArray(history) ? history : [],
      itineraryToken: itineraryToken ?? null,
    },
    options,
  )
}
