import { haversineMeters, isValidLatitude, isValidLongitude } from '../../shared/geo.js'

export const MAX_SAVED_STOPS = 20
export const MAX_TITLE_LENGTH = 120
export const MAX_DESCRIPTION_LENGTH = 2000
export const MAX_NOTES_LENGTH = 1000
export const MAX_STOP_REASON_LENGTH = 320
export const MAX_BUDGET_AMOUNT = 100000000
export const MAX_PARTY_SIZE = 50
export const MAX_DURATION_DAYS = 60

const PLACE_ID_PATTERN = /^osm-(node|way|relation)-\d{1,20}$/
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class ItineraryValidationError extends Error {
  constructor(message, field = null) {
    super(message)
    this.name = 'ItineraryValidationError'
    this.code = 'VALIDATION_ERROR'
    this.field = field
  }
}

function fail(message, field) {
  throw new ItineraryValidationError(message, field)
}

function stripControls(value, { keepNewlines = false } = {}) {
  let output = ''

  for (const character of value.replace(/\r\n?/g, '\n')) {
    const code = character.codePointAt(0)
    if (code === 10 || code === 9) {
      output += keepNewlines ? character : ' '
      continue
    }
    if (code <= 31 || code === 127) {
      output += ' '
      continue
    }
    output += character
  }

  return output
}

function cleanText(value, maximum) {
  if (typeof value !== 'string') return null
  const cleaned = stripControls(value).replace(/\s+/g, ' ').trim()
  return cleaned ? cleaned.slice(0, maximum) : null
}

function cleanMultiline(value, maximum) {
  if (typeof value !== 'string') return null
  const cleaned = stripControls(value, { keepNewlines: true })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
  return cleaned ? cleaned.slice(0, maximum) : null
}

export function isValidPlaceId(value) {
  return typeof value === 'string' && PLACE_ID_PATTERN.test(value.trim())
}

export function isValidUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim())
}

