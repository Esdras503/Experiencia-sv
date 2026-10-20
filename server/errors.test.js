import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyUpstreamHttpError,
  redactSecrets,
  publicMessageFor,
  ERROR_CODES,
} from './errors.js'

test('clasifica límites, bloqueos y fallos temporales de OpenStreetMap', () => {
  assert.equal(classifyUpstreamHttpError(429).code, ERROR_CODES.UPSTREAM_RATE_LIMITED)
  assert.equal(classifyUpstreamHttpError(403).code, ERROR_CODES.FORBIDDEN)
  assert.equal(classifyUpstreamHttpError(408).code, ERROR_CODES.UPSTREAM_TIMEOUT)
  assert.equal(classifyUpstreamHttpError(504).code, ERROR_CODES.UPSTREAM_TIMEOUT)
  assert.equal(classifyUpstreamHttpError(400).code, ERROR_CODES.UPSTREAM_BAD_REQUEST)
  assert.equal(classifyUpstreamHttpError(422).code, ERROR_CODES.UPSTREAM_BAD_REQUEST)
  assert.equal(classifyUpstreamHttpError(500).code, ERROR_CODES.UPSTREAM_UNAVAILABLE)
  assert.equal(classifyUpstreamHttpError(503).code, ERROR_CODES.UPSTREAM_UNAVAILABLE)
})

test('los errores llevan estado HTTP seguro para el cliente', () => {
  assert.equal(classifyUpstreamHttpError(429).status, 429)
  assert.equal(classifyUpstreamHttpError(403).status, 503)
  assert.equal(classifyUpstreamHttpError(400).status, 502)
  assert.equal(classifyUpstreamHttpError(500).status, 503)
})

test('las credenciales se eliminan de los textos de registro', () => {
  const text =
    'GET https://example.org/v1?key=AIzaSyA1234567890abcdefg&x=1 header x-goog-api-key: AIzaSyZZZ'
  const redacted = redactSecrets(text)

  assert.ok(!redacted.includes('AIza'), 'no debe quedar ninguna clave')
  assert.ok(redacted.includes('key=[redacted]'))
  assert.ok(redacted.includes('x-goog-api-key: [redacted]'))
})

test('todos los códigos públicos tienen mensaje seguro', () => {
  for (const code of Object.values(ERROR_CODES)) {
    const message = publicMessageFor(code)
    assert.ok(typeof message === 'string' && message.length > 0, `sin mensaje para ${code}`)
    assert.ok(!/AIza/.test(message), 'el mensaje no debe incluir datos de claves')
  }
})

test('los mensajes de error mencionan OpenStreetMap cuando corresponde', () => {
  assert.match(publicMessageFor(ERROR_CODES.UPSTREAM_TIMEOUT), /OpenStreetMap/)
  assert.match(publicMessageFor(ERROR_CODES.PLACE_NOT_FOUND), /OpenStreetMap/)
  assert.match(publicMessageFor(ERROR_CODES.LOCATION_NOT_FOUND), /OpenStreetMap/)
})
