import { createClient } from '@supabase/supabase-js'
import { DEMO_MODE_BANNER, resolveDemoMode } from '../../shared/demoMode.js'
import { FREE_PLAN_ID, getPlan } from '../../shared/plans.js'
import { AppError, ERROR_CODES, redactSecrets } from '../errors.js'
import { resolveAnonymousIdentity } from './anonymous.js'

/**
 * La pasarela de pago todavía no está conectada. Este valor se mantiene en un
 * solo lugar para que la interfaz no simule una compra ni active beneficios.
 */
export const PAYMENTS_ENABLED = false

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

export function resolveBillingConfig(env = {}) {
  const url = firstNonEmpty(env.SUPABASE_URL, env.VITE_SUPABASE_URL)
  const anonKey = firstNonEmpty(
    env.SUPABASE_ANON_KEY,
    env.SUPABASE_PUBLISHABLE_KEY,
    env.VITE_SUPABASE_ANON_KEY,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )
  const serviceRoleKey = firstNonEmpty(env.SUPABASE_SERVICE_ROLE_KEY)
  const explicitlyDisabled = env.BILLING_ENABLED === 'false'
  const configured = Boolean(url && anonKey && serviceRoleKey)
  const enabled = !explicitlyDisabled && configured
  const anonymousSecret = firstNonEmpty(
    env.BILLING_ANONYMOUS_SECRET,
    env.CHAT_SIGNING_SECRET,
    serviceRoleKey,
  )

  return {
    url,
    anonKey,
    serviceRoleKey,
    configured,
    enabled,
    demoMode: resolveDemoMode(env),
    anonymousSecret,
    secureCookies: env.VERCEL === '1' || env.NODE_ENV === 'production',
    paymentsEnabled: PAYMENTS_ENABLED,
  }
}

function getBearerToken(headers) {
  const value = headers?.authorization ?? headers?.Authorization
  if (typeof value !== 'string') return null
  const match = /^Bearer\s+(.+)$/i.exec(value.trim())
  return match ? match[1].trim() : null
}

function statusPlan(planId = FREE_PLAN_ID) {
  const plan = getPlan(planId) ?? getPlan(FREE_PLAN_ID)
  return {
    id: plan.id,
    name: plan.name,
    billingType: plan.billingType,
    priceCents: plan.priceCents,
    currency: 'USD',
    durationDays: plan.durationDays,
    aiQueryLimit: plan.aiQueryLimit,
    savedItineraryLimit: plan.savedItineraryLimit,
    recommended: plan.recommended,
  }
}

function disabledStatus() {
  return {
    enabled: false,
    billingEnabled: false,
    paymentsEnabled: false,
    demoMode: false,
    authenticated: false,
    plan: statusPlan(FREE_PLAN_ID),
    period: null,
    usage: null,
    savedItineraries: null,
    canSaveItineraries: true,
    subscription: null,
    pass: null,
  }
}

function demoStatus() {
  return {
    enabled: true,
    billingEnabled: false,
    paymentsEnabled: false,
    demoMode: true,
    demoMessage: DEMO_MODE_BANNER,
    authenticated: false,
    plan: statusPlan(FREE_PLAN_ID),
    period: null,
    usage: null,
    savedItineraries: null,
    canSaveItineraries: true,
    subscription: null,
    pass: null,
  }
}

export function createDemoBillingService({ syncDemoMode = async () => false } = {}) {
  let syncPromise = null

  function ensureDemoModeSynced() {
    if (!syncPromise) {
      syncPromise = Promise.resolve()
        .then(() => syncDemoMode(true))
        .catch(() => false)
    }
    return syncPromise
  }

  // El backend es la fuente de verdad para el cupo. En demostración no se
  // reserva ni se confirma consumo de plan; los límites técnicos del chat
  // (IP, sesión y concurrencia) siguen activos en handlers.js.
  void ensureDemoModeSynced()

  return {
    enabled: true,
    billingEnabled: false,
    paymentsEnabled: false,
    demoMode: true,
    configured: false,
    reason: 'demo_mode',
    async resolveContext() {
      return {
        userId: null,
        anonymousKey: null,
        authenticated: false,
        setCookie: null,
      }
    },
    async getStatus() {
      await ensureDemoModeSynced()
      return { status: demoStatus(), setCookie: null }
    },
    async reserveChat() {
      return {
        allowed: true,
        reason: null,
        usage: null,
        plan: null,
        setCookie: null,
      }
    },
    async commitChat() {
      return false
    },
    async releaseChat() {
      return false
    },
  }
}

export function createDisabledBillingService(reason = 'billing_not_configured') {
  return {
    enabled: false,
    billingEnabled: false,
    paymentsEnabled: false,
    demoMode: false,
    configured: false,
    reason,
    async resolveContext() {
      return {
        userId: null,
        anonymousKey: null,
        authenticated: false,
        setCookie: null,
      }
    },
    async getStatus() {
      return { status: disabledStatus(), setCookie: null }
    },
    async reserveChat() {
      return {
        allowed: true,
        reason: null,
        usage: null,
        plan: null,
        setCookie: null,
      }
    },
    async commitChat() {
      return false
    },
    async releaseChat() {
      return false
    },
  }
}

