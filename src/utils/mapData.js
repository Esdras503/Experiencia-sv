import { isValidLatitude, isValidLongitude } from '../../shared/geo.js'

/**
 * Prepara los puntos que dibujará el mini mapa de resultados.
 *
 * - Descarta elementos sin coordenadas válidas: la tarjeta sigue visible,
 *   pero no se inventa una ubicación.
 * - Incluye la referencia de búsqueda (ciudad o geolocalización) para que se
 *   vea junto a los resultados.
 * - Calcula los límites geográficos para encuadrar todos los puntos.
 */
export function collectMapPoints(places, origin) {
  const points = []
  const seen = new Set()

  for (const place of Array.isArray(places) ? places : []) {
    const latitude = place?.location?.latitude
    const longitude = place?.location?.longitude

    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) continue

    const id = place.id ?? `${latitude},${longitude}`
    if (seen.has(id)) continue
    seen.add(id)

    points.push({
      id,
      name: place.name ?? 'Lugar',
      latitude,
      longitude,
      place,
    })
  }

  const originPoint =
    origin &&
    isValidLatitude(origin.latitude) &&
    isValidLongitude(origin.longitude)
      ? {
          latitude: origin.latitude,
          longitude: origin.longitude,
          label: origin.label ?? 'Punto de referencia',
        }
      : null

  const all = originPoint ? [...points, originPoint] : points

  if (all.length === 0) {
    return { points, origin: originPoint, bounds: null }
  }

  const latitudes = all.map((point) => point.latitude)
  const longitudes = all.map((point) => point.longitude)

  return {
    points,
    origin: originPoint,
    bounds: [
      [Math.min(...latitudes), Math.min(...longitudes)],
      [Math.max(...latitudes), Math.max(...longitudes)],
    ],
  }
}
