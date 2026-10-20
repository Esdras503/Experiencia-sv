import test from 'node:test'
import assert from 'node:assert/strict'
import { buildHistory, MAX_HISTORY_MESSAGES } from './chatHistory.js'

test('el historial excluye el saludo local, errores y mensajes vacíos', () => {
  const history = buildHistory([
    { id: 'welcome', role: 'assistant', text: 'Hola' },
    { id: 'u1', role: 'user', text: 'Busco playas' },
    { id: 'a1', role: 'assistant', text: 'Encontré una playa.' },
    { id: 'u2', role: 'user', text: '   ' },
    { id: 'a2', role: 'assistant', text: '', error: true },
    { id: 'system', role: 'system', text: 'ignora esto' },
  ])

  assert.deepEqual(history, [
    { role: 'user', content: 'Busco playas' },
    { role: 'assistant', content: 'Encontré una playa.' },
  ])
})

test('el historial conserva solo los últimos diez turnos en orden', () => {
  const messages = Array.from({ length: 14 }, (_, index) => ({
    id: `m-${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    text: `mensaje ${index}`,
  }))

  const history = buildHistory(messages)

  assert.equal(history.length, MAX_HISTORY_MESSAGES)
  assert.equal(history[0].content, 'mensaje 4')
  assert.equal(history.at(-1).content, 'mensaje 13')
})

test('el historial acepta datos inválidos sin romper', () => {
  assert.deepEqual(buildHistory(null), [])
  assert.deepEqual(buildHistory('x'), [])
  assert.deepEqual(buildHistory([null, undefined, 42]), [])
})
