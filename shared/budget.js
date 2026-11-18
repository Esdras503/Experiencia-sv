/**
 * Presupuestos estimados de Experiencia SV.
 *
 * Este módulo es intencionalmente puro: se usa tanto en el navegador como en
 * las funciones serverless. Los importes se guardan en centavos enteros para
 * evitar errores de punto flotante. Ningún valor de esta lista es una tarifa
 * verificada de un proveedor: son valores de referencia que el administrador
 * puede cambiar desde /admin/presupuestos.
 */

export const BUDGET_CURRENCY = 'USD'
export const BUDGET_CURRENCY_OPTIONS = ['USD']

export const BUDGET_TRANSPORT_MODES = Object.freeze(['particular', 'publico'])
export const BUDGET_MEAL_TIERS = Object.freeze(['economico', 'estandar', 'premium'])
export const BUDGET_LODGING_TIERS = Object.freeze(['economico', 'estandar', 'premium'])
export const BUDGET_VERIFICATION_STATUSES = Object.freeze([
  'verified',
  'estimated',
  'unverified',
])

export const TRANSPORT_MODE_OPTIONS = Object.freeze([
  {
    id: 'particular',
    label: 'Vehículo particular',
    description: 'Combustible, estacionamiento y peajes del grupo.',
  },
  {
    id: 'publico',
    label: 'Transporte público',
    description: 'Tarifa estimada por tramo y persona.',
  },
])

export const MEAL_TIER_OPTIONS = Object.freeze([
  { id: 'economico', label: 'Económico' },
  { id: 'estandar', label: 'Estándar' },
  { id: 'premium', label: 'Premium' },
])

export const LODGING_TIER_OPTIONS = Object.freeze([
  { id: 'economico', label: 'Económico' },
  { id: 'estandar', label: 'Estándar' },
  { id: 'premium', label: 'Premium' },
])

export const BUDGET_CATEGORY_LABELS = Object.freeze({
  transport: 'Transporte',
  meals: 'Alimentación',
  admissions: 'Entradas',
  activities: 'Actividades',
  lodging: 'Hospedaje',
  extras: 'Gastos adicionales',
})

export const BUDGET_CATEGORY_KEYS = Object.freeze([
  'transport',
  'meals',
  'admissions',
  'activities',
  'lodging',
  'extras',
])

export function createDefaultBudgetSettings() {
  return {
    currency: BUDGET_CURRENCY,
    fuelPricePerLiterCents: 105,
    vehicleConsumptionLitersPer100Km: 8.5,
    fuelSafetyMarginPercent: 10,
    parkingPerDayCents: 300,
    tollsPerDayCents: 0,
    publicTransportPerKmPerPersonCents: 4,
    publicTransportMinimumPerLegCents: 30,
    averageSpeedKmh: 45,
    roadFactor: 1.25,
    mealTiers: {
      economico: {
        breakfastCents: 250,
        lunchCents: 400,
        dinnerCents: 350,
        snackCents: 150,
      },
      estandar: {
        breakfastCents: 400,
        lunchCents: 700,
        dinnerCents: 600,
        snackCents: 200,
      },
      premium: {
        breakfastCents: 700,
        lunchCents: 1400,
        dinnerCents: 1200,
        snackCents: 300,
      },
    },
    lodgingPerPersonNightCents: {
      economico: 1800,
      estandar: 3500,
      premium: 7000,
    },
    activityAllowancePerPersonPerDayCents: 500,
    unverifiedEntranceMinPerPersonCents: 0,
    unverifiedEntranceMaxPerPersonCents: 1000,
    extrasPercent: 10,
    estimateRangePercent: 10,
  }
}

/**
 * Copia profunda de los valores por defecto. Se usa para que un cambio en una
 * prueba o en una respuesta no altere la configuración global del proceso.
 */
export const DEFAULT_BUDGET_SETTINGS = createDefaultBudgetSettings()

function copyMealTiers(value) {
  const base = createDefaultBudgetSettings().mealTiers
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base

  return {
    economico: { ...base.economico, ...(value.economico ?? {}) },
    estandar: { ...base.estandar, ...(value.estandar ?? {}) },
    premium: { ...base.premium, ...(value.premium ?? {}) },
  }
}

function copyLodgingTiers(value) {
  const base = createDefaultBudgetSettings().lodgingPerPersonNightCents
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base

  return {
    economico:
      value.economico === undefined ? base.economico : value.economico,
    estandar: value.estandar === undefined ? base.estandar : value.estandar,
    premium: value.premium === undefined ? base.premium : value.premium,
  }
}

export function mergeBudgetSettings(value) {
  const base = createDefaultBudgetSettings()
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base

  return {
    ...base,
    ...value,
    currency:
      typeof value.currency === 'string' && /^[A-Z]{3}$/.test(value.currency.trim())
        ? value.currency.trim().toUpperCase()
        : base.currency,
    mealTiers: copyMealTiers(value.mealTiers),
    lodgingPerPersonNightCents: copyLodgingTiers(value.lodgingPerPersonNightCents),
  }
}

export function isBudgetTransportMode(value) {
  return BUDGET_TRANSPORT_MODES.includes(value)
}

export function isBudgetMealTier(value) {
  return BUDGET_MEAL_TIERS.includes(value)
}

export function isBudgetLodgingTier(value) {
  return BUDGET_LODGING_TIERS.includes(value)
}

export function isBudgetVerificationStatus(value) {
  return BUDGET_VERIFICATION_STATUSES.includes(value)
}

/**
 * Resumen compacto que viaja dentro del itinerario firmado. El presupuesto
 * completo se devuelve aparte para la interfaz; este resumen solo da contexto
 * al modelo en el turno siguiente.
 */
export function summarizeBudgetEstimate(estimate) {
  if (!estimate || typeof estimate !== 'object') return null
  const totals = estimate.totals
  const inputs = estimate.inputs
  if (!totals || !inputs) return null

  return {
    currency: estimate.currency ?? BUDGET_CURRENCY,
    totalMinCents: Number(totals.minCents) || 0,
    totalMaxCents: Number(totals.maxCents) || 0,
    perPersonMinCents: Number(totals.perPersonMinCents) || 0,
    perPersonMaxCents: Number(totals.perPersonMaxCents) || 0,
    perDayMinCents: Number(totals.perDayMinCents) || 0,
    perDayMaxCents: Number(totals.perDayMaxCents) || 0,
    partySize: Number(inputs.travelers) || 1,
    days: Number(inputs.days) || 1,
    nights: Number(inputs.nights) || 0,
    transportMode: inputs.transportMode ?? null,
    mealTier: inputs.mealTier ?? null,
    lodgingTier: inputs.lodgingTier ?? null,
    includeLodging: inputs.includeLodging === true,
    distanceMeters: Number(estimate.route?.distanceMeters) || 0,
    durationSeconds: Number(estimate.route?.durationSeconds) || 0,
    distanceSource: estimate.route?.source ?? null,
    verifiedEntrances: Number(estimate.verification?.verifiedEntrances) || 0,
    estimatedEntrances: Number(estimate.verification?.estimatedEntrances) || 0,
    unverifiedEntrances: Number(estimate.verification?.unverifiedEntrances) || 0,
    pricingSource: estimate.pricingSource ?? null,
    generatedAt: estimate.generatedAt ?? null,
  }
}

export function formatCentsForPrompt(cents) {
  const value = Number(cents)
  if (!Number.isFinite(value)) return 'monto no disponible'
  return `$${(value / 100).toFixed(2)}`
}
