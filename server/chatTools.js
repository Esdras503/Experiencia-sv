import { ALL_CATEGORIES_KEY, categories, getCategoryByKey } from '../shared/categories.js'
import { haversineMeters, isValidLatitude, isValidLongitude } from '../shared/geo.js'
import { parseOsmId } from '../shared/osm.js'
import { AppError, ERROR_CODES } from './errors.js'
import { normalizePublicPlace } from './chatItinerary.js'

const MAX_TOOL_QUERY_LENGTH = 120
const MAX_TOOL_RESULTS = 8
const RADIUS_OPTIONS = [5, 10, 25, 50]
const CATEGORY_KEYS = categories.map((category) => category.key)
// El turno completo del chat tiene ~27 s. Overpass público puede tardar más de
// 20 s cuando está al límite; en el chat se corta antes para poder responder.
const CHAT_SEARCH_TIMEOUT_MS = 10_000
const CATEGORY_UNAVAILABLE_CODES = new Set([
  ERROR_CODES.UPSTREAM_TIMEOUT,
  ERROR_CODES.UPSTREAM_UNAVAILABLE,
  ERROR_CODES.UPSTREAM_RATE_LIMITED,
  ERROR_CODES.NETWORK_ERROR,
])

function isCategorySearchFailure(error) {
  return error instanceof AppError && CATEGORY_UNAVAILABLE_CODES.has(error.code)
}

function hasControlChars(value) {
  for (const character of value) {
    const code = character.codePointAt(0)
    if ((code <= 31 && code !== 10 && code !== 9) || code === 127) return true
  }
  return false
}

function cleanToolText(value, maximum = MAX_TOOL_QUERY_LENGTH) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, maximum)
}

function toolFailure(code, message) {
  return { ok: false, error: { code, message } }
}

function compactPlace(place) {
  const normalized = normalizePublicPlace(place)
  if (!normalized) return null

  return {
    id: normalized.id,
    name: normalized.name,
    address: normalized.address,
    category: normalized.category,
    icon: normalized.icon,
    location: normalized.location,
    distanceMeters: normalized.distanceMeters,
    osmUrl: normalized.osmUrl,
  }
}

export const CHAT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_places',
      description:
        'Busca lugares turísticos reales en OpenStreetMap. Para un lugar con nombre propio, usa solo query. Usa category para explorar un tipo de lugar sin un nombre concreto. Devuelve IDs reales que debes usar en la respuesta.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Nombre o texto libre (máximo 120 caracteres). Para un lugar concreto, usa el nombre completo, por ejemplo "Playa El Tunco", y no añadas category.',
          },
          category: {
            type: 'string',
            enum: [...CATEGORY_KEYS, ALL_CATEGORIES_KEY],
            description:
              'Tipo de lugar para explorar sin un nombre concreto. Usa la clave, no el nombre visible. No la combines con query si buscas un lugar por su nombre.',
          },
          center: {
            type: 'object',
            description:
              'Coordenadas de referencia obtenidas con locate_reference. Si se indica, limita la búsqueda al radio.',
            properties: {
              latitude: { type: 'number', minimum: -90, maximum: 90 },
              longitude: { type: 'number', minimum: -180, maximum: 180 },
            },
            required: ['latitude', 'longitude'],
            additionalProperties: false,
          },
          radiusKm: {
            type: 'number',
            enum: RADIUS_OPTIONS,
            description: 'Radio en kilómetros. Requiere center.',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: MAX_TOOL_RESULTS,
            description: 'Número máximo de resultados (por defecto 6).',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_place_details',
      description:
        'Obtiene el detalle real de un lugar de OpenStreetMap por su ID: sitio web, teléfono, horario etiquetado y descripción, cuando existan.',
      parameters: {
        type: 'object',
        properties: {
          placeId: {
            type: 'string',
            description: 'Identificador de Experiencia SV, por ejemplo osm-node-123.',
          },
        },
        required: ['placeId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'locate_reference',
      description:
        'Ubica una ciudad, municipio o lugar de salida en El Salvador y devuelve sus coordenadas para usar como center en búsquedas.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Ciudad, municipio o lugar de salida (mínimo 3 caracteres).',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_distances',
      description:
        'Calcula distancias en línea recta entre lugares ya conocidos. No devuelve rutas, tiempos de conducción ni distancias por carretera.',
      parameters: {
        type: 'object',
        properties: {
          placeIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 2,
            maxItems: 6,
            description: 'IDs reales de lugares, en el orden en que se quieren comparar.',
          },
        },
        required: ['placeIds'],
        additionalProperties: false,
      },
    },
  },
]

