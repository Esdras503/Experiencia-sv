import test from 'node:test'
import assert from 'node:assert/strict'
import { isLikelyServiceRoleKey, readSupabaseConfig } from './supabaseConfig.js'

function makeJwt(payload) {
  const encode = (value) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.firma-de-prueba`
}

test('sin variables devuelve una configuración ausente y no lanza', () => {
  const config = readSupabaseConfig({})
  assert.equal(config.configured, false)
  assert.equal(config.error, 'missing')
  assert.equal(config.url, '')
  assert.equal(config.key, '')
  assert.match(config.message, /VITE_SUPABASE_URL/)
})

test('detecta una configuración incompleta', () => {
  const config = readSupabaseConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co' })
  assert.equal(config.configured, false)
  assert.equal(config.error, 'incomplete')
})

test('acepta HTTPS y normaliza el origen', () => {
  const key = makeJwt({ role: 'anon' })
  const config = readSupabaseConfig({
    VITE_SUPABASE_URL: 'https://abc.supabase.co/',
    VITE_SUPABASE_ANON_KEY: key,
  })
  assert.equal(config.configured, true)
  assert.equal(config.url, 'https://abc.supabase.co')
  assert.equal(config.key, key)
})

test('acepta HTTP solo en localhost', () => {
  const key = makeJwt({ role: 'anon' })
  assert.equal(
    readSupabaseConfig({
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: key,
    }).configured,
    true,
  )
  const remote = readSupabaseConfig({
    VITE_SUPABASE_URL: 'http://supabase.example.com',
    VITE_SUPABASE_ANON_KEY: key,
  })
  assert.equal(remote.configured, false)
  assert.equal(remote.error, 'insecure-url')
})

test('rechaza URLs inválidas', () => {
  const config = readSupabaseConfig({
    VITE_SUPABASE_URL: 'no-es-una-url',
    VITE_SUPABASE_ANON_KEY: 'clave',
  })
  assert.equal(config.configured, false)
  assert.equal(config.error, 'invalid-url')
})

test('admite la variable publishable como alternativa', () => {
  const config = readSupabaseConfig({
    VITE_SUPABASE_URL: 'https://abc.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_publica',
  })
  assert.equal(config.configured, true)

  const withEmptyAnon = readSupabaseConfig({
    VITE_SUPABASE_URL: 'https://abc.supabase.co',
    VITE_SUPABASE_ANON_KEY: '',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_publica',
  })
  assert.equal(withEmptyAnon.configured, true)
})

test('rechaza claves service_role y secretas', () => {
  assert.equal(isLikelyServiceRoleKey(makeJwt({ role: 'service_role' })), true)
  assert.equal(isLikelyServiceRoleKey('sb_secret_123456'), true)
  assert.equal(isLikelyServiceRoleKey(makeJwt({ role: 'anon' })), false)
  assert.equal(isLikelyServiceRoleKey('texto'), false)

  const config = readSupabaseConfig({
    VITE_SUPABASE_URL: 'https://abc.supabase.co',
    VITE_SUPABASE_ANON_KEY: makeJwt({ role: 'service_role' }),
  })
  assert.equal(config.configured, false)
  assert.equal(config.error, 'secret-key')
  assert.doesNotMatch(config.message, /eyJ/)
})
