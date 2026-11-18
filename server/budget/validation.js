import {
  BUDGET_CURRENCY,
  BUDGET_LODGING_TIERS,
  BUDGET_MEAL_TIERS,
  BUDGET_TRANSPORT_MODES,
  BUDGET_VERIFICATION_STATUSES,
  DEFAULT_BUDGET_SETTINGS,
  mergeBudgetSettings,
} from '../../shared/budget.js'
import { isValidLatitude, isValidLongitude } from '../../shared/geo.js'
import { parseOsmId } from '../../shared/osm.js'
import { assertPlainObject, invalidRequest } from '../validation.js'

const MAX_ITINERARY_STOPS = 20
const MAX_TITLE_LENGTH = 120
const MAX_SUMMARY_LENGTH = 600
const MAX_STOP_NAME_LENGTH = 200
const MAX_ADDRESS_LENGTH = 300
const MAX_REASON_LENGTH = 360
const MAX_ORIGIN_LABEL_LENGTH = 160
const MAX_WARNINGS = 10
const MAX_WARNING_LENGTH = 260
const MAX_DURATION_DAYS = 60
const MAX_TRAVELERS = 50
const MAX_PRICE_CENTS = 100_000_000
const MAX_GROUP_PEOPLE = 50
const MAX_SOURCE_LENGTH = 300
const MAX_NOTES_LENGTH = 500
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const CURRENCY_PATTERN = /^[A-Z]{3}$/

function hasControlChars(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 31 || code === 127) return true
  }
  return false
}

function cleanText(value, maxLength, field) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') {
    throw invalidRequest(`El campo "${field}" debe ser texto.`)
  }
  const text = value.trim()
  if (!text) return null
  if (text.length > maxLength) {
    throw invalidRequest(`El campo "${field}" no puede superar ${maxLength} caracteres.`)
  }
  if (hasControlChars(text)) {
    throw invalidRequest(`El campo "${field}" contiene caracteres no permitidos.`)
  }
  return text
}

function requiredText(value, maxLength, field) {
  const text = cleanText(value, maxLength, field)
  if (!text) throw invalidRequest(`El campo "${field}" es obligatorio.`)
  return text
}

function optionalInteger(value, { field, min, max, fallback = null }) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw invalidRequest(`El campo "${field}" debe ser un entero entre ${min} y ${max}.`)
  }
  return parsed
}

function optionalCents(value, { field, fallback = null } = {}) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_PRICE_CENTS) {
    throw invalidRequest(`El campo "${field}" debe ser un monto entero entre 0 y ${MAX_PRICE_CENTS}.`)
  }
  return parsed
}

function optionalBoolean(value, { field, fallback = false }) {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'boolean') {
    throw invalidRequest(`El campo "${field}" debe ser verdadero o falso.`)
  }
  return value
}

function optionalCurrency(value, { fallback = BUDGET_CURRENCY } = {}) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value !== 'string') {
    throw invalidRequest('La moneda debe ser un código de tres letras.')
  }
  const currency = value.trim().toUpperCase()
  if (!CURRENCY_PATTERN.test(currency)) {
    throw invalidRequest('La moneda debe ser un código ISO de tres letras, por ejemplo USD.')
  }
  return currency
}

