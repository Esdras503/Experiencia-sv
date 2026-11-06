import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createBillingService,
  resolveBillingConfig,
} from './billingService.js'
import { createPaymentProvider } from './paymentProvider.js'

const URL = 'https://example.supabase.co'
const ANON = 'anon-publica-de-pruebas'
const SERVICE = 'service-role-de-pruebas'

test('la facturación solo se activa con credenciales de servidor', () => {
  const missing = resolveBillingConfig({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_ANON_KEY: ANON })
  assert.equal(missing.enabled, false)
  assert.equal(missing.configured, false)

  const disabled = resolveBillingConfig({
    SUPABASE_URL: URL,
    SUPABASE_ANON_KEY: ANON,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE,
    BILLING_ENABLED: 'false',
  })
  assert.equal(disabled.enabled, false)
  assert.equal(disabled.configured, true)

  const enabled = resolveBillingConfig({
    SUPABASE_URL: URL,
    SUPABASE_ANON_KEY: ANON,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE,
    BILLING_ANONYMOUS_SECRET: 'secreto-anonimo-suficientemente-largo',
  })
  assert.equal(enabled.enabled, true)
  assert.equal(enabled.paymentsEnabled, false)
  assert.equal(enabled.secureCookies, false)
})

test('sin configuración el servicio no bloquea el chat y no expone consumo', async () => {
  const service = createBillingService({ env: {} })
  assert.equal(service.enabled, false)
  assert.equal(service.paymentsEnabled, false)

  const status = await service.getStatus({ headers: {} })
  assert.equal(status.status.enabled, false)
  assert.equal(status.status.plan.id, 'explorador')
  assert.equal(status.status.usage, null)
  assert.equal(status.setCookie, null)

  const reservation = await service.reserveChat({
    context: { userId: null, anonymousKey: null },
    requestId: '11111111-1111-4111-8111-111111111111',
  })
  assert.equal(reservation.allowed, true)
  assert.equal(reservation.usage, null)
})

test('la pasarela permanece deshabilitada y no simula checkout', async () => {
  const provider = createPaymentProvider()
  assert.equal(provider.enabled, false)
  await assert.rejects(
    () => provider.createCheckout({ planId: 'pro' }),
    (error) => error.code === 'PAYMENTS_NOT_CONFIGURED' && error.status === 503,
  )
  assert.deepEqual(await provider.parseWebhook({}), {
    accepted: false,
    reason: 'not_configured',
  })
})
