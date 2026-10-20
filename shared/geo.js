const EARTH_RADIUS_METERS = 6371008.8

export function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

export function isValidLatitude(value) {
  return Number.isFinite(value) && value >= -90 && value <= 90
}

export function isValidLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180
}

/**
 * Distancia en línea recta (haversine) entre dos coordenadas, en metros.
 * No representa distancia por carretera.
 */
export function haversineMeters(a, b) {
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)
  const deltaLat = toRadians(b.latitude - a.latitude)
  const deltaLng = toRadians(b.longitude - a.longitude)

  const sinLat = Math.sin(deltaLat / 2)
  const sinLng = Math.sin(deltaLng / 2)
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)))
}
