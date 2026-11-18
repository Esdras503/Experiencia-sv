import {
  BUDGET_CURRENCY,
  BUDGET_LODGING_TIERS,
  BUDGET_MEAL_TIERS,
  BUDGET_TRANSPORT_MODES,
  DEFAULT_BUDGET_SETTINGS,
  LODGING_TIER_OPTIONS,
  MEAL_TIER_OPTIONS,
  TRANSPORT_MODE_OPTIONS,
} from '../../shared/budget.js'
import { AppError, ERROR_CODES, redactSecrets } from '../errors.js'
import { buildRoutePoints, estimateBudget } from './estimator.js'
import {
  createBudgetRepository,
} from './repository.js'
import { createRouteService } from './routeService.js'
import {
  normalizeAdminBudgetSettings,
  normalizeAdminEntranceId,
  normalizeAdminEntrancePrice,
  normalizeBudgetRequest,
} from './validation.js'

const DEFAULT_PRICING_TTL_MS = 5 * 60 * 1000

function clampInteger(value, fallback, min, max) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function safeLog(logError, context, error) {
  try {
    logError(`[budget] ${context}`, {
      code: error?.code ?? error?.name ?? 'UNKNOWN',
      message: redactSecrets(error?.message ?? '').slice(0, 300),
    })
  } catch {
    // El registro no debe interrumpir el cálculo.
  }
}

function abortError() {
  const error = new Error('El cálculo del presupuesto fue cancelado.')
  error.name = 'AbortError'
  return error
}

/**
 * Servicio único de presupuestos. El cálculo siempre ocurre en el backend:
 * el cliente envía el itinerario y sus preferencias, nunca precios. Las
 * tarifas se leen de Supabase (o de los valores por defecto si la migración
 * aún no está aplicada) y las rutas se intentan resolver con OSRM, con
 * respaldo haversine transparente.
 */
