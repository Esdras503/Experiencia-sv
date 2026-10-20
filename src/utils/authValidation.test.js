import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_POST_AUTH_PATH,
  MAX_DISPLAY_NAME_LENGTH,
  buildLoginHref,
  describeAuthError,
  normalizeEmail,
  parseAuthHashError,
  sanitizeRedirectPath,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from './authValidation.js'
import { parseRoute } from './routes.js'

test('normaliza y valida correos', () => {
  assert.equal(normalizeEmail('  Persona@Example.COM '), 'persona@example.com')
  assert.equal(validateEmail('persona@example.com'), null)
  assert.match(validateEmail('sin-arroba'), /válido/)
  assert.match(validateEmail(''), /Escribe/)
  assert.match(validateEmail('a@b.c'), /válido/)
  assert.match(validateEmail(`${'a'.repeat(250)}@example.com`), /demasiado largo/)
})

test('valida la contraseña con los límites de Supabase', () => {
  assert.equal(validatePassword('12345678'), null)
  assert.match(validatePassword('1234567'), /al menos 8/)
  assert.match(validatePassword(''), /Escribe/)
  assert.match(validatePassword('x'.repeat(73)), /72/)
  assert.equal(validatePasswordConfirmation('abc', 'abc'), null)
  assert.match(validatePasswordConfirmation('abc', 'abd'), /no coinciden/)
})

test('valida el nombre visible sin inventar valores', () => {
  assert.equal(validateDisplayName('Ana'), null)
  assert.match(validateDisplayName(''), /Escribe/)
  assert.match(validateDisplayName('A'), /al menos 2/)
  assert.match(validateDisplayName('x'.repeat(MAX_DISPLAY_NAME_LENGTH + 1)), /80/)
  assert.equal(validateDisplayName('', { required: false }), null)
})

test('solo acepta redirecciones internas seguras', () => {
  assert.equal(sanitizeRedirectPath('/itinerarios'), '/itinerarios')
  assert.equal(sanitizeRedirectPath('/itinerarios?page=2#fin'), '/itinerarios?page=2#fin')
  assert.equal(sanitizeRedirectPath('/cuenta'), '/cuenta')
  assert.equal(sanitizeRedirectPath('https://evil.example'), '/itinerarios')
  assert.equal(sanitizeRedirectPath('//evil.example'), '/itinerarios')
  assert.equal(sanitizeRedirectPath('/\\evil.example'), '/itinerarios')
  assert.equal(sanitizeRedirectPath('/\tevil'), '/itinerarios')
  assert.equal(sanitizeRedirectPath('', '/cuenta'), '/cuenta')
  assert.equal(sanitizeRedirectPath(null, '/cuenta'), '/cuenta')
  assert.equal(sanitizeRedirectPath(`/${'a'.repeat(2100)}`), '/itinerarios')
})

test('la ruta por defecto tras autenticarse existe en la aplicación', () => {
  assert.deepEqual(parseRoute(DEFAULT_POST_AUTH_PATH), { name: 'itineraries' })
})

test('detecta errores de confirmación en el fragmento de Supabase', () => {
  assert.equal(parseAuthHashError(''), null)
  assert.equal(parseAuthHashError('#'), null)
  assert.equal(parseAuthHashError('#access_token=abc&refresh_token=def'), null)
  assert.deepEqual(
    parseAuthHashError(
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    ),
    {
      code: 'otp_expired',
      description: 'Email link is invalid or has expired',
    },
  )
  assert.equal(
    parseAuthHashError(`#error_code=${'x'.repeat(81)}`),
    null,
  )
})

test('construye el enlace de login sin abrir redirecciones', () => {
  assert.equal(
    buildLoginHref('/itinerarios/abc?x=1'),
    '/cuenta/iniciar-sesion?next=%2Fitinerarios%2Fabc%3Fx%3D1',
  )
  assert.equal(
    buildLoginHref('https://evil.example'),
    '/cuenta/iniciar-sesion?next=%2Fitinerarios',
  )
})

test('traduce errores de autenticación sin revelar detalles internos', () => {
  assert.match(
    describeAuthError({ code: 'invalid_credentials' }),
    /Correo o contraseña incorrectos/,
  )
  assert.match(
    describeAuthError({ code: 'email_not_confirmed' }),
    /confirmar tu correo/,
  )
  assert.match(
    describeAuthError({ code: 'weak_password' }),
    /requisitos de seguridad/,
  )
  assert.match(
    describeAuthError({ code: 'over_email_send_rate_limit' }),
    /Demasiados intentos/,
  )
  assert.match(
    describeAuthError({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }),
    /No se pudo conectar/,
  )
  assert.match(
    describeAuthError({ code: 'flow_state_expired' }),
    /caducado/,
  )
  assert.match(describeAuthError({ code: 'algo_interno', message: 'SQL secreto' }), /No se pudo completar/)
  assert.doesNotMatch(
    describeAuthError({ code: 'algo_interno', message: 'SQL secreto' }),
    /SQL secreto/,
  )
})
