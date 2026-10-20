export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 72
export const MAX_DISPLAY_NAME_LENGTH = 80
export const MAX_EMAIL_LENGTH = 254
export const DEFAULT_POST_AUTH_PATH = '/itinerarios'

function hasControlCharacters(value) {
  for (const character of value) {
    const code = character.codePointAt(0)
    if (code <= 31 || code === 127) return true
  }
  return false
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function validateEmail(value) {
  const email = normalizeEmail(value)
  if (!email) return 'Escribe tu correo electrónico.'
  if (email.length > MAX_EMAIL_LENGTH) return 'El correo es demasiado largo.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return 'Escribe un correo electrónico válido.'
  }
  return null
}

export function validatePassword(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return 'Escribe una contraseña.'
  }
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    return `La contraseña no puede superar ${MAX_PASSWORD_LENGTH} caracteres.`
  }
  return null
}

export function validatePasswordConfirmation(password, confirmation) {
  if (password !== confirmation) return 'Las contraseñas no coinciden.'
  return null
}

export function validateDisplayName(value, { required = true } = {}) {
  const name = typeof value === 'string' ? value.trim() : ''
  if (!name) return required ? 'Escribe el nombre que quieres mostrar.' : null
  if (name.length < 2) return 'El nombre debe tener al menos 2 caracteres.'
  if (name.length > MAX_DISPLAY_NAME_LENGTH) {
    return `El nombre no puede superar ${MAX_DISPLAY_NAME_LENGTH} caracteres.`
  }
  return null
}

/**
 * Solo permite rutas internas. Evita redirecciones abiertas como //evil.com,
 * URLs absolutas o rutas con barras invertidas que el navegador pueda
 * interpretar de forma distinta.
 */
export function sanitizeRedirectPath(value, fallback = DEFAULT_POST_AUTH_PATH) {
  if (typeof value !== 'string') return fallback
  const candidate = value.trim()
  if (!candidate || candidate.length > 2000) return fallback
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return fallback
  if (candidate.includes('\\') || hasControlCharacters(candidate)) return fallback

  try {
    const parsed = new URL(candidate, 'https://experiencia-sv.invalid')
    if (parsed.origin !== 'https://experiencia-sv.invalid') return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}

export function buildLoginHref(nextPath = DEFAULT_POST_AUTH_PATH) {
  const safeNext = sanitizeRedirectPath(nextPath)
  return `/cuenta/iniciar-sesion?next=${encodeURIComponent(safeNext)}`
}

/**
 * Supabase devuelve los errores de verificación en el fragmento de la URL, por
 * ejemplo #error=access_denied&error_code=otp_expired. No se debe interpretar
 * un enlace fallido como una confirmación correcta solo por el parámetro
 * ?confirmado=1 que añadimos al redirect.
 */
export function parseAuthHashError(hash) {
  if (typeof hash !== 'string' || hash.length === 0) return null

  const value = hash.startsWith('#') ? hash.slice(1) : hash
  if (!value) return null

  let params
  try {
    params = new URLSearchParams(value)
  } catch {
    return null
  }

  const code = params.get('error_code') || params.get('error')
  if (!code || code.length > 80) return null

  return {
    code,
    description: (params.get('error_description') || '').slice(0, 200),
  }
}

/**
 * Mensajes seguros en español para errores de Supabase Auth. No se muestra el
 * mensaje crudo del proveedor ni se revela si un correo existe.
 */
export function describeAuthError(error) {
  const code = typeof error?.code === 'string' ? error.code.toLowerCase() : ''
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : ''
  const status = Number(error?.status)

  if (
    code === 'invalid_credentials' ||
    message.includes('invalid login credentials')
  ) {
    return 'Correo o contraseña incorrectos. Revisa los datos e intenta de nuevo.'
  }

  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.'
  }

  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    message.includes('already registered')
  ) {
    return 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.'
  }

  if (code === 'weak_password' || message.includes('password should be')) {
    return `La contraseña no cumple los requisitos de seguridad (mínimo ${MIN_PASSWORD_LENGTH} caracteres).`
  }

  if (
    code === 'same_password' ||
    code === 'new_password_should_be_different' ||
    message.includes('different from the old')
  ) {
    return 'La nueva contraseña debe ser distinta de la anterior.'
  }

  if (
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    status === 429 ||
    message.includes('rate limit')
  ) {
    return 'Demasiados intentos seguidos. Espera unos minutos antes de volver a intentarlo.'
  }

  if (code === 'email_address_invalid') {
    return 'Ese correo no es válido para crear una cuenta.'
  }

  if (code === 'signup_disabled' || code === 'provider_disabled') {
    return 'El registro con correo está desactivado en este momento.'
  }

  if (code === 'email_provider_disabled') {
    return 'El inicio de sesión con correo está desactivado en este momento.'
  }

  if (
    code === 'session_not_found' ||
    code === 'refresh_token_not_found' ||
    code === 'bad_jwt' ||
    message.includes('jwt expired') ||
    message.includes('invalid refresh token')
  ) {
    return 'Tu sesión expiró o el enlace ya no es válido. Inicia sesión de nuevo.'
  }

  if (
    code === 'flow_state_expired' ||
    code === 'flow_state_not_found' ||
    message.includes('expired') ||
    message.includes('invalid flow state')
  ) {
    return 'El enlace ha caducado o ya se utilizó. Solicita uno nuevo.'
  }

  if (
    code === 'captcha_failed' ||
    message.includes('captcha')
  ) {
    return 'No se pudo completar la verificación de seguridad. Intenta de nuevo.'
  }

  if (
    error?.name === 'AuthRetryableFetchError' ||
    code === 'request_timeout' ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('fetch failed')
  ) {
    return 'No se pudo conectar con el servicio de cuentas. Revisa tu conexión e intenta de nuevo.'
  }

  return 'No se pudo completar la operación. Intenta de nuevo en unos momentos.'
}
