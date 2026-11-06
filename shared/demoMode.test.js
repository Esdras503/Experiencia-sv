import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEMO_MODE_BANNER,
  DEMO_MODE_ENV_VAR,
  parseDemoMode,
  resolveDemoMode,
} from './demoMode.js'

test('interpreta el indicador de demostración solo con valores explícitos', () => {
  assert.equal(DEMO_MODE_ENV_VAR, 'VITE_DEMO_MODE')
  assert.equal(parseDemoMode('true'), true)
  assert.equal(parseDemoMode('1'), true)
  assert.equal(parseDemoMode(' YES '), true)
  assert.equal(parseDemoMode('false'), false)
  assert.equal(parseDemoMode('0'), false)
  assert.equal(parseDemoMode('quizá'), false)
  assert.equal(parseDemoMode(undefined), false)
  assert.equal(parseDemoMode(null), false)
  assert.equal(parseDemoMode(true), true)
  assert.equal(parseDemoMode(false), false)
  assert.equal(resolveDemoMode({ VITE_DEMO_MODE: 'true' }), true)
  assert.equal(resolveDemoMode({ VITE_DEMO_MODE: 'false' }), false)
  assert.equal(resolveDemoMode({ DEMO_MODE: 'true' }), true)
  assert.equal(resolveDemoMode({ DEMO_MODE: 'false' }), false)
  assert.equal(
    resolveDemoMode({ VITE_DEMO_MODE: 'false', DEMO_MODE: 'true' }),
    false,
    'VITE_DEMO_MODE explícita tiene prioridad sobre el alias de runtime',
  )
  assert.equal(resolveDemoMode({ VITE_DEMO_MODE: '', DEMO_MODE: 'true' }), true)
  assert.equal(resolveDemoMode({}), false)
})

test('el aviso visual del modo demostración es claro y no promete cobros', () => {
  assert.match(DEMO_MODE_BANNER, /todas las funciones/i)
  assert.match(DEMO_MODE_BANNER, /gratuitamente/i)
  assert.doesNotMatch(DEMO_MODE_BANNER, /pago|tarjeta|cobro/i)
})
