import { isValidLatitude, isValidLongitude } from '../shared/geo.js'
import { parseOsmId } from '../shared/osm.js'
import { AppError, ERROR_CODES } from './errors.js'

export const MAX_QUERY_LENGTH = 200
export const MAX_RESULTS = 20
export const MIN_RESULTS = 1
export const RADIUS_OPTIONS_KM = [5, 10, 25, 50]

function hasControlChars(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 31 || code === 127) return true
  }
  return false
}

export function invalidRequest(message) {
  return new AppError(ERROR_CODES.INVALID_REQUEST, { status: 400, message })
}

export function assertPlainObject(value, field) {
  if (value === undefined || value === null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw invalidRequest(`El campo "${field}" debe ser un objeto.`)
  }
  return value
}

export function validateSearchQuery(input) {
  const raw = assertPlainObject(input, 'body')

  const query = typeof raw.query === 'string' ? raw.query.trim() : ''
  const categoryKey = typeof raw.category === 'string' ? raw.category.trim() : ''

  if (query.length > MAX_QUERY_LENGTH) {
    throw invalidRequest(`La búsqueda no puede superar ${MAX_QUERY_LENGTH} caracteres.`)
  }
  if (hasControlChars(query)) {
    throw invalidRequest('La búsqueda contiene caracteres no permitidos.')
  }
  if (hasControlChars(categoryKey)) {
    throw invalidRequest('La categoría contiene caracteres no permitidos.')
  }

  let center = null
  if (raw.center !== undefined && raw.center !== null) {
    const centerObject = assertPlainObject(raw.center, 'center')
    if (!isValidLatitude(centerObject.latitude) || !isValidLongitude(centerObject.longitude)) {
      throw invalidRequest('Las coordenadas de referencia no son válidas.')
    }
    center = { latitude: centerObject.latitude, longitude: centerObject.longitude }
  }

  let radiusKm = null
  if (raw.radiusKm !== undefined && raw.radiusKm !== null) {
    const parsed = Number(raw.radiusKm)
    if (!RADIUS_OPTIONS_KM.includes(parsed)) {
      throw invalidRequest(`El radio debe ser uno de: ${RADIUS_OPTIONS_KM.join(', ')} km.`)
    }
    if (!center) {
      throw invalidRequest('El radio requiere una ubicación de referencia.')
    }
    radiusKm = parsed
  }

  let pageSize = MAX_RESULTS
  if (raw.pageSize !== undefined && raw.pageSize !== null) {
    const parsed = Number(raw.pageSize)
    if (!Number.isInteger(parsed) || parsed < MIN_RESULTS || parsed > MAX_RESULTS) {
      throw invalidRequest(`El tamaño de página debe estar entre ${MIN_RESULTS} y ${MAX_RESULTS}.`)
    }
    pageSize = parsed
  }

  return { searchText: query, categoryKey, center, radiusKm, pageSize }
}

export function validatePlaceQuery(query = {}) {
  const id = typeof query.id === 'string' ? query.id.trim() : ''
  if (!parseOsmId(id)) {
    throw invalidRequest('El identificador del lugar no es válido.')
  }
  return { placeId: id }
}

export function validateLocateInput(input) {
  const raw = assertPlainObject(input, 'body')
  const query = typeof raw.query === 'string' ? raw.query.trim() : ''

  if (query.length < 3) {
    throw invalidRequest('Escribe al menos 3 caracteres para ubicar la referencia.')
  }
  if (query.length > MAX_QUERY_LENGTH) {
    throw invalidRequest(`La referencia no puede superar ${MAX_QUERY_LENGTH} caracteres.`)
  }
  if (hasControlChars(query)) {
    throw invalidRequest('La referencia contiene caracteres no permitidos.')
  }

  return { searchText: query }
}
