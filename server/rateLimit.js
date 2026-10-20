/**
 * Limitador de solicitudes en memoria (ventana deslizante simple).
 *
 * Nota: en despliegues serverless cada instancia tiene su propia memoria,
 * por lo que este límite reduce el abuso básico pero no sustituye al
 * limitador global de Nominatim (1 solicitud por segundo) ni a un WAF.
 */
/**
 * Limita cuántas operaciones costosas pueden ejecutarse a la vez en esta
 * instancia. No es una cuota global entre instancias serverless.
 */
export function createConcurrencyLimiter({ max }) {
  const limit = Number.isInteger(max) && max > 0 ? max : 1
  let active = 0

  return {
    tryAcquire() {
      if (active >= limit) return null
      active += 1
      let released = false

      return () => {
        if (released) return
        released = true
        active = Math.max(0, active - 1)
      }
    },
    get active() {
      return active
    },
  }
}

export function createRateLimiter({ limit, windowMs, now = Date.now }) {
  const hits = new Map()

  function check(key) {
    const timestamp = now()
    const cutoff = timestamp - windowMs
    const recent = (hits.get(key) ?? []).filter((time) => time > cutoff)

    if (recent.length >= limit) {
      const retryAfterMs = recent[0] + windowMs - timestamp
      hits.set(key, recent)
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      }
    }

    recent.push(timestamp)
    hits.set(key, recent)

    if (hits.size > 5000) {
      for (const [storedKey, times] of hits) {
        if (!times.some((time) => time > cutoff)) {
          hits.delete(storedKey)
        }
      }
    }

    return { allowed: true, retryAfterSeconds: 0 }
  }

  return { check }
}
