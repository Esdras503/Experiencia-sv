import { getApiConfig } from './placesService.js'

let configPromise = null

/**
 * Configuración pública del mapa (teselas y atribución), cacheada durante la
 * sesión para no pedir /api/config en cada mapa. Si falla, se vuelve a
 * intentar en la siguiente apertura y los componentes usan el respaldo de OSM.
 */
export function getMapConfig() {
  if (!configPromise) {
    configPromise = getApiConfig()
      .then((config) => ({
        tileUrl: config?.map?.tileUrl ?? null,
        attribution: config?.map?.attribution ?? null,
      }))
      .catch(() => {
        configPromise = null
        return null
      })
  }

  return configPromise
}
