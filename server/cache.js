/**
 * Caché en memoria con tiempo de vida corto.
 *
 * Las políticas de uso de Nominatim piden almacenar en caché los resultados
 * y no repetir solicitudes idénticas; los datos de OpenStreetMap (ODbL)
 * pueden conservarse con atribución. Esta caché solo dura lo que vive la
 * instancia (en serverless cada instancia tiene la suya).
 */
export function createTtlCache({ ttlMs, maxEntries = 200, now = Date.now }) {
  const entries = new Map()

  function get(key) {
    const entry = entries.get(key)
    if (!entry) return undefined
    if (now() - entry.storedAt > ttlMs) {
      entries.delete(key)
      return undefined
    }
    return entry.value
  }

  function set(key, value) {
    if (entries.size >= maxEntries) {
      const oldestKey = entries.keys().next().value
      if (oldestKey !== undefined) entries.delete(oldestKey)
    }
    entries.set(key, { value, storedAt: now() })
  }

  return { get, set }
}
