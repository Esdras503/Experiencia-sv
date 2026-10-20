import test from 'node:test'
import assert from 'node:assert/strict'
import { AI_CONFIG_DEFAULTS, resolveAiConfig } from './aiConfig.js'

// Pruebas de configuración del proveedor. No usan claves reales.

test('sin variables queda deshabilitado con valores por defecto', () => {
  const config = resolveAiConfig({})

  assert.equal(config.enabled, false)
  assert.equal(config.apiKey, '')
  assert.equal(config.baseUrl, AI_CONFIG_DEFAULTS.baseUrl)
  assert.equal(config.model, AI_CONFIG_DEFAULTS.model)
  assert.equal(config.timeoutMs, AI_CONFIG_DEFAULTS.timeoutMs)
  assert.equal(config.maxOutputTokens, AI_CONFIG_DEFAULTS.maxOutputTokens)
  assert.equal(config.reasoningEffort, null)
})

test('una clave habilita el chat y se recorta la URL', () => {
  const config = resolveAiConfig({
    AI_API_KEY: 'clave-de-ejemplo',
    AI_BASE_URL: 'https://api.example.org/v1/',
    AI_MODEL: 'modelo-ejemplo',
    AI_PROVIDER_NAME: 'Proveedor de ejemplo',
  })

  assert.equal(config.enabled, true)
  assert.equal(config.baseUrl, 'https://api.example.org/v1')
  assert.equal(config.model, 'modelo-ejemplo')
  assert.equal(config.providerName, 'Proveedor de ejemplo')
})

test('acepta solo niveles de razonamiento conocidos', () => {
  assert.equal(resolveAiConfig({ AI_REASONING_EFFORT: 'low' }).reasoningEffort, 'low')
  assert.equal(resolveAiConfig({ AI_REASONING_EFFORT: ' HIGH ' }).reasoningEffort, 'high')
  assert.equal(resolveAiConfig({ AI_REASONING_EFFORT: 'ultra' }).reasoningEffort, null)
  assert.equal(resolveAiConfig({ AI_REASONING_EFFORT: 42 }).reasoningEffort, null)
})

test('rechaza bases HTTP remotas y acepta un modelo local por HTTP', () => {
  const insecure = resolveAiConfig({
    AI_API_KEY: 'x',
    AI_BASE_URL: 'http://api.example.org/v1',
  })
  assert.equal(insecure.baseUrl, AI_CONFIG_DEFAULTS.baseUrl)

  const local = resolveAiConfig({
    AI_API_KEY: 'x',
    AI_BASE_URL: 'http://localhost:11434/v1',
  })
  assert.equal(local.baseUrl, 'http://localhost:11434/v1')
})

test('limita los valores numéricos a rangos seguros', () => {
  const config = resolveAiConfig({
    AI_API_KEY: 'x',
    AI_TIMEOUT_MS: '999999',
    AI_MAX_OUTPUT_TOKENS: '1',
  })

  assert.ok(config.timeoutMs <= 25000)
  assert.ok(config.maxOutputTokens >= 200)
})
