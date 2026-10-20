export const ERROR_CODES = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  RATE_LIMITED: 'RATE_LIMITED',
  UPSTREAM_RATE_LIMITED: 'UPSTREAM_RATE_LIMITED',
  FORBIDDEN: 'FORBIDDEN',
  UPSTREAM_BAD_REQUEST: 'UPSTREAM_BAD_REQUEST',
  UPSTREAM_TIMEOUT: 'UPSTREAM_TIMEOUT',
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PLACE_NOT_FOUND: 'PLACE_NOT_FOUND',
  LOCATION_NOT_FOUND: 'LOCATION_NOT_FOUND',
  AI_NOT_CONFIGURED: 'AI_NOT_CONFIGURED',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_BAD_RESPONSE: 'AI_BAD_RESPONSE',
  CHAT_BUSY: 'CHAT_BUSY',
  INTERNAL: 'INTERNAL',
}

const PUBLIC_MESSAGES = {
  [ERROR_CODES.INVALID_REQUEST]: 'La solicitud no es válida.',
  [ERROR_CODES.NOT_FOUND]: 'El recurso solicitado no existe.',
  [ERROR_CODES.METHOD_NOT_ALLOWED]: 'Método no permitido.',
  [ERROR_CODES.RATE_LIMITED]:
    'Demasiadas solicitudes seguidas. Espera un momento e intenta de nuevo.',
  [ERROR_CODES.UPSTREAM_RATE_LIMITED]:
    'OpenStreetMap limitó temporalmente las solicitudes. Intenta de nuevo en unos minutos.',
  [ERROR_CODES.FORBIDDEN]:
    'OpenStreetMap rechazó la solicitud. Intenta más tarde o revisa la identificación de la aplicación.',
  [ERROR_CODES.UPSTREAM_BAD_REQUEST]:
    'La consulta enviada a OpenStreetMap no es válida. Ajusta la búsqueda e intenta de nuevo.',
  [ERROR_CODES.UPSTREAM_TIMEOUT]:
    'OpenStreetMap no respondió a tiempo. Revisa la conexión e intenta de nuevo.',
  [ERROR_CODES.UPSTREAM_UNAVAILABLE]:
    'El servicio de OpenStreetMap no está disponible en este momento. Intenta más tarde.',
  [ERROR_CODES.NETWORK_ERROR]: 'No se pudo contactar al servicio de OpenStreetMap.',
  [ERROR_CODES.PLACE_NOT_FOUND]: 'No encontramos este lugar en OpenStreetMap.',
  [ERROR_CODES.LOCATION_NOT_FOUND]:
    'No encontramos esa ubicación en OpenStreetMap. Prueba con otro nombre o municipio.',
  [ERROR_CODES.AI_NOT_CONFIGURED]:
    'El asistente de IA no está configurado en este entorno. La búsqueda de lugares sigue disponible.',
  [ERROR_CODES.AI_UNAVAILABLE]:
    'El asistente no está disponible en este momento. Intenta de nuevo en unos minutos.',
  [ERROR_CODES.AI_RATE_LIMITED]:
    'El asistente recibió demasiadas solicitudes. Espera un momento e intenta de nuevo.',
  [ERROR_CODES.AI_TIMEOUT]:
    'El asistente tardó demasiado en responder. Intenta de nuevo con una consulta más breve.',
  [ERROR_CODES.AI_BAD_RESPONSE]:
    'El asistente no devolvió una respuesta válida. Intenta reformular tu mensaje.',
  [ERROR_CODES.CHAT_BUSY]:
    'El asistente está atendiendo otras conversaciones. Intenta de nuevo en unos segundos.',
  [ERROR_CODES.INTERNAL]: 'Ocurrió un error inesperado en el servidor.',
}

export class AppError extends Error {
  constructor(code, { status = 500, message } = {}) {
    super(message ?? PUBLIC_MESSAGES[code] ?? PUBLIC_MESSAGES[ERROR_CODES.INTERNAL])
    this.name = 'AppError'
    this.code = code
    this.status = status
  }
}

export function publicMessageFor(code) {
  return PUBLIC_MESSAGES[code] ?? PUBLIC_MESSAGES[ERROR_CODES.INTERNAL]
}

/**
 * Elimina credenciales de cualquier texto antes de registrarlo. OpenStreetMap
 * no usa claves, pero se mantiene la redacción como defensa ante parámetros
 * accidentales.
 */
export function redactSecrets(text = '') {
  return String(text)
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[redacted-key]')
    .replace(/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}/g, '[redacted-key]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [redacted]')
    .replace(/([?&]key=)[^&\s"']+/gi, '$1[redacted]')
    .replace(/(x-goog-api-key["']?\s*[:=]\s*["']?)[^"',\s}]+/gi, '$1[redacted]')
    .replace(/(authorization["']?\s*[:=]\s*["']?(?:bearer\s+)?)[^"',\s}]+/gi, '$1[redacted]')
}

/**
 * Traduce un estado HTTP de Nominatim/Overpass a un error público seguro.
 */
export function classifyUpstreamHttpError(status) {
  if (status === 429) {
    return new AppError(ERROR_CODES.UPSTREAM_RATE_LIMITED, { status: 429 })
  }
  if (status === 401 || status === 403) {
    return new AppError(ERROR_CODES.FORBIDDEN, { status: 503 })
  }
  if (status === 408 || status === 504) {
    return new AppError(ERROR_CODES.UPSTREAM_TIMEOUT, { status: 503 })
  }
  if (status === 400 || status === 422) {
    return new AppError(ERROR_CODES.UPSTREAM_BAD_REQUEST, { status: 502 })
  }
  return new AppError(ERROR_CODES.UPSTREAM_UNAVAILABLE, { status: 503 })
}

export function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR'
}
