import test from 'node:test'
import assert from 'node:assert/strict'
import { createConcurrencyLimiter, createRateLimiter } from './rateLimit.js'
import { createTtlCache } from './cache.js'

test('el limitador permite hasta el límite y luego bloquea', () => {
  let currentTime = 1000
  const limiter = createRateLimiter({ limit: 3, windowMs: 1000, now: () => currentTime })

  assert.equal(limiter.check('ip-1').allowed, true)
  assert.equal(limiter.check('ip-1').allowed, true)
  assert.equal(limiter.check('ip-1').allowed, true)

  const blocked = limiter.check('ip-1')
  assert.equal(blocked.allowed, false)
  assert.ok(blocked.retryAfterSeconds >= 1)

  assert.equal(limiter.check('ip-2').allowed, true)

  currentTime += 1001
  assert.equal(limiter.check('ip-1').allowed, true)
})

test('el limitador de concurrencia libera el espacio al terminar', () => {
  const limiter = createConcurrencyLimiter({ max: 2 })

  const releaseA = limiter.tryAcquire()
  const releaseB = limiter.tryAcquire()
  assert.ok(releaseA)
  assert.ok(releaseB)
  assert.equal(limiter.active, 2)

  assert.equal(limiter.tryAcquire(), null)

  releaseA()
  releaseA()
  assert.equal(limiter.active, 1)

  const releaseC = limiter.tryAcquire()
  assert.ok(releaseC)
  assert.equal(limiter.active, 2)
  releaseB()
  releaseC()
  assert.equal(limiter.active, 0)
})

test('la caché devuelve valores vigentes y expira con el TTL', () => {
  let currentTime = 0
  const cache = createTtlCache({ ttlMs: 100, maxEntries: 2, now: () => currentTime })

  assert.equal(cache.get('a'), undefined)
  cache.set('a', { value: 1 })
  assert.deepEqual(cache.get('a'), { value: 1 })

  currentTime = 101
  assert.equal(cache.get('a'), undefined)

  cache.set('b', 2)
  cache.set('c', 3)
  cache.set('d', 4)
  assert.equal(cache.get('b'), undefined, 'la entrada más antigua se descarta')
  assert.equal(cache.get('d'), 4)
})
