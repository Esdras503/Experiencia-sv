import { buildOsmLocationUrl, buildOsmUrl } from '../../shared/osm.js'

export function formatDistance(meters) {
  if (typeof meters !== 'number' || !Number.isFinite(meters) || meters < 0) return null
  if (meters < 1000) {
    const rounded = Math.round(meters / 10) * 10
    return `${rounded} m`
  }
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

/**
 * Enlace oficial a OpenStreetMap. Se prefiere el elemento exacto (`node/way/
 * relation`); si el servidor no lo devolvió, se enlaza por coordenadas.
 */
export function buildOsmLink(place) {
  if (place?.osmUrl) return place.osmUrl
  if (place?.osmType && place?.osmId) {
    return buildOsmUrl(place.osmType, place.osmId)
  }
  if (place?.location) {
    return buildOsmLocationUrl(place.location.latitude, place.location.longitude)
  }
  return null
}