function optionalIsoDate(value, field) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value.trim())) {
    throw invalidRequest(`El campo "${field}" debe usar el formato AAAA-MM-DD.`)
  }
  const text = value.trim()
  const parsed = new Date(`${text}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw invalidRequest(`El campo "${field}" no es una fecha válida.`)
  }
  return text
}

function optionalUuid(value, field) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw invalidRequest(`El campo "${field}" no es un identificador válido.`)
  }
  return value.trim()
}

function normalizeLocation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const latitude = Number(value.latitude)
  const longitude = Number(value.longitude)
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null
  return { latitude, longitude }
}

function normalizeBudgetOptions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const options = {
    transportMode: BUDGET_TRANSPORT_MODES.includes(value.transportMode)
      ? value.transportMode
      : null,
    mealTier: BUDGET_MEAL_TIERS.includes(value.mealTier) ? value.mealTier : null,
    lodgingTier: BUDGET_LODGING_TIERS.includes(value.lodgingTier)
      ? value.lodgingTier
      : null,
    includeLodging:
      typeof value.includeLodging === 'boolean' ? value.includeLodging : null,
  }
  return options.transportMode ||
    options.mealTier ||
    options.lodgingTier ||
    options.includeLodging !== null
    ? options
    : null
}

function normalizeBudget(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const amount = Number(value.amount)
  if (!Number.isFinite(amount) || amount < 0 || amount > 100_000_000) return null
  const currency = optionalCurrency(value.currency)
  const scope = value.scope === 'persona' ? 'persona' : 'total'
  return { amount, currency, scope }
}

function normalizeWarnings(value) {
  if (!Array.isArray(value)) return []
  const warnings = []
  for (const raw of value.slice(0, MAX_WARNINGS)) {
    if (typeof raw !== 'string') continue
    const warning = raw.trim()
    if (warning && warning.length <= MAX_WARNING_LENGTH) warnings.push(warning)
  }
  return warnings
}

function normalizeStop(rawStop) {
  const stop = assertPlainObject(rawStop, 'stops[]')
  const place = assertPlainObject(stop.place ?? stop, 'stops[].place')
  const name = requiredText(
    place.name ?? stop.name,
    MAX_STOP_NAME_LENGTH,
    'stops[].place.name',
  )
  const rawId = place.id ?? stop.placeId
  const id = parseOsmId(rawId) ? rawId : null
  const location = normalizeLocation(place.location ?? stop.location)
  const address = cleanText(
    place.address ?? stop.address,
    MAX_ADDRESS_LENGTH,
    'stops[].place.address',
  )
  const category = cleanText(
    place.category ?? stop.category,
    80,
    'stops[].place.category',
  )
  const icon = cleanText(place.icon ?? stop.icon, 12, 'stops[].place.icon')
  const reason = cleanText(stop.reason, MAX_REASON_LENGTH, 'stops[].reason')
  const visitMinutes = optionalInteger(stop.visitMinutes, {
    field: 'stops[].visitMinutes',
    min: 1,
    max: 1440,
  })

  return {
    place: {
      id,
      name,
      address,
      category,
      icon,
      location,
    },
    reason,
    visitMinutes,
  }
}

/**
 * Normaliza solo los datos necesarios para estimar. Ignora deliberadamente
 * cualquier precio, tarifa o configuración enviada por el cliente: esas
 * cantidades se leen del backend.
 */
export function normalizeBudgetItinerary(raw) {
  const itinerary = assertPlainObject(raw, 'itinerary')
  const rawStops = Array.isArray(itinerary.stops) ? itinerary.stops : []
  if (rawStops.length === 0) {
    throw invalidRequest('El itinerario debe tener al menos una parada para calcular el presupuesto.')
  }
  if (rawStops.length > MAX_ITINERARY_STOPS) {
    throw invalidRequest(`El itinerario no puede superar ${MAX_ITINERARY_STOPS} paradas.`)
  }

  const stops = rawStops.map(normalizeStop)
  const originRaw = itinerary.origin
  let origin = null
  if (originRaw !== undefined && originRaw !== null) {
    const originObject = assertPlainObject(originRaw, 'itinerary.origin')
    const label = cleanText(
      originObject.label,
      MAX_ORIGIN_LABEL_LENGTH,
      'itinerary.origin.label',
    )
    const location = normalizeLocation(originObject)
    if (label && location) origin = { label, ...location }
  }

  return {
    title: cleanText(itinerary.title, MAX_TITLE_LENGTH, 'itinerary.title'),
    summary: cleanText(itinerary.summary, MAX_SUMMARY_LENGTH, 'itinerary.summary'),
    date: optionalIsoDate(itinerary.date, 'itinerary.date'),
    durationDays: optionalInteger(itinerary.durationDays, {
      field: 'itinerary.durationDays',
      min: 1,
      max: MAX_DURATION_DAYS,
    }),
    travelers: optionalInteger(itinerary.travelers, {
      field: 'itinerary.travelers',
      min: 1,
      max: MAX_TRAVELERS,
    }),
    budget: normalizeBudget(itinerary.budget),
    budgetOptions: normalizeBudgetOptions(itinerary.budgetOptions),
    origin,
    stops,
    warnings: normalizeWarnings(itinerary.warnings),
  }
}

export function normalizeBudgetOptionsForItinerary(rawOptions, itinerary) {
  const options = assertPlainObject(rawOptions, 'options')
  const defaults = itinerary?.budgetOptions ?? {}
  const travelers = optionalInteger(options.travelers, {
    field: 'options.travelers',
    min: 1,
    max: MAX_TRAVELERS,
    fallback: itinerary?.travelers ?? 1,
  })
  const children = optionalInteger(options.children, {
    field: 'options.children',
    min: 0,
    max: travelers,
    fallback: 0,
  })
  const days = optionalInteger(options.days, {
    field: 'options.days',
    min: 1,
    max: MAX_DURATION_DAYS,
    fallback: itinerary?.durationDays ?? 1,
  })
  const transportMode =
    options.transportMode === undefined || options.transportMode === null
      ? (defaults.transportMode ?? 'particular')
      : options.transportMode
  if (!BUDGET_TRANSPORT_MODES.includes(transportMode)) {
    throw invalidRequest('El medio de transporte no es válido.')
  }
  const mealTier =
    options.mealTier === undefined || options.mealTier === null
      ? (defaults.mealTier ?? 'estandar')
      : options.mealTier
  if (!BUDGET_MEAL_TIERS.includes(mealTier)) {
    throw invalidRequest('El nivel de alimentación no es válido.')
  }
  const lodgingTier =
    options.lodgingTier === undefined || options.lodgingTier === null
      ? (defaults.lodgingTier ?? 'estandar')
      : options.lodgingTier
  if (!BUDGET_LODGING_TIERS.includes(lodgingTier)) {
    throw invalidRequest('El nivel de hospedaje no es válido.')
  }
  const includeLodging =
    options.includeLodging === undefined || options.includeLodging === null
      ? (typeof defaults.includeLodging === 'boolean'
          ? defaults.includeLodging
          : days > 1)
      : optionalBoolean(options.includeLodging, {
          field: 'options.includeLodging',
          fallback: days > 1,
        })
  const nights = includeLodging
    ? optionalInteger(options.nights, {
        field: 'options.nights',
        min: 0,
        max: MAX_DURATION_DAYS,
        fallback: days > 1 ? days - 1 : 1,
      })
    : 0

  return {
    travelers,
    adults: travelers - children,
    children,
    days,
    nights,
    transportMode,
    mealTier,
    lodgingTier,
    includeLodging,
  }
}

export function normalizeBudgetRequest(input) {
  const body = assertPlainObject(input, 'body')
  const itinerary = normalizeBudgetItinerary(body.itinerary)
  const options = normalizeBudgetOptionsForItinerary(body.options, itinerary)
  const itineraryId =
    optionalUuid(body.itineraryId, 'itineraryId') ??
    optionalUuid(body.options?.itineraryId, 'options.itineraryId')

  return { itinerary, options, itineraryId }
}

function mergeSettingNumber(value, fallback, { field, min, max, integer = false }) {
  const parsed =
    value === undefined || value === null || value === ''
      ? fallback
      : Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw invalidRequest(`El campo "${field}" debe estar entre ${min} y ${max}.`)
  }
  if (integer && !Number.isInteger(parsed)) {
    throw invalidRequest(`El campo "${field}" debe ser un entero.`)
  }
  return parsed
}

export function normalizeAdminBudgetSettings(raw, currentSettings = DEFAULT_BUDGET_SETTINGS) {
  const body = assertPlainObject(raw, 'body')
  const input = body.settings === undefined ? body : assertPlainObject(body.settings, 'settings')
  const current = mergeBudgetSettings(currentSettings)
  const settings = {
    ...current,
    mealTiers: {
      economico: { ...current.mealTiers.economico },
      estandar: { ...current.mealTiers.estandar },
      premium: { ...current.mealTiers.premium },
    },
    lodgingPerPersonNightCents: { ...current.lodgingPerPersonNightCents },
  }

  settings.currency = optionalCurrency(input.currency, { fallback: current.currency })
  settings.fuelPricePerLiterCents = mergeSettingNumber(
    input.fuelPricePerLiterCents,
    current.fuelPricePerLiterCents,
    { field: 'fuelPricePerLiterCents', min: 0, max: 100_000, integer: true },
  )
  settings.vehicleConsumptionLitersPer100Km = mergeSettingNumber(
    input.vehicleConsumptionLitersPer100Km,
    current.vehicleConsumptionLitersPer100Km,
    { field: 'vehicleConsumptionLitersPer100Km', min: 1, max: 50 },
  )
  settings.fuelSafetyMarginPercent = mergeSettingNumber(
    input.fuelSafetyMarginPercent,
    current.fuelSafetyMarginPercent,
    { field: 'fuelSafetyMarginPercent', min: 0, max: 100 },
  )
  settings.parkingPerDayCents = mergeSettingNumber(
    input.parkingPerDayCents,
    current.parkingPerDayCents,
    { field: 'parkingPerDayCents', min: 0, max: 1_000_000, integer: true },
  )
  settings.tollsPerDayCents = mergeSettingNumber(
    input.tollsPerDayCents,
    current.tollsPerDayCents,
    { field: 'tollsPerDayCents', min: 0, max: 1_000_000, integer: true },
  )
  settings.publicTransportPerKmPerPersonCents = mergeSettingNumber(
    input.publicTransportPerKmPerPersonCents,
    current.publicTransportPerKmPerPersonCents,
    { field: 'publicTransportPerKmPerPersonCents', min: 0, max: 100_000 },
  )
  settings.publicTransportMinimumPerLegCents = mergeSettingNumber(
    input.publicTransportMinimumPerLegCents,
    current.publicTransportMinimumPerLegCents,
    { field: 'publicTransportMinimumPerLegCents', min: 0, max: 100_000, integer: true },
  )
  settings.averageSpeedKmh = mergeSettingNumber(
    input.averageSpeedKmh,
    current.averageSpeedKmh,
    { field: 'averageSpeedKmh', min: 5, max: 120 },
  )
  settings.roadFactor = mergeSettingNumber(
    input.roadFactor,
    current.roadFactor,
    { field: 'roadFactor', min: 1, max: 2 },
  )
  settings.activityAllowancePerPersonPerDayCents = mergeSettingNumber(
    input.activityAllowancePerPersonPerDayCents,
    current.activityAllowancePerPersonPerDayCents,
    {
      field: 'activityAllowancePerPersonPerDayCents',
      min: 0,
      max: 1_000_000,
      integer: true,
    },
  )
  settings.unverifiedEntranceMinPerPersonCents = mergeSettingNumber(
    input.unverifiedEntranceMinPerPersonCents,
    current.unverifiedEntranceMinPerPersonCents,
    {
      field: 'unverifiedEntranceMinPerPersonCents',
      min: 0,
      max: 1_000_000,
      integer: true,
    },
  )
  settings.unverifiedEntranceMaxPerPersonCents = mergeSettingNumber(
    input.unverifiedEntranceMaxPerPersonCents,
    current.unverifiedEntranceMaxPerPersonCents,
    {
      field: 'unverifiedEntranceMaxPerPersonCents',
      min: 0,
      max: 1_000_000,
      integer: true,
    },
  )
  if (
    settings.unverifiedEntranceMaxPerPersonCents <
    settings.unverifiedEntranceMinPerPersonCents
  ) {
    throw invalidRequest(
      'El máximo de entrada no verificada no puede ser menor que el mínimo.',
    )
  }
  settings.extrasPercent = mergeSettingNumber(
    input.extrasPercent,
    current.extrasPercent,
    { field: 'extrasPercent', min: 0, max: 50 },
  )
  settings.estimateRangePercent = mergeSettingNumber(
    input.estimateRangePercent,
    current.estimateRangePercent,
    { field: 'estimateRangePercent', min: 0, max: 50 },
  )

  if (input.mealTiers !== undefined) {
    const mealTiers = assertPlainObject(input.mealTiers, 'mealTiers')
    for (const tier of BUDGET_MEAL_TIERS) {
      const rawTier = mealTiers[tier]
      if (rawTier === undefined) continue
      const values = assertPlainObject(rawTier, `mealTiers.${tier}`)
      for (const meal of ['breakfastCents', 'lunchCents', 'dinnerCents', 'snackCents']) {
        settings.mealTiers[tier][meal] = mergeSettingNumber(
          values[meal],
          current.mealTiers[tier][meal],
          {
            field: `mealTiers.${tier}.${meal}`,
            min: 0,
            max: 1_000_000,
            integer: true,
          },
        )
      }
    }
  }

  if (input.lodgingPerPersonNightCents !== undefined) {
    const lodging = assertPlainObject(
      input.lodgingPerPersonNightCents,
      'lodgingPerPersonNightCents',
    )
    for (const tier of BUDGET_LODGING_TIERS) {
      if (lodging[tier] === undefined) continue
      settings.lodgingPerPersonNightCents[tier] = mergeSettingNumber(
        lodging[tier],
        current.lodgingPerPersonNightCents[tier],
        {
          field: `lodgingPerPersonNightCents.${tier}`,
          min: 0,
          max: 1_000_000,
          integer: true,
        },
      )
    }
  }

  return settings
}

export function normalizeAdminEntrancePrice(raw) {
  const body = assertPlainObject(raw, 'body')
  const input =
    body.entrance === undefined ? body : assertPlainObject(body.entrance, 'entrance')
  const name = requiredText(input.name, 160, 'entrance.name')
  const rawPlaceId = input.placeId
  let placeId = null
  if (rawPlaceId !== undefined && rawPlaceId !== null && rawPlaceId !== '') {
    if (typeof rawPlaceId !== 'string' || !parseOsmId(rawPlaceId)) {
      throw invalidRequest('El identificador de OpenStreetMap no es válido.')
    }
    placeId = rawPlaceId.trim()
  }
  const verificationStatus = input.verificationStatus ?? 'unverified'
  if (!BUDGET_VERIFICATION_STATUSES.includes(verificationStatus)) {
    throw invalidRequest('El estado de verificación no es válido.')
  }
  const verifiedAt = optionalIsoDate(input.verifiedAt, 'entrance.verifiedAt')
  const source = cleanText(input.source, MAX_SOURCE_LENGTH, 'entrance.source')
  if (verificationStatus === 'verified' && (!source || !verifiedAt)) {
    throw invalidRequest(
      'Una entrada verificada debe indicar la fuente y la fecha de verificación.',
    )
  }
  const groupCents = optionalCents(input.groupCents, { field: 'entrance.groupCents' })
  const groupMinPeople = optionalInteger(input.groupMinPeople, {
    field: 'entrance.groupMinPeople',
    min: 1,
    max: MAX_GROUP_PEOPLE,
    fallback: groupCents === null ? null : 1,
  })

  return {
    id: optionalUuid(input.id, 'entrance.id'),
    placeId,
    name,
    category: cleanText(input.category, 80, 'entrance.category'),
    adultCents: optionalCents(input.adultCents, { field: 'entrance.adultCents' }),
    childCents: optionalCents(input.childCents, { field: 'entrance.childCents' }),
    groupCents,
    groupMinPeople,
    activityCents: optionalCents(input.activityCents, { field: 'entrance.activityCents' }),
    currency: optionalCurrency(input.currency),
    source,
    verifiedAt,
    verificationStatus,
    notes: cleanText(input.notes, MAX_NOTES_LENGTH, 'entrance.notes'),
    isActive: optionalBoolean(input.isActive, { field: 'entrance.isActive', fallback: true }),
  }
}

export function normalizeAdminEntranceId(raw) {
  const body = assertPlainObject(raw, 'body')
  return optionalUuid(body.id ?? body.entranceId, 'id')
}
