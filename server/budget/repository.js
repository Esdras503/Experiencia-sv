import { createClient } from '@supabase/supabase-js'
import {
  BUDGET_CURRENCY,
  DEFAULT_BUDGET_SETTINGS,
  mergeBudgetSettings,
  summarizeBudgetEstimate,
} from '../../shared/budget.js'
import { AppError, ERROR_CODES, redactSecrets } from '../errors.js'

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function parseCsv(value) {
  if (typeof value !== 'string') return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function toNullableInteger(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed) : null
}

function toInteger(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function requireObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function requireArray(value) {
  return Array.isArray(value) ? value : []
}

function safeLog(logError, context, error) {
  try {
    logError(`[budget] ${context}`, {
      code: error?.code ?? error?.name ?? 'UNKNOWN',
      message: redactSecrets(error?.message ?? '').slice(0, 300),
    })
  } catch {
    // El registro nunca debe romper una respuesta.
  }
}

export function resolveBudgetBackend(env = {}) {
  const url = firstNonEmpty(env.SUPABASE_URL, env.VITE_SUPABASE_URL)
  const anonKey = firstNonEmpty(
    env.SUPABASE_ANON_KEY,
    env.SUPABASE_PUBLISHABLE_KEY,
    env.VITE_SUPABASE_ANON_KEY,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )
  const serviceRoleKey = firstNonEmpty(env.SUPABASE_SERVICE_ROLE_KEY)
  const adminEmails = new Set(
    parseCsv(env.ADMIN_EMAILS).map((email) => email.toLowerCase()),
  )
  const adminUserIds = new Set(parseCsv(env.ADMIN_USER_IDS))
  return {
    url,
    anonKey,
    serviceRoleKey,
    configured: Boolean(url && anonKey && serviceRoleKey),
    enabled: Boolean(url && serviceRoleKey),
    adminEmails,
    adminUserIds,
    adminEnabled: Boolean(
      url && anonKey && serviceRoleKey && (adminEmails.size > 0 || adminUserIds.size > 0),
    ),
  }
}

export function settingsFromRow(row) {
  if (!row || typeof row !== 'object') {
    return { ...DEFAULT_BUDGET_SETTINGS, source: 'defaults' }
  }
  const settings = mergeBudgetSettings({
    currency: row.currency,
    fuelPricePerLiterCents: toInteger(row.fuel_price_per_liter_cents),
    vehicleConsumptionLitersPer100Km: toNumber(
      row.vehicle_consumption_liters_per_100km,
    ),
    fuelSafetyMarginPercent: toNumber(row.fuel_safety_margin_percent),
    parkingPerDayCents: toInteger(row.parking_per_day_cents),
    tollsPerDayCents: toInteger(row.tolls_per_day_cents),
    publicTransportPerKmPerPersonCents: toNumber(
      row.public_transport_per_km_per_person_cents,
    ),
    publicTransportMinimumPerLegCents: toInteger(
      row.public_transport_min_per_leg_cents,
    ),
    averageSpeedKmh: toNumber(row.average_speed_kmh),
    roadFactor: toNumber(row.road_factor),
    mealTiers: {
      economico: {
        breakfastCents: toInteger(row.meal_economico_breakfast_cents),
        lunchCents: toInteger(row.meal_economico_lunch_cents),
        dinnerCents: toInteger(row.meal_economico_dinner_cents),
        snackCents: toInteger(row.meal_economico_snack_cents),
      },
      estandar: {
        breakfastCents: toInteger(row.meal_estandar_breakfast_cents),
        lunchCents: toInteger(row.meal_estandar_lunch_cents),
        dinnerCents: toInteger(row.meal_estandar_dinner_cents),
        snackCents: toInteger(row.meal_estandar_snack_cents),
      },
      premium: {
        breakfastCents: toInteger(row.meal_premium_breakfast_cents),
        lunchCents: toInteger(row.meal_premium_lunch_cents),
        dinnerCents: toInteger(row.meal_premium_dinner_cents),
        snackCents: toInteger(row.meal_premium_snack_cents),
      },
    },
    lodgingPerPersonNightCents: {
      economico: toInteger(row.lodging_economico_per_person_night_cents),
      estandar: toInteger(row.lodging_estandar_per_person_night_cents),
      premium: toInteger(row.lodging_premium_per_person_night_cents),
    },
    activityAllowancePerPersonPerDayCents: toInteger(
      row.activity_allowance_per_person_per_day_cents,
    ),
    unverifiedEntranceMinPerPersonCents: toInteger(
      row.unverified_entrance_min_per_person_cents,
    ),
    unverifiedEntranceMaxPerPersonCents: toInteger(
      row.unverified_entrance_max_per_person_cents,
    ),
    extrasPercent: toNumber(row.extras_percent),
    estimateRangePercent: toNumber(row.estimate_range_percent),
  })
  return { ...settings, source: 'supabase' }
}

export function settingsToRow(settings) {
  const value = mergeBudgetSettings(settings)
  return {
    id: 1,
    currency: value.currency,
    fuel_price_per_liter_cents: value.fuelPricePerLiterCents,
    vehicle_consumption_liters_per_100km: value.vehicleConsumptionLitersPer100Km,
    fuel_safety_margin_percent: value.fuelSafetyMarginPercent,
    parking_per_day_cents: value.parkingPerDayCents,
    tolls_per_day_cents: value.tollsPerDayCents,
    public_transport_per_km_per_person_cents:
      value.publicTransportPerKmPerPersonCents,
    public_transport_min_per_leg_cents: value.publicTransportMinimumPerLegCents,
    average_speed_kmh: value.averageSpeedKmh,
    road_factor: value.roadFactor,
    meal_economico_breakfast_cents: value.mealTiers.economico.breakfastCents,
    meal_economico_lunch_cents: value.mealTiers.economico.lunchCents,
    meal_economico_dinner_cents: value.mealTiers.economico.dinnerCents,
    meal_economico_snack_cents: value.mealTiers.economico.snackCents,
    meal_estandar_breakfast_cents: value.mealTiers.estandar.breakfastCents,
    meal_estandar_lunch_cents: value.mealTiers.estandar.lunchCents,
    meal_estandar_dinner_cents: value.mealTiers.estandar.dinnerCents,
    meal_estandar_snack_cents: value.mealTiers.estandar.snackCents,
    meal_premium_breakfast_cents: value.mealTiers.premium.breakfastCents,
    meal_premium_lunch_cents: value.mealTiers.premium.lunchCents,
    meal_premium_dinner_cents: value.mealTiers.premium.dinnerCents,
    meal_premium_snack_cents: value.mealTiers.premium.snackCents,
    lodging_economico_per_person_night_cents:
      value.lodgingPerPersonNightCents.economico,
    lodging_estandar_per_person_night_cents:
      value.lodgingPerPersonNightCents.estandar,
    lodging_premium_per_person_night_cents:
      value.lodgingPerPersonNightCents.premium,
    activity_allowance_per_person_per_day_cents:
      value.activityAllowancePerPersonPerDayCents,
    unverified_entrance_min_per_person_cents:
      value.unverifiedEntranceMinPerPersonCents,
    unverified_entrance_max_per_person_cents:
      value.unverifiedEntranceMaxPerPersonCents,
    extras_percent: value.extrasPercent,
    estimate_range_percent: value.estimateRangePercent,
  }
}

export function entranceFromRow(row) {
  if (!row || typeof row !== 'object') return null
  return {
    id: row.id,
    placeId: row.place_id ?? null,
    name: row.name,
    category: row.category ?? null,
    adultCents: toNullableInteger(row.adult_cents),
    childCents: toNullableInteger(row.child_cents),
    groupCents: toNullableInteger(row.group_cents),
    groupMinPeople: toNullableInteger(row.group_min_people),
    activityCents: toNullableInteger(row.activity_cents),
    currency: row.currency ?? BUDGET_CURRENCY,
    source: row.source ?? null,
    verifiedAt: row.verified_at ?? null,
    verificationStatus: row.verification_status ?? 'unverified',
    notes: row.notes ?? null,
    isActive: row.is_active !== false,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

export function entranceToRow(entrance) {
  const row = {
    place_id: entrance.placeId ?? null,
    name: entrance.name,
    category: entrance.category ?? null,
    adult_cents: entrance.adultCents ?? null,
    child_cents: entrance.childCents ?? null,
    group_cents: entrance.groupCents ?? null,
    group_min_people: entrance.groupMinPeople ?? null,
    activity_cents: entrance.activityCents ?? null,
    currency: entrance.currency ?? BUDGET_CURRENCY,
    source: entrance.source ?? null,
    verified_at: entrance.verifiedAt ?? null,
    verification_status: entrance.verificationStatus ?? 'unverified',
    notes: entrance.notes ?? null,
    is_active: entrance.isActive !== false,
  }
  if (entrance.id) row.id = entrance.id
  return row
}

function estimateRow(estimate, { userId, itineraryId, itineraryTitle, settings }) {
  const inputs = estimate.inputs ?? {}
  return {
    user_id: userId,
    itinerary_id: itineraryId ?? null,
    itinerary_title: itineraryTitle ?? null,
    party_size: toInteger(inputs.travelers, 1),
    adults: toInteger(inputs.adults, 1),
    children: toInteger(inputs.children, 0),
    duration_days: toInteger(inputs.days, 1),
    transport_mode: inputs.transportMode ?? 'particular',
    meal_tier: inputs.mealTier ?? 'estandar',
    lodging_tier: inputs.lodgingTier ?? 'estandar',
    include_lodging: inputs.includeLodging === true,
    nights: toInteger(inputs.nights, 0),
    currency: estimate.currency ?? BUDGET_CURRENCY,
    total_min_cents: toInteger(estimate.totals?.minCents),
    total_max_cents: toInteger(estimate.totals?.maxCents),
    per_person_min_cents: toInteger(estimate.totals?.perPersonMinCents),
    per_person_max_cents: toInteger(estimate.totals?.perPersonMaxCents),
    per_day_min_cents: toInteger(estimate.totals?.perDayMinCents),
    per_day_max_cents: toInteger(estimate.totals?.perDayMaxCents),
    distance_meters: toInteger(estimate.route?.distanceMeters),
    duration_seconds: toInteger(estimate.route?.durationSeconds),
    distance_source: estimate.route?.source ?? null,
    options: inputs,
    summary: {
      ...summarizeBudgetEstimate(estimate),
      verification: estimate.verification ?? null,
      budgetComparison: estimate.budgetComparison ?? null,
      pricingSource: estimate.pricingSource ?? null,
    },
    assumptions: requireArray(estimate.assumptions),
    warnings: requireArray(estimate.warnings),
    pricing_snapshot: settings ?? {},
  }
}

function estimateToApi(row) {
  const summary = requireObject(row.summary)
  return {
    id: row.id,
    itineraryId: row.itinerary_id ?? null,
    itineraryTitle: row.itinerary_title ?? null,
    createdAt: row.created_at ?? null,
    partySize: toInteger(row.party_size, 1),
    adults: toInteger(row.adults, 1),
    children: toInteger(row.children, 0),
    durationDays: toInteger(row.duration_days, 1),
    nights: toInteger(row.nights, 0),
    transportMode: row.transport_mode ?? null,
    mealTier: row.meal_tier ?? null,
    lodgingTier: row.lodging_tier ?? null,
    includeLodging: row.include_lodging === true,
    currency: row.currency ?? BUDGET_CURRENCY,
    totalMinCents: toInteger(row.total_min_cents),
    totalMaxCents: toInteger(row.total_max_cents),
    perPersonMinCents: toInteger(row.per_person_min_cents),
    perPersonMaxCents: toInteger(row.per_person_max_cents),
    perDayMinCents: toInteger(row.per_day_min_cents),
    perDayMaxCents: toInteger(row.per_day_max_cents),
    distanceMeters: toInteger(row.distance_meters),
    durationSeconds: toInteger(row.duration_seconds),
    distanceSource: row.distance_source ?? null,
    summary,
    items: requireArray(row.budget_estimate_items)
      .sort((a, b) => toInteger(a.sort_order) - toInteger(b.sort_order))
      .map((item) => ({
        category: item.category,
        label: item.label,
        minCents: toInteger(item.min_cents),
        maxCents: toInteger(item.max_cents),
        verified: item.verified === true,
        verification: item.verification ?? 'estimated',
        source: item.source ?? null,
        notes: requireArray(item.notes),
      })),
  }
}

function bearerToken(headers) {
  let raw = ''
  if (headers && typeof headers.get === 'function') {
    raw = headers.get('authorization') ?? headers.get('Authorization') ?? ''
  } else if (headers && typeof headers === 'object') {
    raw = headers.authorization ?? headers.Authorization ?? ''
  }
  const match = /^Bearer\s+(.+)$/i.exec(String(raw).trim())
  return match ? match[1].trim() : ''
}

/**
 * Acceso a Supabase para presupuestos. Las escrituras de configuración y las
 * estimaciones usan service_role; la lectura del historial se filtra siempre
 * por el usuario autenticado. La autorización de administrador es una lista
 * de correos/IDs en variables de entorno, no una columna editable por el
 * navegador.
 */
export function createBudgetRepository({ env = {}, logError = () => {} } = {}) {
  const backend = resolveBudgetBackend(env)
  const clientOptions = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    db: { schema: 'public' },
  }
  const admin =
    backend.url && backend.serviceRoleKey
      ? createClient(backend.url, backend.serviceRoleKey, clientOptions)
      : null
  const authClient =
    backend.url && backend.anonKey
      ? createClient(backend.url, backend.anonKey, clientOptions)
      : null

  function requireAdminConfigured() {
    if (!backend.enabled || !admin) {
      throw new AppError(ERROR_CODES.BUDGET_NOT_CONFIGURED, { status: 503 })
    }
    if (!backend.adminEnabled) {
      throw new AppError(ERROR_CODES.BUDGET_NOT_CONFIGURED, {
        status: 503,
        message:
          'Configura ADMIN_EMAILS o ADMIN_USER_IDS en el servidor para habilitar la administración.',
      })
    }
  }

  async function readUserFromToken(accessToken) {
    if (!authClient || !accessToken) return null
    try {
      const { data, error } = await authClient.auth.getUser(accessToken)
      if (error || !data?.user) return null
      return data.user
    } catch (error) {
      safeLog(logError, 'validar sesión', error)
      return null
    }
  }

  async function readUser(headers) {
    const token = bearerToken(headers)
    if (!token) return null
    return readUserFromToken(token)
  }

  async function requireUser(headers) {
    const user = await readUser(headers)
    if (!user?.id) {
      throw new AppError(ERROR_CODES.SESSION_EXPIRED, { status: 401 })
    }
    return user
  }

  function isAdmin(user) {
    if (!user) return false
    if (user.id && backend.adminUserIds.has(user.id)) return true
    const email = typeof user.email === 'string' ? user.email.toLowerCase() : ''
    return Boolean(email && backend.adminEmails.has(email))
  }

  async function requireAdmin(headers) {
    requireAdminConfigured()
    const user = await requireUser(headers)
    if (!isAdmin(user)) {
      throw new AppError(ERROR_CODES.ADMIN_FORBIDDEN, { status: 403 })
    }
    return user
  }

  async function readSettings() {
    if (!admin) return null
    const { data, error } = await admin
      .from('budget_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    if (error) {
      safeLog(logError, 'leer configuración', error)
      throw new AppError(ERROR_CODES.BUDGET_UNAVAILABLE, { status: 503 })
    }
    return data ? settingsFromRow(data) : null
  }

  async function listEntrancePrices({ includeInactive = false } = {}) {
    if (!admin) return []
    let query = admin
      .from('budget_entrance_prices')
      .select('*')
      .order('name', { ascending: true })
    if (!includeInactive) query = query.eq('is_active', true)
    const { data, error } = await query
    if (error) {
      safeLog(logError, 'leer catálogo de entradas', error)
      throw new AppError(ERROR_CODES.BUDGET_UNAVAILABLE, { status: 503 })
    }
    return (data ?? []).map(entranceFromRow).filter(Boolean)
  }

  async function updateSettings(settings) {
    if (!admin) throw new AppError(ERROR_CODES.BUDGET_NOT_CONFIGURED, { status: 503 })
    const row = settingsToRow(settings)
    const { data, error } = await admin
      .from('budget_settings')
      .upsert(row, { onConflict: 'id' })
      .select('*')
      .single()
    if (error) {
      safeLog(logError, 'guardar configuración', error)
      throw new AppError(ERROR_CODES.BUDGET_UNAVAILABLE, { status: 503 })
    }
    return settingsFromRow(data)
  }

  async function upsertEntrancePrice(entrance) {
    if (!admin) throw new AppError(ERROR_CODES.BUDGET_NOT_CONFIGURED, { status: 503 })
    const row = entranceToRow(entrance)
    const { data, error } = await admin
      .from('budget_entrance_prices')
      .upsert(row, { onConflict: 'id' })
      .select('*')
      .single()
    if (error) {
      safeLog(logError, 'guardar entrada', error)
      throw new AppError(ERROR_CODES.BUDGET_UNAVAILABLE, { status: 503 })
    }
    return entranceFromRow(data)
  }

  async function deleteEntrancePrice(id) {
    if (!admin) throw new AppError(ERROR_CODES.BUDGET_NOT_CONFIGURED, { status: 503 })
    const { error } = await admin.from('budget_entrance_prices').delete().eq('id', id)
    if (error) {
      safeLog(logError, 'eliminar entrada', error)
      throw new AppError(ERROR_CODES.BUDGET_UNAVAILABLE, { status: 503 })
    }
    return true
  }

  async function loadOwnedItinerary(userId, itineraryId) {
    if (!admin) return null
    const { data, error } = await admin
      .from('itineraries')
      .select('id, user_id, title')
      .eq('id', itineraryId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      safeLog(logError, 'leer itinerario', error)
      throw new AppError(ERROR_CODES.BUDGET_UNAVAILABLE, { status: 503 })
    }
    return data ?? null
  }

  async function saveEstimate({
    userId,
    itineraryId,
    itineraryTitle,
    estimate,
    settings,
  }) {
    if (!admin) return null
    const { data, error } = await admin
      .from('budget_estimates')
      .insert(
        estimateRow(estimate, {
          userId,
          itineraryId,
          itineraryTitle,
          settings,
        }),
      )
      .select('id')
      .single()
    if (error) {
      safeLog(logError, 'guardar presupuesto', error)
      throw new AppError(ERROR_CODES.BUDGET_UNAVAILABLE, { status: 503 })
    }

    const items = requireArray(estimate.breakdown).map((item, index) => ({
      estimate_id: data.id,
      category: item.key,
      label: item.label,
      min_cents: toInteger(item.minCents),
      max_cents: toInteger(item.maxCents),
      verified: item.verification === 'verified',
      verification: item.verification ?? 'estimated',
      source: item.source ?? null,
      notes: requireArray(item.notes),
      sort_order: index,
    }))
    if (items.length > 0) {
      const { error: itemsError } = await admin
        .from('budget_estimate_items')
        .insert(items)
      if (itemsError) {
        safeLog(logError, 'guardar desglose de presupuesto', itemsError)
        await admin.from('budget_estimates').delete().eq('id', data.id)
        throw new AppError(ERROR_CODES.BUDGET_UNAVAILABLE, { status: 503 })
      }
    }
    return data.id
  }

  async function listEstimates({ userId, itineraryId = null, limit = 20 }) {
    if (!admin) throw new AppError(ERROR_CODES.BUDGET_NOT_CONFIGURED, { status: 503 })
    let query = admin
      .from('budget_estimates')
      .select(
        'id,itinerary_id,itinerary_title,created_at,party_size,adults,children,duration_days,nights,transport_mode,meal_tier,lodging_tier,include_lodging,currency,total_min_cents,total_max_cents,per_person_min_cents,per_person_max_cents,per_day_min_cents,per_day_max_cents,distance_meters,duration_seconds,distance_source,summary,budget_estimate_items(category,label,min_cents,max_cents,verified,verification,source,notes,sort_order)',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Math.min(50, Math.max(1, limit)))
    if (itineraryId) query = query.eq('itinerary_id', itineraryId)
    const { data, error } = await query
    if (error) {
      safeLog(logError, 'leer historial', error)
      throw new AppError(ERROR_CODES.BUDGET_UNAVAILABLE, { status: 503 })
    }
    return (data ?? []).map(estimateToApi)
  }

  return {
    enabled: Boolean(admin),
    configured: backend.configured,
    adminEnabled: backend.adminEnabled,
    readUser,
    requireUser,
    requireAdmin,
    isAdmin,
    readSettings,
    listEntrancePrices,
    updateSettings,
    upsertEntrancePrice,
    deleteEntrancePrice,
    loadOwnedItinerary,
    saveEstimate,
    listEstimates,
  }
}
