import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { OSM_TILE_ATTRIBUTION, OSM_TILE_URL_DEFAULT } from '../../../shared/osm.js'
import { getMapConfig } from '../../services/mapConfig'
import { loadLeaflet } from '../../services/leafletLoader'
import { collectMapPoints } from '../../utils/mapData'
import { formatDistance } from '../../utils/placeFormatters'

function buildPlacePopup(place, handlersRef) {
  const popup = document.createElement('div')
  popup.className = 'map-popup'

  const title = document.createElement('strong')
  title.textContent = place.name ?? 'Lugar'
  popup.append(title)

  const distance = formatDistance(place.distanceMeters)
  if (distance) {
    const meta = document.createElement('span')
    meta.className = 'map-popup-meta'
    meta.textContent = `${distance} en línea recta`
    popup.append(meta)
  }

  const link = document.createElement('a')
  link.href = handlersRef.current.getDetailHref(place)
  link.textContent = 'Ver detalle'
  link.addEventListener('click', (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }

    event.preventDefault()
    handlersRef.current.onOpenPlace(place)
  })
  popup.append(link)

  return popup
}

/**
 * Mini mapa de los resultados de búsqueda.
 *
 * - Se carga solo cuando hay resultados con coordenadas.
 * - Encaja todos los marcadores, la referencia y el radio de búsqueda.
 * - Los popups se construyen con DOM y textContent: nunca se inyecta HTML de
 *   OpenStreetMap directamente.
 * - La atribución de Leaflet/OSM queda visible y no se cubre.
 */
export default function ResultsMap({
  places,
  origin,
  radiusKm,
  getDetailHref,
  onOpenPlace,
  title = 'Mapa de resultados',
  hint = 'Selecciona un marcador para abrir el lugar.',
  compact = false,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const overlaysRef = useRef(null)
  const handlersRef = useRef({ getDetailHref, onOpenPlace })
  const titleId = useId()

  const [status, setStatus] = useState('loading')
  const [attempt, setAttempt] = useState(0)
  const [tileWarning, setTileWarning] = useState(false)

  const mapData = useMemo(() => collectMapPoints(places, origin), [places, origin])

  useEffect(() => {
    handlersRef.current = { getDetailHref, onOpenPlace }
  })

  useEffect(
    () => () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      overlaysRef.current = null
    },
    [],
  )

  useEffect(() => {
    if (mapData.points.length === 0) {
      overlaysRef.current?.remove()
      overlaysRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
      return undefined
    }

    let cancelled = false

    async function setupMap() {
      const [L, config] = await Promise.all([loadLeaflet(), getMapConfig()])

      if (cancelled || !containerRef.current) return

      setTileWarning(false)

      if (!mapRef.current) {
        const map = L.map(containerRef.current, {
          scrollWheelZoom: false,
          worldCopyJump: true,
        })

        L.tileLayer(config?.tileUrl || OSM_TILE_URL_DEFAULT, {
          attribution: config?.attribution || OSM_TILE_ATTRIBUTION,
          maxZoom: 19,
        }).addTo(map)

        map.on('tileerror', () => {
          if (!cancelled) setTileWarning(true)
        })

        mapRef.current = map
      }

      const map = mapRef.current
      overlaysRef.current?.remove()
      const group = L.layerGroup().addTo(map)
      overlaysRef.current = group

      if (mapData.origin) {
        if (radiusKm) {
          L.circle([mapData.origin.latitude, mapData.origin.longitude], {
            radius: radiusKm * 1000,
            color: '#2f6b3f',
            weight: 1.5,
            dashArray: '5 6',
            fillColor: '#2f6b3f',
            fillOpacity: 0.06,
          }).addTo(group)
        }

        const originMarker = L.circleMarker(
          [mapData.origin.latitude, mapData.origin.longitude],
          {
            radius: 7,
            color: '#ffffff',
            weight: 2,
            fillColor: '#d9772f',
            fillOpacity: 1,
          },
        ).addTo(group)

        const originPopup = document.createElement('div')
        originPopup.className = 'map-popup'
        const originTitle = document.createElement('strong')
        originTitle.textContent = 'Punto de referencia'
        const originLabel = document.createElement('span')
        originLabel.className = 'map-popup-meta'
        originLabel.textContent = radiusKm
          ? `${mapData.origin.label} · radio ${radiusKm} km`
          : mapData.origin.label
        originPopup.append(originTitle, originLabel)
        originMarker.bindPopup(originPopup)
      }

      for (const point of mapData.points) {
        const marker = L.circleMarker([point.latitude, point.longitude], {
          radius: 8,
          color: '#ffffff',
          weight: 2,
          fillColor: '#2f6b3f',
          fillOpacity: 1,
        }).addTo(group)

        marker.bindPopup(buildPlacePopup(point.place, handlersRef))
      }

      map.fitBounds(mapData.bounds, { padding: [28, 28], maxZoom: 15 })

      requestAnimationFrame(() => {
        if (cancelled) return
        map.invalidateSize()
        setStatus('ready')
      })
    }

    setupMap().catch(() => {
      if (!cancelled) setStatus('error')
    })

    return () => {
      cancelled = true
    }
  }, [mapData, radiusKm, attempt])

  if (mapData.points.length === 0) return null

  const retry = () => {
    setTileWarning(false)
    setStatus('loading')
    setAttempt((value) => value + 1)
  }

  return (
    <section
      className={`results-map-section${compact ? ' results-map-section-compact' : ''}`}
      aria-labelledby={titleId}
    >
      <div className="results-map-heading">
        <h3 id={titleId}>{title}</h3>
        <span>{hint}</span>
      </div>

      <div className="results-map-frame" aria-busy={status === 'loading'}>
        <div
          ref={containerRef}
          className="results-map-canvas"
          role="region"
          aria-label={title}
        />

        {status === 'loading' && (
          <p className="results-map-status" role="status">
            Cargando mapa de OpenStreetMap…
          </p>
        )}

        {status === 'error' && (
          <div className="results-map-status results-map-error" role="alert">
            <p>No se pudo cargar el mapa. Los resultados siguen en las tarjetas.</p>
            <button type="button" className="button-secondary" onClick={retry}>
              Reintentar
            </button>
          </div>
        )}
      </div>

      {tileWarning && status === 'ready' && (
        <p className="results-map-note" role="status">
          Algunas teselas no se cargaron; los marcadores siguen mostrando la ubicación.
        </p>
      )}

      {compact ? (
        <p className="results-map-note">Mapa de OpenStreetMap. Distancias en línea recta.</p>
      ) : (
        <p className="results-map-note">
          Mapa de OpenStreetMap. Las distancias son en línea recta; la información completa
          está en cada tarjeta.
        </p>
      )}
    </section>
  )
}