export function normalizeIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return null
  }
  const candidate = value.trim()
  const parsed = new Date(`${candidate}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10) === candidate ? candidate : null
}

export function parseOptionalInteger(value, { min, max, label }) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    fail(`${label} debe ser un número entero entre ${min} y ${max}.`)
  }
  return parsed
}

export function parseOptionalBudgetAmount(value) {
  if (value === null || value === undefined || value === '') return null
  const normalized = typeof value === 'string' ? value.replace(',', '.').trim() : value
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_BUDGET_AMOUNT) {
    fail(`El presupuesto debe ser un número entre 0 y ${MAX_BUDGET_AMOUNT}.`)
  }
  return Math.round(parsed * 100) / 100
}

export function normalizeCurrency(value, amount = null) {
  if (amount === null || amount === undefined) return null
  const candidate = typeof value === 'string' ? value.trim().toUpperCase() : ''
  const currency = candidate || 'USD'
  if (!/^[A-Z]{3}$/.test(currency)) {
    fail('La moneda debe ser un código ISO 4217 de tres letras, por ejemplo USD.')
  }
  return currency
}

export function normalizeOrigin(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (!isValidLatitude(value.latitude) || !isValidLongitude(value.longitude)) return null
  const label = cleanText(value.label, 160)
  if (!label) return null
  return {
    label,
    latitude: value.latitude,
    longitude: value.longitude,
  }
}

export function normalizeBudget(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const amount = parseOptionalBudgetAmount(value.amount)
  if (amount === null) return null
  const currency = normalizeCurrency(value.currency, amount)
  const scope = value.scope === 'persona' || value.scope === 'total' ? value.scope : null
  if (!scope) fail('Indica si el presupuesto es total o por persona.')
  return { amount, currency, scope }
}

export function recalculateStopDistances(stops, origin) {
  const safeOrigin = normalizeOrigin(origin)
  let previousLocation = null

  return stops.map((stop, index) => {
    const location =
      stop.location &&
      isValidLatitude(stop.location.latitude) &&
      isValidLongitude(stop.location.longitude)
        ? { latitude: stop.location.latitude, longitude: stop.location.longitude }
        : null

    const distanceFromPreviousMeters =
      previousLocation && location
        ? Math.round(haversineMeters(previousLocation, location))
        : null

    const distanceFromOriginMeters =
      index === 0 && safeOrigin && location
        ? Math.round(haversineMeters(safeOrigin, location))
        : null

    if (location) previousLocation = location

    return {
      ...stop,
      order: index + 1,
      distanceFromOriginMeters,
      distanceFromPreviousMeters,
    }
  })
}

/**
 * Acepta tanto la forma del chat (`stop.place`) como la forma plana guardada
 * en PostgreSQL. No guarda fotos, reseñas, calificaciones ni precios.
 */
export function normalizeStoredStop(rawStop, index = 0) {
  if (!rawStop || typeof rawStop !== 'object' || Array.isArray(rawStop)) {
    fail('Una de las paradas no es válida.')
  }

  const place =
    rawStop.place && typeof rawStop.place === 'object' && !Array.isArray(rawStop.place)
      ? rawStop.place
      : rawStop
  const placeId =
    typeof rawStop.placeId === 'string'
      ? rawStop.placeId.trim()
      : typeof place.id === 'string'
        ? place.id.trim()
        : ''

  if (!isValidPlaceId(placeId)) {
    fail('Cada parada debe conservar un identificador real de OpenStreetMap.')
  }

  const name = cleanText(place.name, 200)
  if (!name) fail('Cada parada debe tener un nombre.')

  const rawLocation = place.location ?? rawStop.location
  const location =
    rawLocation &&
    isValidLatitude(rawLocation.latitude) &&
    isValidLongitude(rawLocation.longitude)
      ? {
          latitude: rawLocation.latitude,
          longitude: rawLocation.longitude,
        }
      : null

  const visitMinutesCandidate = Number(rawStop.visitMinutes)
  const visitMinutes =
    Number.isInteger(visitMinutesCandidate) &&
    visitMinutesCandidate >= 15 &&
    visitMinutesCandidate <= 480
      ? visitMinutesCandidate
      : null

  return {
    order: index + 1,
    placeId,
    name,
    address: cleanText(place.address, 400),
    category: cleanText(place.category, 120),
    icon: cleanText(place.icon, 12),
    location,
    osmUrl: cleanText(place.osmUrl, 500),
    reason: cleanText(rawStop.reason, MAX_STOP_REASON_LENGTH),
    visitMinutes,
    visitEstimate: visitMinutes !== null && rawStop.visitEstimate === true,
    distanceFromOriginMeters: null,
    distanceFromPreviousMeters: null,
  }
}

function normalizeStops(rawStops, origin) {
  if (!Array.isArray(rawStops) || rawStops.length === 0) {
    fail('El itinerario debe tener al menos una parada.')
  }
  if (rawStops.length > MAX_SAVED_STOPS) {
    fail(`El itinerario no puede superar ${MAX_SAVED_STOPS} paradas.`)
  }

  const seen = new Set()
  const stops = rawStops.map((stop, index) => {
    const normalized = normalizeStoredStop(stop, index)
    if (seen.has(normalized.placeId)) {
      fail('No se puede repetir el mismo lugar en dos paradas.')
    }
    seen.add(normalized.placeId)
    return normalized
  })

  return recalculateStopDistances(stops, origin)
}

function normalizeWarnings(value) {
  if (!Array.isArray(value)) return []
  const warnings = []
  const seen = new Set()

  for (const rawWarning of value.slice(0, 10)) {
    const warning = cleanText(rawWarning, 260)
    if (!warning) continue
    const key = warning.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    warnings.push(warning)
  }

  return warnings
}

function normalizeTimestamp(value) {
  if (typeof value !== 'string') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function basePreferences(itinerary, origin, budget) {
  return {
    origin,
    budgetScope: budget?.scope ?? null,
    warnings: normalizeWarnings(itinerary?.warnings),
    dataSource: cleanText(itinerary?.dataSource, 60),
    attribution: cleanText(itinerary?.attribution, 200),
    attributionUrl: cleanText(itinerary?.attributionUrl, 500),
    distanceMethod: cleanText(itinerary?.distanceMethod, 40),
    generatedAt: normalizeTimestamp(itinerary?.generatedAt),
    notes: '',
  }
}

/**
 * Convierte el itinerario estructurado del chat en una fila válida. No agrega
 * datos que no existan: los campos opcionales ausentes quedan en null.
 */
export function createItineraryInsert(itinerary, userId) {
  if (!isValidUuid(userId)) {
    fail('La sesión no identifica un usuario válido.')
  }
  if (!itinerary || typeof itinerary !== 'object' || Array.isArray(itinerary)) {
    fail('No hay un itinerario válido para guardar.')
  }

  const title = cleanText(itinerary.title, MAX_TITLE_LENGTH)
  if (!title) fail('El itinerario necesita un título.')

  const description = cleanMultiline(itinerary.summary, MAX_DESCRIPTION_LENGTH)
  const origin = normalizeOrigin(itinerary.origin)
  const budget = normalizeBudget(itinerary.budget)
  const stops = normalizeStops(itinerary.stops, origin)

  return {
    title,
    description,
    start_date: normalizeIsoDate(itinerary.date),
    duration_days: parseOptionalInteger(itinerary.durationDays, {
      min: 1,
      max: MAX_DURATION_DAYS,
      label: 'La duración',
    }),
    party_size: parseOptionalInteger(itinerary.travelers, {
      min: 1,
      max: MAX_PARTY_SIZE,
      label: 'El número de personas',
    }),
    budget_amount: budget?.amount ?? null,
    budget_currency: budget?.currency ?? null,
    preferences: basePreferences(itinerary, origin, budget),
    stops,
  }
}

export function formValuesFromRecord(record) {
  const preferences =
    record?.preferences && typeof record.preferences === 'object' ? record.preferences : {}

  return {
    title: record?.title ?? '',
    description: record?.description ?? '',
    startDate: record?.start_date ?? '',
    durationDays:
      record?.duration_days === null || record?.duration_days === undefined
        ? ''
        : String(record.duration_days),
    partySize:
      record?.party_size === null || record?.party_size === undefined
        ? ''
        : String(record.party_size),
    budgetAmount:
      record?.budget_amount === null || record?.budget_amount === undefined
        ? ''
        : String(Number(record.budget_amount)),
    budgetCurrency: record?.budget_currency ?? 'USD',
    budgetScope:
      preferences.budgetScope === 'persona' || preferences.budgetScope === 'total'
        ? preferences.budgetScope
        : 'total',
    notes: typeof preferences.notes === 'string' ? preferences.notes : '',
  }
}

/**
 * Prepara la actualización de un itinerario guardado. Conserva las claves de
 * preferencias que no edita el formulario (origen, advertencias, fuente, etc.).
 */
export function buildItineraryUpdate({ values, stops, currentRecord }) {
  const title = cleanText(values?.title, MAX_TITLE_LENGTH)
  if (!title) fail('El itinerario necesita un título.')

  const description = cleanMultiline(values?.description, MAX_DESCRIPTION_LENGTH)
  const startDate =
    values?.startDate === '' || values?.startDate === null || values?.startDate === undefined
      ? null
      : normalizeIsoDate(values.startDate)
  if (values?.startDate && !startDate) {
    fail('La fecha de inicio no es válida.')
  }

  const durationDays = parseOptionalInteger(values?.durationDays, {
    min: 1,
    max: MAX_DURATION_DAYS,
    label: 'La duración',
  })
  const partySize = parseOptionalInteger(values?.partySize, {
    min: 1,
    max: MAX_PARTY_SIZE,
    label: 'El número de personas',
  })
  const budgetAmount = parseOptionalBudgetAmount(values?.budgetAmount)
  const budgetCurrency = normalizeCurrency(values?.budgetCurrency, budgetAmount)
  const budgetScope =
    values?.budgetScope === 'persona' || values?.budgetScope === 'total'
      ? values.budgetScope
      : 'total'

  const currentPreferences =
    currentRecord?.preferences &&
    typeof currentRecord.preferences === 'object' &&
    !Array.isArray(currentRecord.preferences)
      ? currentRecord.preferences
      : {}
  const origin = normalizeOrigin(currentPreferences.origin)
  const normalizedStops = normalizeStops(stops, origin)

  return {
    title,
    description,
    start_date: startDate,
    duration_days: durationDays,
    party_size: partySize,
    budget_amount: budgetAmount,
    budget_currency: budgetCurrency,
    preferences: {
      ...currentPreferences,
      origin,
      budgetScope,
      notes: cleanMultiline(values?.notes, MAX_NOTES_LENGTH) ?? '',
    },
    stops: normalizedStops,
  }
}

export function stopFromPlace(place, { order = null, reason = null } = {}) {
  const stop = normalizeStoredStop(
    {
      place,
      reason: reason ?? 'Parada añadida manualmente desde OpenStreetMap.',
      visitMinutes: null,
      visitEstimate: false,
    },
    order === null ? 0 : Math.max(0, order - 1),
  )
  return stop
}

export function replaceStopPlace(stop, place) {
  const next = normalizeStoredStop(
    {
      place,
      reason: stop?.reason,
      visitMinutes: stop?.visitMinutes,
      visitEstimate: stop?.visitEstimate,
    },
    stop?.order ? stop.order - 1 : 0,
  )
  return next
}

export function removeStopAt(stops, index, origin) {
  const next = (Array.isArray(stops) ? stops : []).filter((_, position) => position !== index)
  if (next.length === 0) {
    fail('El itinerario debe conservar al menos una parada.')
  }
  return recalculateStopDistances(next, origin)
}

export function moveStop(stops, index, direction) {
  const current = Array.isArray(stops) ? [...stops] : []
  const target = index + direction
  if (index < 0 || index >= current.length || target < 0 || target >= current.length) {
    return current
  }
  const [item] = current.splice(index, 1)
  current.splice(target, 0, item)
  return current
}

/**
 * Reconstruye la forma que espera el componente visual y el mapa del chat a
 * partir del registro guardado. Los datos ausentes no se rellenan.
 */
export function itineraryToView(record) {
  if (!record || typeof record !== 'object') return null

  const preferences =
    record.preferences &&
    typeof record.preferences === 'object' &&
    !Array.isArray(record.preferences)
      ? record.preferences
      : {}
  const origin = normalizeOrigin(preferences.origin)
  const normalizedStops = []
  if (Array.isArray(record.stops)) {
    record.stops.forEach((stop, index) => {
      try {
        normalizedStops.push(normalizeStoredStop(stop, index))
      } catch {
        // Un registro antiguo o manipulado puede contener una parada inválida.
        // Se omite esa parada, pero se conserva el resto del itinerario.
      }
    })
  }
  const stops = recalculateStopDistances(normalizedStops, origin).map((stop) => ({
    order: stop.order,
    place: {
      id: stop.placeId,
      name: stop.name,
      address: stop.address,
      category: stop.category,
      icon: stop.icon,
      location: stop.location,
      osmUrl: stop.osmUrl,
    },
    reason: stop.reason,
    visitMinutes: stop.visitMinutes,
    visitEstimate: stop.visitEstimate,
    distanceFromOriginMeters: stop.distanceFromOriginMeters,
    distanceFromPreviousMeters: stop.distanceFromPreviousMeters,
  }))

  const amount =
    record.budget_amount === null || record.budget_amount === undefined
      ? null
      : Number(record.budget_amount)

  return {
    title: record.title ?? 'Itinerario guardado',
    summary: record.description ?? null,
    date: record.start_date ?? null,
    durationDays: record.duration_days ?? null,
    travelers: record.party_size ?? null,
    createdAt: record.created_at ?? null,
    updatedAt: record.updated_at ?? null,
    budget:
      Number.isFinite(amount) && record.budget_currency
        ? {
            amount,
            currency: record.budget_currency,
            scope: preferences.budgetScope === 'persona' ? 'persona' : 'total',
          }
        : null,
    origin,
    stops,
    warnings: normalizeWarnings(preferences.warnings),
    dataSource: preferences.dataSource ?? 'openstreetmap',
    attribution: preferences.attribution ?? null,
    attributionUrl: preferences.attributionUrl ?? null,
    distanceMethod: preferences.distanceMethod ?? 'haversine',
    generatedAt: preferences.generatedAt ?? null,
  }
}