export function createBudgetService({
  env = {},
  fetchImpl = fetch,
  now = Date.now,
  logError = () => {},
  repository,
  routeService,
  pricingTtlMs = clampInteger(
    env.BUDGET_PRICING_TTL_MS,
    DEFAULT_PRICING_TTL_MS,
    30_000,
    60 * 60 * 1000,
  ),
} = {}) {
  const repo = repository ?? createBudgetRepository({ env, logError })
  const router =
    routeService ??
    createRouteService({
      env,
      fetchImpl,
      now,
      logError,
    })

  let pricingCache = null
  let pricingLoadedAt = 0
  let pricingPromise = null

  async function loadPricing({ force = false } = {}) {
    if (!repo.enabled) {
      return {
        settings: { ...DEFAULT_BUDGET_SETTINGS, source: 'defaults' },
        entrancePrices: [],
        source: 'defaults',
      }
    }
    if (!force && pricingCache && now() - pricingLoadedAt < pricingTtlMs) {
      return pricingCache
    }
    if (!force && pricingPromise) return pricingPromise

    pricingPromise = (async () => {
      try {
        const [settings, entrancePrices] = await Promise.all([
          repo.readSettings(),
          repo.listEntrancePrices(),
        ])
        const pricing = {
          settings: settings ?? { ...DEFAULT_BUDGET_SETTINGS, source: 'defaults' },
          entrancePrices,
          source: settings?.source === 'supabase' ? 'supabase' : 'defaults',
        }
        pricingCache = pricing
        pricingLoadedAt = now()
        return pricing
      } catch (error) {
        safeLog(logError, 'cargar tarifas', error)
        const pricing = {
          settings: { ...DEFAULT_BUDGET_SETTINGS, source: 'defaults-fallback' },
          entrancePrices: [],
          source: 'defaults-fallback',
        }
        pricingCache = pricing
        pricingLoadedAt = now()
        return pricing
      } finally {
        pricingPromise = null
      }
    })()

    return pricingPromise
  }

  function invalidatePricing() {
    pricingCache = null
    pricingLoadedAt = 0
  }

  async function calculate({
    input,
    headers,
    signal,
    persist = true,
  } = {}) {
    if (signal?.aborted) throw abortError()
    const { itinerary, options, itineraryId } = normalizeBudgetRequest(input)
    const pricing = await loadPricing()
    if (signal?.aborted) throw abortError()

    const routePoints = buildRoutePoints(itinerary)
    let route = null
    let routeFailure = null
    if (routePoints.points.length >= 2) {
      try {
        route = await router.route(routePoints.points, { signal })
      } catch (error) {
        if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR') {
          if (signal?.aborted) throw abortError()
          // Un aborto interno sin señal externa se trata como respaldo, no
          // como cancelación del presupuesto.
        }
        routeFailure = error
        safeLog(logError, 'ruta OSRM; se usará respaldo', error)
      }
    }

    const estimate = estimateBudget({
      itinerary,
      options,
      settings: pricing.settings,
      entrancePrices: pricing.entrancePrices,
      route,
      routePoints,
      now,
      pricingSource: pricing.source,
    })
    if (routeFailure) {
      estimate.route.fallbackReason =
        routeFailure.code ?? routeFailure.name ?? 'UPSTREAM_UNAVAILABLE'
    }

    let savedEstimateId = null
    let persistence = {
      saved: false,
      reason: repo.enabled ? 'anonymous' : 'storage_unavailable',
    }
    if (persist && repo.enabled) {
      const user = await repo.readUser(headers)
      if (user?.id) {
        let ownedItinerary = null
        if (itineraryId) {
          ownedItinerary = await repo.loadOwnedItinerary(user.id, itineraryId)
          if (!ownedItinerary) {
            throw new AppError(ERROR_CODES.FORBIDDEN, {
              status: 403,
              message: 'No puedes guardar un presupuesto para un itinerario ajeno.',
            })
          }
        }
        try {
          savedEstimateId = await repo.saveEstimate({
            userId: user.id,
            itineraryId: itineraryId ?? null,
            itineraryTitle: ownedItinerary?.title ?? itinerary.title,
            estimate,
            settings: pricing.settings,
          })
          persistence = { saved: Boolean(savedEstimateId), reason: 'saved' }
        } catch (error) {
          safeLog(logError, 'guardar historial', error)
          persistence = { saved: false, reason: 'storage_error' }
        }
      }
    }

    return {
      ...estimate,
      savedEstimateId,
      persistence,
      storage: repo.enabled ? 'supabase' : 'none',
    }
  }

  async function estimateForItinerary(
    itinerary,
    { headers, signal, persist = false, itineraryId = null } = {},
  ) {
    return calculate({
      input: { itinerary, options: {}, itineraryId },
      headers,
      signal,
      persist,
    })
  }

  async function listHistory({ headers, itineraryId = null, limit = 20 } = {}) {
    if (!repo.enabled) {
      throw new AppError(ERROR_CODES.BUDGET_NOT_CONFIGURED, { status: 503 })
    }
    const user = await repo.requireUser(headers)
    const estimates = await repo.listEstimates({
      userId: user.id,
      itineraryId,
      limit,
    })
    return { estimates, currency: BUDGET_CURRENCY }
  }

  function publicConfig() {
    return {
      enabled: true,
      currency: BUDGET_CURRENCY,
      storage: repo.enabled ? 'supabase' : 'none',
      adminEnabled: repo.adminEnabled,
      transportModes: TRANSPORT_MODE_OPTIONS,
      mealTiers: MEAL_TIER_OPTIONS,
      lodgingTiers: LODGING_TIER_OPTIONS,
      transportModeIds: BUDGET_TRANSPORT_MODES,
      mealTierIds: BUDGET_MEAL_TIERS,
      lodgingTierIds: BUDGET_LODGING_TIERS,
    }
  }

  async function getAdminConfig({ headers } = {}) {
    await repo.requireAdmin(headers)
    const [settings, entrancePrices] = await Promise.all([
      repo.readSettings(),
      repo.listEntrancePrices({ includeInactive: true }),
    ])
    return {
      settings: settings ?? { ...DEFAULT_BUDGET_SETTINGS, source: 'defaults' },
      entrancePrices,
      defaults: DEFAULT_BUDGET_SETTINGS,
      options: {
        transportModes: TRANSPORT_MODE_OPTIONS,
        mealTiers: MEAL_TIER_OPTIONS,
        lodgingTiers: LODGING_TIER_OPTIONS,
      },
      storage: repo.enabled ? 'supabase' : 'none',
    }
  }

  async function updateAdminSettings({ headers, body } = {}) {
    await repo.requireAdmin(headers)
    const current = (await repo.readSettings()) ?? DEFAULT_BUDGET_SETTINGS
    const settings = normalizeAdminBudgetSettings(body, current)
    const saved = await repo.updateSettings(settings)
    invalidatePricing()
    return { settings: saved }
  }

  async function upsertAdminEntrance({ headers, body } = {}) {
    await repo.requireAdmin(headers)
    const entrance = normalizeAdminEntrancePrice(body)
    const saved = await repo.upsertEntrancePrice(entrance)
    invalidatePricing()
    return { entrance: saved }
  }

  async function deleteAdminEntrance({ headers, body } = {}) {
    await repo.requireAdmin(headers)
    const id = normalizeAdminEntranceId(body)
    if (!id) {
      throw new AppError(ERROR_CODES.INVALID_REQUEST, {
        status: 400,
        message: 'Indica el identificador de la entrada que quieres eliminar.',
      })
    }
    await repo.deleteEntrancePrice(id)
    invalidatePricing()
    return { deleted: true, id }
  }

  return {
    enabled: true,
    repository: repo,
    routeService: router,
    loadPricing,
    calculate,
    estimateForItinerary,
    listHistory,
    getAdminConfig,
    updateAdminSettings,
    upsertAdminEntrance,
    deleteAdminEntrance,
    publicConfig,
  }
}
