// Constantes y utilidades de OpenStreetMap compartidas por cliente y servidor.
// OpenStreetMap no usa claves de API: los datos están bajo la licencia ODbL y
// requieren atribución visible.

export const OSM_ATTRIBUTION = '© OpenStreetMap contributors'
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright'
export const OSM_TILE_URL_DEFAULT = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const OSM_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

export const OSM_ELEMENT_TYPES = ['node', 'way', 'relation']

const OSM_ID_PATTERN = /^osm-(node|way|relation)-(\d{1,15})$/

export function buildOsmId(type, id) {
  if (!OSM_ELEMENT_TYPES.includes(type)) return null
  const numericId = Number(id)
  if (!Number.isSafeInteger(numericId) || numericId <= 0) return null
  return `osm-${type}-${numericId}`
}

export function parseOsmId(value) {
  if (typeof value !== 'string') return null
  const match = OSM_ID_PATTERN.exec(value.trim())
  if (!match) return null
  const numericId = Number(match[2])
  if (!Number.isSafeInteger(numericId) || numericId <= 0) return null
  return { type: match[1], id: numericId }
}

export function buildOsmUrl(type, id) {
  if (!OSM_ELEMENT_TYPES.includes(type)) return null
  const numericId = Number(id)
  if (!Number.isSafeInteger(numericId) || numericId <= 0) return null
  return `https://www.openstreetmap.org/${type}/${numericId}`
}

export function buildOsmLocationUrl(latitude, longitude) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`
}
