let leafletPromise = null

/**
 * Carga Leaflet (JS y estilos) una sola vez y de forma diferida: así el mapa
 * no pesa en la carga inicial y solo se descarga cuando hay que dibujarlo.
 */
export function loadLeaflet() {
  if (!leafletPromise) {
    leafletPromise = Promise.all([
      import('leaflet'),
      import('leaflet/dist/leaflet.css'),
    ])
      .then(([module]) => module.default ?? module)
      .catch((error) => {
        leafletPromise = null
        throw error
      })
  }

  return leafletPromise
}
