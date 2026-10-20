// Categorías de la interfaz traducidas a etiquetas reales de OpenStreetMap.
//
// Cada categoría declara una o más combinaciones de etiquetas (`osmFilters`).
// El servidor las convierte en consultas Overpass; por ejemplo, Playas usa
// `natural=beach` y Lagos usa `natural=water` + `water=lake|lago`.
// No se inventan tipos: son etiquetas documentadas en el wiki de OSM.
export const ALL_CATEGORIES_KEY = 'todos'

export const categories = [
  {
    key: 'playas',
    name: 'Playas',
    icon: '🏖️',
    typeLabel: 'Playa',
    osmFilters: [{ natural: 'beach' }],
  },
  {
    key: 'lagos',
    name: 'Lagos y lagunas',
    icon: '🌊',
    typeLabel: 'Lago o laguna',
    osmFilters: [
      { natural: 'water', water: 'lake' },
      { natural: 'water', water: 'lagoon' },
    ],
  },
  {
    key: 'volcanes',
    name: 'Volcanes y montañas',
    icon: '⛰️',
    typeLabel: 'Volcán o montaña',
    osmFilters: [{ natural: 'volcano' }, { natural: 'peak' }],
  },
  {
    key: 'parques',
    name: 'Parques y naturaleza',
    icon: '🌿',
    typeLabel: 'Parque o reserva natural',
    osmFilters: [
      { leisure: 'park' },
      { leisure: 'nature_reserve' },
      { boundary: 'national_park' },
    ],
  },
  {
    key: 'cultura',
    name: 'Sitios históricos y culturales',
    icon: '🏛️',
    typeLabel: 'Sitio histórico o cultural',
    osmFilters: [{ historic: '*' }, { tourism: 'museum' }],
  },
  {
    key: 'restaurantes',
    name: 'Restaurantes',
    icon: '🍽️',
    typeLabel: 'Restaurante',
    osmFilters: [{ amenity: 'restaurant' }],
  },
  {
    key: 'hoteles',
    name: 'Hoteles y alojamientos',
    icon: '🛏️',
    typeLabel: 'Alojamiento',
    osmFilters: [
      { tourism: 'hotel' },
      { tourism: 'guest_house' },
      { tourism: 'hostel' },
      { tourism: 'apartment' },
    ],
  },
]

// Etiquetas de OSM que se muestran con un nombre comprensible para la persona.
// `value: '*'` significa que basta con que la clave exista (p. ej. historic=*).
const OSM_TAG_LABELS = [
  { key: 'natural', value: 'beach', label: 'Playa', icon: '🏖️' },
  { key: 'natural', value: 'water', label: 'Lago o laguna', icon: '🌊' },
  { key: 'natural', value: 'volcano', label: 'Volcán', icon: '⛰️' },
  { key: 'natural', value: 'peak', label: 'Montaña', icon: '⛰️' },
  { key: 'leisure', value: 'park', label: 'Parque', icon: '🌿' },
  { key: 'leisure', value: 'nature_reserve', label: 'Reserva natural', icon: '🌿' },
  { key: 'leisure', value: 'garden', label: 'Jardín', icon: '🌿' },
  { key: 'boundary', value: 'national_park', label: 'Parque nacional', icon: '🌿' },
  { key: 'tourism', value: 'museum', label: 'Museo', icon: '🏛️' },
  { key: 'tourism', value: 'attraction', label: 'Atracción', icon: '📍' },
  { key: 'tourism', value: 'viewpoint', label: 'Mirador', icon: '👀' },
  { key: 'tourism', value: 'hotel', label: 'Hotel', icon: '🛏️' },
  { key: 'tourism', value: 'guest_house', label: 'Alojamiento', icon: '🛏️' },
  { key: 'tourism', value: 'hostel', label: 'Alojamiento', icon: '🛏️' },
  { key: 'tourism', value: 'apartment', label: 'Alojamiento', icon: '🛏️' },
  { key: 'tourism', value: 'camp_site', label: 'Zona de acampada', icon: '🏕️' },
  { key: 'amenity', value: 'restaurant', label: 'Restaurante', icon: '🍽️' },
  { key: 'amenity', value: 'cafe', label: 'Café', icon: '☕' },
  { key: 'amenity', value: 'fast_food', label: 'Comida rápida', icon: '🍽️' },
  { key: 'amenity', value: 'bar', label: 'Bar', icon: '🍹' },
  { key: 'place', value: 'city', label: 'Ciudad', icon: '🏙️' },
  { key: 'place', value: 'town', label: 'Municipio', icon: '🏙️' },
  { key: 'place', value: 'village', label: 'Pueblo', icon: '🏘️' },
  { key: 'boundary', value: 'administrative', label: 'Lugar', icon: '📍' },
  { key: 'historic', value: '*', label: 'Sitio histórico', icon: '🏛️' },
]

export function getCategoryByKey(key) {
  if (!key || key === ALL_CATEGORIES_KEY) return null
  return categories.find((category) => category.key === key) ?? null
}

/**
 * Devuelve una etiqueta e icono para un conjunto de etiquetas OSM.
 * Si no hay coincidencia, usa la categoría solicitada como respaldo.
 */
export function describeOsmTags(tags = {}, fallback = null) {
  for (const entry of OSM_TAG_LABELS) {
    const matches =
      entry.value === '*' ? Boolean(tags[entry.key]) : tags[entry.key] === entry.value
    if (matches) return { label: entry.label, icon: entry.icon }
  }

  if (fallback) {
    return {
      label: fallback.typeLabel ?? fallback.name ?? null,
      icon: fallback.icon ?? '📍',
    }
  }

  return { label: null, icon: '📍' }
}