/**
 * Ejecuta únicamente las herramientas declaradas, con límites y validación de
 * argumentos. Mantiene el catálogo de lugares conocidos para que la respuesta
 * final solo pueda enlazar IDs reales.
 */
export function createChatToolRunner({
  placeService,
  now = Date.now,
  maxToolCalls = 5,
  maxSearches = 3,
  maxLocates = 2,
  logError = console.error,
} = {}) {
  const knownPlaces = new Map()
  const stats = {
    calls: 0,
    searches: 0,
    locates: 0,
    toolNames: [],
    dataSources: new Set(),
  }
  // Si Overpass falla una vez por categoría, no se insiste en cada ronda: el
  // turno no alcanzaría a responder. Las búsquedas por nombre siguen disponibles.
  let categorySearchUnavailable = false

  function registerPlace(place) {
    const normalized = normalizePublicPlace(place)
    if (!normalized) return null
    knownPlaces.set(normalized.id, normalized)
    return normalized
  }

  function registerPlaces(places) {
    return (Array.isArray(places) ? places : []).map(registerPlace).filter(Boolean)
  }

  async function runSearch(args) {
    const query = cleanToolText(args?.query)
    const rawCategory = cleanToolText(args?.category, 60)
    const categoryKey = rawCategory && rawCategory !== ALL_CATEGORIES_KEY ? rawCategory : ''
    const category = categoryKey ? getCategoryByKey(categoryKey) : null

    if (categoryKey && !category) {
      return toolFailure('INVALID_CATEGORY', 'La categoría indicada no es válida.')
    }
    if (!query && !category) {
      return toolFailure(
        'INVALID_ARGUMENTS',
        'Indica un texto de búsqueda o una categoría para buscar.',
      )
    }
    if (query && (query.length < 2 || hasControlChars(query))) {
      return toolFailure(
        'INVALID_ARGUMENTS',
        'La búsqueda debe tener al menos 2 caracteres y no contener controles.',
      )
    }

    let center = null
    if (args?.center !== undefined && args?.center !== null) {
      if (
        !isValidLatitude(args.center.latitude) ||
        !isValidLongitude(args.center.longitude)
      ) {
        return toolFailure('INVALID_ARGUMENTS', 'Las coordenadas de referencia no son válidas.')
      }
      center = {
        latitude: args.center.latitude,
        longitude: args.center.longitude,
      }
    }

    let radiusKm = null
    if (args?.radiusKm !== undefined && args?.radiusKm !== null) {
      const parsed = Number(args.radiusKm)
      if (!RADIUS_OPTIONS.includes(parsed)) {
        return toolFailure(
          'INVALID_ARGUMENTS',
          `El radio debe ser uno de: ${RADIUS_OPTIONS.join(', ')} km.`,
        )
      }
      if (!center) {
        return toolFailure('INVALID_ARGUMENTS', 'El radio requiere una referencia (center).')
      }
      radiusKm = parsed
    }

    const limit = Number.isInteger(Number(args?.limit))
      ? Math.min(MAX_TOOL_RESULTS, Math.max(1, Number(args.limit)))
      : 6

    if (stats.searches >= maxSearches) {
      return toolFailure(
        'TOOL_LIMIT',
        'Se alcanzó el máximo de búsquedas para este turno. Usa los resultados que ya tienes.',
      )
    }

    stats.searches += 1
    let payload
    let fallbackNote = null

    if (category && categorySearchUnavailable) {
      if (!query) {
        return toolFailure(
          'TOOL_UNAVAILABLE',
          'La búsqueda por categoría de OpenStreetMap no está disponible en este momento. No repitas la búsqueda por categoría: pide a la persona que escriba un lugar concreto por su nombre (sin proponer nombres de memoria) o propone intentarlo más tarde.',
        )
      }

      payload = await placeService.search({
        searchText: query,
        categoryKey: ALL_CATEGORIES_KEY,
        center,
        radiusKm,
        pageSize: limit,
        timeoutMs: CHAT_SEARCH_TIMEOUT_MS,
      })
      fallbackNote =
        'La búsqueda por categoría no está disponible; los resultados provienen de una búsqueda por nombre.'
    } else {
      try {
        payload = await placeService.search({
          searchText: query,
          categoryKey: category?.key ?? ALL_CATEGORIES_KEY,
          center,
          radiusKm,
          pageSize: limit,
          timeoutMs: CHAT_SEARCH_TIMEOUT_MS,
        })
      } catch (error) {
        // Overpass puede estar caído aunque Nominatim siga funcionando. Si el
        // modelo pidió un nombre concreto y una categoría, se reintenta por
        // nombre para no perder una consulta que sí tiene datos reales.
        const categoryFailure = Boolean(category) && isCategorySearchFailure(error)
        if (categoryFailure) categorySearchUnavailable = true

        const canRetryAsText = Boolean(query) && Boolean(category) && categoryFailure
        if (!canRetryAsText) {
          if (category && !query) {
          return toolFailure(
            'TOOL_UNAVAILABLE',
            'La búsqueda por categoría de OpenStreetMap no está disponible en este momento. No repitas la búsqueda por categoría: pide a la persona que escriba un lugar concreto por su nombre (sin proponer nombres de memoria) o propone intentarlo más tarde.',
          )
          }
          throw error
        }

        payload = await placeService.search({
          searchText: query,
          categoryKey: ALL_CATEGORIES_KEY,
          center,
          radiusKm,
          pageSize: limit,
          timeoutMs: CHAT_SEARCH_TIMEOUT_MS,
        })
        fallbackNote =
          'La búsqueda por categoría no estaba disponible; los resultados provienen de una búsqueda por nombre.'
      }
    }

    const places = registerPlaces(payload.places).slice(0, limit)
    if (payload.dataSource) stats.dataSources.add(payload.dataSource)

    return {
      ok: true,
      source: payload.dataSource ?? null,
      places: places.map(compactPlace).filter(Boolean),
      note: [
        places.length > 0
          ? 'Resultados reales de OpenStreetMap. No incluyen calificaciones, reseñas, fotos ni precios.'
          : 'OpenStreetMap no devolvió lugares para esta consulta.',
        fallbackNote,
      ]
        .filter(Boolean)
        .join(' '),
      queriedAt: new Date(now()).toISOString(),
    }
  }

  async function runDetails(args) {
    const placeId = cleanToolText(args?.placeId, 60)
    if (!parseOsmId(placeId)) {
      return toolFailure('INVALID_PLACE_ID', 'El identificador del lugar no es válido.')
    }

    const payload = await placeService.detailsById(placeId)
    const base = registerPlace(payload.place)
    if (!base) {
      return toolFailure('PLACE_NOT_FOUND', 'No encontramos ese lugar en OpenStreetMap.')
    }

    return {
      ok: true,
      place: {
        ...compactPlace(base),
        website: payload.place.website ?? null,
        phone: payload.place.phone ?? null,
        openingHours: payload.place.openingHours ?? null,
        description: payload.place.description ?? null,
      },
      note:
        'Datos estáticos de OpenStreetMap. opening_hours no confirma que el lugar esté abierto ahora; no hay disponibilidad ni precios verificados.',
    }
  }

  async function runLocate(args) {
    const query = cleanToolText(args?.query)
    if (query.length < 3 || hasControlChars(query)) {
      return toolFailure(
        'INVALID_ARGUMENTS',
        'Escribe al menos 3 caracteres para ubicar la referencia.',
      )
    }

    if (stats.locates >= maxLocates) {
      return toolFailure(
        'TOOL_LIMIT',
        'Se alcanzó el máximo de ubicaciones para este turno.',
      )
    }

    stats.locates += 1
    const payload = await placeService.locate(query)

    return {
      ok: true,
      label: payload.label,
      address: payload.address ?? null,
      location: payload.location,
      source: 'openstreetmap',
      note: 'Coordenadas de la referencia en OpenStreetMap.',
    }
  }

  function runDistances(args) {
    const ids = Array.isArray(args?.placeIds)
      ? [...new Set(args.placeIds.filter((id) => typeof id === 'string'))].slice(0, 6)
      : []

    if (ids.length < 2 || ids.length > 6 || ids.some((id) => !parseOsmId(id))) {
      return toolFailure(
        'INVALID_ARGUMENTS',
        'Indica entre 2 y 6 identificadores de lugares válidos.',
      )
    }

    const places = ids.map((id) => knownPlaces.get(id)).filter(Boolean)
    if (places.length !== ids.length) {
      return toolFailure(
        'UNKNOWN_PLACE',
        'Solo puedes calcular distancias de lugares obtenidos con las herramientas o del itinerario actual.',
      )
    }

    const legs = []
    for (let index = 1; index < places.length; index += 1) {
      const meters = Math.round(
        haversineMeters(places[index - 1].location, places[index].location),
      )
      legs.push({
        fromId: places[index - 1].id,
        toId: places[index].id,
        meters,
        kilometers: Math.round((meters / 1000) * 10) / 10,
      })
    }

    return {
      ok: true,
      straightLine: true,
      legs,
      note:
        'Distancias en línea recta (haversine), no distancias por carretera ni tiempos de conducción.',
    }
  }

  async function execute(name, args) {
    if (stats.calls >= maxToolCalls) {
      return toolFailure(
        'TOOL_LIMIT',
        'Se alcanzó el máximo de herramientas para este turno. Responde con lo que ya tienes.',
      )
    }

    const allowed = new Set(CHAT_TOOLS.map((tool) => tool.function.name))
    if (!allowed.has(name)) {
      return toolFailure('UNKNOWN_TOOL', 'La herramienta solicitada no está permitida.')
    }

    stats.calls += 1
    stats.toolNames.push(name)

    try {
      if (name === 'search_places') return await runSearch(args)
      if (name === 'get_place_details') return await runDetails(args)
      if (name === 'locate_reference') return await runLocate(args)
      if (name === 'calculate_distances') return runDistances(args)
      return toolFailure('UNKNOWN_TOOL', 'La herramienta solicitada no está permitida.')
    } catch (error) {
      logError?.('[chat] error al ejecutar herramienta', {
        tool: name,
        code: error?.code ?? error?.name ?? 'UNKNOWN',
      })
      if (error instanceof AppError) {
        return toolFailure(error.code, error.message)
      }
      return toolFailure('TOOL_ERROR', 'No se pudo completar la consulta de lugares.')
    }
  }

  return {
    execute,
    registerPlace,
    registerPlaces,
    getKnownPlaces: () => knownPlaces,
    getStats: () => ({
      calls: stats.calls,
      searches: stats.searches,
      locates: stats.locates,
      toolNames: [...stats.toolNames],
      dataSources: [...stats.dataSources],
    }),
  }
}
