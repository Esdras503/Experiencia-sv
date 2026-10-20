import { describeOsmTags } from '../shared/categories.js'
import { haversineMeters, isValidLatitude, isValidLongitude } from '../shared/geo.js'
import { buildOsmId, buildOsmUrl } from '../shared/osm.js'

function stripControlCharacters(value) {
  let output = ''
  for (const character of value) {
    const code = character.codePointAt(0)
    output += code <= 31 || code === 127 ? ' ' : character
  }
  return output
}

function cleanText(value, maxLength = 400) {
  if (typeof value !== 'string') return null
  const cleaned = stripControlCharacters(value).replace(/\s+/g, ' ').trim()
  return cleaned ? cleaned.slice(0, maxLength) : null
}

function normalizeHttpUrl(value) {
  const cleaned = cleanText(value, 500)
  if (!cleaned) return null
  try {
    const url = new URL(cleaned)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function composeAddress(tags) {
  const street = [cleanText(tags['addr:street'], 120), cleanText(tags['addr:house_number'], 20)]
    .filter(Boolean)
    .join(' ')
  const parts = [
    street,
    tags['addr:district'],
    tags['addr:city'],
    tags['addr:state'],
    tags['addr:country'],
  ]
    .map((value) => cleanText(value, 120))
    .filter(Boolean)

  return parts.length > 0 ? [...new Set(parts)].join(', ') : null
}

function normalizeLocation(raw) {
  if (!isValidLatitude(raw?.latitude) || !isValidLongitude(raw?.longitude)) return null
  return { latitude: raw.latitude, longitude: raw.longitude }
}

function normalizeTags(raw) {
  const tags = raw?.tags && typeof raw.tags === 'object' ? { ...raw.tags } : {}
  // Nominatim entrega class/type en lugar de algunas etiquetas; se incorporan
  // para poder describir el tipo sin inventar datos.
  if (raw?.nominatimClass && raw?.nominatimType) {
    tags[raw.nominatimClass] = raw.nominatimType
  }
  return tags
}

function buildBasePlace(raw, { center = null, category = null } = {}) {
  const location = normalizeLocation(raw)
  if (!location) return null

  const id = buildOsmId(raw.osmType, raw.osmId)
  const osmUrl = buildOsmUrl(raw.osmType, raw.osmId)
  if (!id || !osmUrl) return null

  const tags = normalizeTags(raw)
  const name =
    cleanText(raw.name, 200) ??
    cleanText(raw.displayName?.split(',')[0], 200) ??
    null
  const address = cleanText(raw.displayName, 400) ?? composeAddress(tags)
  const description = describeOsmTags(tags, category)

  let distanceMeters = null
  if (center) {
    distanceMeters = Math.round(haversineMeters(center, location))
  }

  return {
    id,
    name,
    address,
    category: description.label,
    icon: description.icon,
    location,
    distanceMeters,
    osmType: raw.osmType,
    osmId: raw.osmId,
    osmUrl,
  }
}

/**
 * Convierte un elemento de Nominatim u Overpass a la forma pública que consume
 * el cliente. No agrega calificaciones, reseñas ni fotos: OpenStreetMap no las
 * proporciona.
 */
export function toPublicPlace(raw, options = {}) {
  return buildBasePlace(raw, options)
}

export function toPublicPlaceDetails(raw, options = {}) {
  const base = buildBasePlace(raw, options)
  if (!base) return null

  const tags = normalizeTags(raw)

  return {
    ...base,
    website: normalizeHttpUrl(tags.website ?? tags['contact:website'] ?? tags.url),
    phone: cleanText(tags.phone ?? tags['contact:phone'] ?? tags['contact:mobile'], 60),
    openingHours: cleanText(tags.opening_hours, 200),
    description: cleanText(tags.description, 500),
  }
}