export function createBillingService({
  env = process.env,
  fetchImpl = globalThis.fetch,
  logError = console.error,
  clock = () => new Date(),
} = {}) {
  const config = resolveBillingConfig(env)

  const clientOptions = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    db: { schema: 'public' },
    global: { fetch: fetchImpl },
  }

  const admin =
    config.url && config.serviceRoleKey
      ? createClient(config.url, config.serviceRoleKey, clientOptions)
      : null
  const authClient =
    config.url && config.anonKey
      ? createClient(config.url, config.anonKey, clientOptions)
      : null

  function logBillingError(context, error) {
    try {
      logError(`[billing] ${context}`, {
        code: error?.code ?? error?.name ?? 'UNKNOWN',
        message: redactSecrets(error?.message ?? '').slice(0, 300),
      })
    } catch {
      // Nunca dejamos que un fallo del logger altere la respuesta.
    }
  }

  /**
   * Mantiene sincronizado el indicador de PostgreSQL que consulta el trigger
   * de itinerarios. Es best-effort: si la migración de demostración no está
   * aplicada o no hay service_role, el modo demo sigue funcionando en el API.
   */
  function createDemoModeSynchronizer(client) {
    let requested = null
    let pending = null

    return function syncDemoMode(enabled) {
      if (!client) return Promise.resolve(false)
      if (pending && requested === enabled) return pending

      requested = enabled
      pending = Promise.resolve()
        .then(() => client.rpc('set_demo_mode', { p_enabled: enabled }))
        .then((result) => {
          if (result?.error) {
            logBillingError('sincronizar modo demostración', result.error)
            return false
          }
          return true
        })
        .catch((error) => {
          logBillingError('sincronizar modo demostración', error)
          return false
        })

      return pending
    }
  }

  const syncDemoMode = createDemoModeSynchronizer(admin)

  if (config.demoMode) {
    return createDemoBillingService({ syncDemoMode })
  }

  // Al desactivar la demostración se restaura el valor de PostgreSQL para que
  // el trigger vuelva a aplicar los límites comerciales. Si la migración de
  // demostración no existe, el trigger anterior no lo consulta y no hay riesgo.
  if (admin) void syncDemoMode(false)

  if (!config.enabled || !config.anonymousSecret || !admin || !authClient) {
    return createDisabledBillingService(
      !config.configured
        ? 'missing_supabase_server_credentials'
        : !config.anonymousSecret
          ? 'missing_billing_anonymous_secret'
          : 'billing_disabled',
    )
  }

  async function readUser(accessToken) {
    try {
      const { data, error } = await authClient.auth.getUser(accessToken)
      if (error || !data?.user?.id) return null
      return data.user
    } catch {
      return null
    }
  }

  async function callRpc(name, args, context) {
    let result
    try {
      result = await admin.rpc(name, args)
    } catch (error) {
      logBillingError(context, error)
      throw new AppError(ERROR_CODES.BILLING_UNAVAILABLE, { status: 503 })
    }

    if (result?.error) {
      logBillingError(context, result.error)
      throw new AppError(ERROR_CODES.BILLING_UNAVAILABLE, { status: 503 })
    }

    return result?.data ?? null
  }

  async function resolveContext({ headers } = {}) {
    const accessToken = getBearerToken(headers)

    if (accessToken) {
      const user = await readUser(accessToken)
      if (!user?.id) {
        throw new AppError(ERROR_CODES.SESSION_EXPIRED, { status: 401 })
      }
      return {
        userId: user.id,
        anonymousKey: null,
        authenticated: true,
        setCookie: null,
      }
    }

    const identity = resolveAnonymousIdentity({
      headers,
      secret: config.anonymousSecret,
      secure: config.secureCookies,
    })

    return {
      userId: null,
      anonymousKey: identity.anonymousKey,
      authenticated: false,
      setCookie: identity.setCookie,
    }
  }

  async function statusForContext(context) {
    const at = clock().toISOString()
    const data = context.userId
      ? await callRpc(
          'billing_status',
          { p_user_id: context.userId, p_at: at },
          'estado de facturación',
        )
      : await callRpc(
          'anonymous_billing_status',
          { p_anonymous_key: context.anonymousKey, p_at: at },
          'estado anónimo',
        )

    return {
      enabled: true,
      billingEnabled: true,
      paymentsEnabled: config.paymentsEnabled,
      demoMode: false,
      authenticated: context.authenticated,
      ...data,
    }
  }

  return {
    enabled: true,
    billingEnabled: true,
    paymentsEnabled: config.paymentsEnabled,
    demoMode: false,
    configured: true,
    reason: null,

    resolveContext,

    async getStatus({ headers } = {}) {
      const context = await resolveContext({ headers })
      return {
        status: await statusForContext(context),
        setCookie: context.setCookie,
      }
    },

    async reserveChat({ context, requestId }) {
      if (!context || (!context.userId && !context.anonymousKey)) {
        throw new AppError(ERROR_CODES.BILLING_UNAVAILABLE, { status: 503 })
      }

      const at = clock().toISOString()
      const data = await callRpc(
        'reserve_ai_query',
        {
          p_user_id: context.userId,
          p_anonymous_key: context.anonymousKey,
          p_request_id: requestId,
          p_at: at,
        },
        'reserva de consulta',
      )

      return {
        allowed: data?.allowed === true,
        reason: typeof data?.reason === 'string' ? data.reason : null,
        usage: data?.usage ?? null,
        plan: data?.plan ?? null,
        setCookie: context.setCookie,
      }
    },

    async commitChat(requestId) {
      try {
        await callRpc(
          'commit_ai_query',
          { p_request_id: requestId },
          'confirmación de consulta',
        )
        return true
      } catch {
        return false
      }
    },

    async releaseChat(requestId) {
      try {
        await callRpc(
          'release_ai_query',
          { p_request_id: requestId },
          'liberación de consulta',
        )
        return true
      } catch {
        return false
      }
    },
  }
}
