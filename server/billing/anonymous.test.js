import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ANONYMOUS_COOKIE_NAME,
  buildAnonymousCookie,
  hashAnonymousId,
  resolveAnonymousIdentity,
  verifyAnonymousValue,
} from './anonymous.js'

const SECRET = 'secreto-de-pruebas-con-longitud-suficiente'

test('firma y verifica una identidad anónima sin exponer el identificador', () => {
  const id = '0123456789abcdef0123456789abcdef'
  const cookie = buildAnonymousCookie(id, { secret: SECRET })
  assert.match(cookie, new RegExp(`^${ANONYMOUS_COOKIE_NAME}=`))
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /SameSite=Lax/)
  assert.match(cookie, /Max-Age=/)

  const value = cookie.split(';')[0].split('=')[1]
  assert.equal(verifyAnonymousValue(value, SECRET), id)
  assert.equal(verifyAnonymousValue(value, 'otro-secreto-suficientemente-largo'), null)
  assert.equal(verifyAnonymousValue(`${value}0`, SECRET), null)
  assert.equal(hashAnonymousId(id).length, 64)
  assert.notEqual(hashAnonymousId(id), id)
})

test('reutiliza una cookie válida y crea una nueva si falta o está manipulada', () => {
  const id = 'fedcba9876543210fedcba9876543210'
  const cookie = buildAnonymousCookie(id, { secret: SECRET })
  const header = cookie.split(';')[0]

  const reused = resolveAnonymousIdentity({
    headers: { cookie: header },
    secret: SECRET,
  })
  assert.equal(reused.anonymousKey, hashAnonymousId(id))
  assert.equal(reused.setCookie, null)

  const forged = resolveAnonymousIdentity({
    headers: { cookie: `${ANONYMOUS_COOKIE_NAME}=${id}.${'0'.repeat(64)}` },
    secret: SECRET,
  })
  assert.notEqual(forged.anonymousKey, hashAnonymousId(id))
  assert.ok(forged.setCookie)

  const missing = resolveAnonymousIdentity({ headers: {}, secret: SECRET })
  assert.equal(missing.anonymousKey.length, 64)
  assert.ok(missing.setCookie)
  assert.notEqual(missing.anonymousKey, forged.anonymousKey)
})

test('la cookie se marca Secure cuando el entorno lo requiere', () => {
  const id = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const cookie = buildAnonymousCookie(id, { secret: SECRET, secure: true })
  assert.match(cookie, /; Secure/)
})
