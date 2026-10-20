import {
  MAX_CHAT_HISTORY_CHARS,
  MAX_CHAT_HISTORY_MESSAGES,
  MAX_CHAT_MESSAGE_LENGTH,
} from '../shared/chat.js'
import { assertPlainObject, invalidRequest } from './validation.js'

const MAX_RAW_HISTORY_ITEMS = 20
const MAX_HISTORY_ASSISTANT_LENGTH = 2500
const MAX_SESSION_ID_LENGTH = 80
// Un itinerario de 6 paradas con textos largos de OSM puede superar los 12 000
// caracteres al codificarse en base64url. El límite deja margen para que el
// propio token emitido por el servidor siga siendo aceptado en el turno
// siguiente. El cuerpo HTTP admite 48 KB.
const MAX_ITINERARY_TOKEN_LENGTH = 24000
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

// Los mensajes de chat sí admiten saltos de línea y tabulaciones. El resto de
// caracteres de control se rechaza para evitar contenido malformado.
function hasDisallowedControlChars(value) {
  for (const character of value) {
    const code = character.codePointAt(0)
    if ((code <= 31 && code !== 10 && code !== 9) || code === 127) return true
  }
  return false
}

function cleanMessage(value, { field, maximum }) {
  if (typeof value !== 'string') {
    throw invalidRequest(`El campo "${field}" debe ser texto.`)
  }

  const cleaned = value.trim()
  if (!cleaned) return ''
  if (cleaned.length > maximum) {
    throw invalidRequest(`El campo "${field}" supera el máximo de ${maximum} caracteres.`)
  }
  if (hasDisallowedControlChars(cleaned)) {
    throw invalidRequest(`El campo "${field}" contiene caracteres no permitidos.`)
  }

  return cleaned
}

function validateHistory(rawHistory) {
  if (rawHistory === undefined || rawHistory === null) return []
  if (!Array.isArray(rawHistory)) {
    throw invalidRequest('El historial debe ser una lista de mensajes.')
  }
  if (rawHistory.length > MAX_RAW_HISTORY_ITEMS) {
    throw invalidRequest('El historial enviado es demasiado largo.')
  }

  const normalized = []

  for (const item of rawHistory) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw invalidRequest('Cada mensaje del historial debe ser un objeto.')
    }
    if (item.role !== 'user' && item.role !== 'assistant') {
      throw invalidRequest('El historial solo puede contener mensajes de usuario o asistente.')
    }

    const content = cleanMessage(item.content, {
      field: 'historial',
      maximum:
        item.role === 'user' ? MAX_CHAT_MESSAGE_LENGTH : MAX_HISTORY_ASSISTANT_LENGTH,
    })

    if (content) normalized.push({ role: item.role, content })
  }

  // Se conservan los mensajes más recientes, que son los que dan contexto útil.
  const recent = normalized.slice(-MAX_CHAT_HISTORY_MESSAGES)
  const capped = []
  let totalChars = 0

  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const item = recent[index]
    if (totalChars + item.content.length > MAX_CHAT_HISTORY_CHARS) break
    capped.unshift(item)
    totalChars += item.content.length
  }

  return capped
}

function validateSessionId(value) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length > MAX_SESSION_ID_LENGTH || !SESSION_ID_PATTERN.test(trimmed)) return null
  return trimmed
}

function validateItineraryToken(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') {
    throw invalidRequest('El itinerario adjunto no es válido.')
  }

  const trimmed = value.trim()
  if (trimmed.length > MAX_ITINERARY_TOKEN_LENGTH || !TOKEN_PATTERN.test(trimmed)) {
    throw invalidRequest('El itinerario adjunto no es válido.')
  }

  return trimmed
}

export function validateChatRequest(input) {
  const raw = assertPlainObject(input, 'body')
  const message = cleanMessage(raw.message, {
    field: 'message',
    maximum: MAX_CHAT_MESSAGE_LENGTH,
  })

  if (!message) {
    throw invalidRequest('Escribe un mensaje antes de enviar.')
  }

  return {
    message,
    history: validateHistory(raw.history),
    sessionId: validateSessionId(raw.sessionId),
    itineraryToken: validateItineraryToken(raw.itineraryToken),
  }
}
