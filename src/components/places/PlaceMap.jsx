import { useEffect, useRef, useState } from 'react'
import { OSM_TILE_ATTRIBUTION, OSM_TILE_URL_DEFAULT } from '../../../shared/osm.js'
import { getMapConfig } from '../../services/mapConfig'
import { loadLeaflet } from '../../services/leafletLoader'
import { buildOsmLink } from '../../utils/placeFormatters'

/**
 * Mapa interactivo con Leaflet y teselas de OpenStreetMap.
 *
 * - No se carga al abrir la página: espera a que la persona pulse «Ver mapa».
 * - OpenStreetMap no usa claves de API; la URL de teselas puede cambiarse con
 *   la variable OSM_TILE_URL para usar otro proveedor.
 * - La atribución «© OpenStreetMap contributors» que dibuja Leaflet no se
 *   oculta ni se cubre.
 * - Si las teselas fallan, el mapa sigue visible y se avisa; si Leaflet no
 *   carga, se ofrece el enlace directo a OpenStreetMap.
 */
export default function PlaceMap({ place }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [tileWarning, setTileWarning] = useState(false)

  const latitude = place?.location?.latitude
  const longitude = place?.location?.longitude
  const placeName = place?.name ?? ''
  const osmLink = buildOsmLink(place)

  useEffect(() => {
    if (attempt === 0) return undefined
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return undefined

    const container = containerRef.current
    if (!container) return undefined

    let cancelled = false

    async function setupMap() {
      const [L, config] = await Promise.all([loadLeaflet(), getMapConfig()])

      if (cancelled || !containerRef.current) return

      if (!L?.map || !L?.tileLayer || !L?.circleMarker) {
        throw new Error('leaflet-unavailable')
      }

      const map = L.map(containerRef.current, {
        center: [latitude, longitude],
        zoom: 15,
        scrollWheelZoom: false,
        worldCopyJump: true,
      })
      mapRef.current = map

      const tileUrl = config?.tileUrl || OSM_TILE_URL_DEFAULT
      const tileAttribution = config?.attribution || OSM_TILE_ATTRIBUTION

      L.tileLayer(tileUrl, {
        attribution: tileAttribution,
        maxZoom: 19,
      }).addTo(map)

      map.on('tileerror', () => {
        if (!cancelled) setTileWarning(true)
      })

      const marker = L.circleMarker([latitude, longitude], {
        radius: 9,
        color: '#ffffff',
        weight: 2,
        fillColor: '#2f6b3f',
        fillOpacity: 1,
      }).addTo(map)

      const popupContent = document.createElement('div')
      popupContent.textContent = placeName || 'Lugar'
      marker.bindPopup(popupContent).openPopup()

      if (!cancelled) setStatus('ready')
    }

    setupMap().catch(() => {
      if (cancelled) return
      setStatus('error')
      setError('No se pudo cargar el mapa. Revisa tu conexión e intenta de nuevo.')
    })

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [attempt, latitude, longitude, placeName])

  const requestMap = () => {
    if (status === 'loading') return
    setError(null)
    setTileWarning(false)
    setStatus('loading')
    setAttempt((value) => value + 1)
  }

  return (
    <div className="place-map">
      {status === 'idle' && (
        <div className="map-unavailable">
          <p>
            El mapa se carga solo cuando lo pides. Usa teselas de OpenStreetMap y muestra la
            atribución obligatoria; no requiere claves ni facturación.
          </p>
          <button type="button" className="button-primary" onClick={requestMap}>
            Ver mapa
          </button>
        </div>
      )}

      {status !== 'idle' && (
        <div className="map-frame">
          <div
            ref={containerRef}
            className="map-canvas"
            role="region"
            aria-label={`Mapa de ${placeName || 'este lugar'}`}
          />

          {status === 'loading' && (
            <p className="map-status map-overlay" role="status">
              Cargando mapa de OpenStreetMap…
            </p>
          )}

          {status === 'error' && (
            <div className="map-error map-overlay" role="alert">
              <p>{error}</p>
              <div className="map-error-actions">
                <button type="button" className="button-secondary" onClick={requestMap}>
                  Reintentar
                </button>
                {osmLink && (
                  <a
                    className="button-secondary"
                    href={osmLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir en OpenStreetMap
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {status === 'ready' && (
        <p className="map-note">
          Mapa de OpenStreetMap. Los datos y las teselas pertenecen a sus contribuyentes
          (ODbL); si algo no se ve bien, abre el lugar en OpenStreetMap.
        </p>
      )}

      {tileWarning && status === 'ready' && (
        <p className="map-status" role="status">
          Algunas teselas no se pudieron cargar. Revisa tu conexión; el marcador sigue
          mostrando la ubicación.
        </p>
      )}
    </div>
  )
}
