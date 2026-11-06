import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  defaultPlanStatus,
  fetchPlanStatus,
} from '../services/planService.js'
import { useAuth } from './authContext.js'
import { PlanContext } from './planContext.js'

const PLAN_STATUS_ERROR =
  'No pudimos consultar tu plan. Puedes seguir explorando; el consumo se actualizará cuando vuelvas a intentarlo.'

function mergeChatUsage(current, payload) {
  if (!payload?.usage) return current

  const used = Number(payload.usage.used)
  const limit = Number(payload.usage.limit)
  if (!Number.isFinite(used) || !Number.isFinite(limit)) return current

  return {
    ...current,
    plan: payload.plan
      ? { ...current.plan, ...payload.plan }
      : current.plan,
    usage: {
      used,
      limit,
      remaining: Number.isFinite(Number(payload.usage.remaining))
        ? Number(payload.usage.remaining)
        : Math.max(limit - used, 0),
      periodStart: payload.usage.periodStart ?? current.usage?.periodStart ?? null,
      periodEnd: payload.usage.periodEnd ?? current.usage?.periodEnd ?? null,
    },
  }
}

export function PlanProvider({ children }) {
  const { status: authStatus, session } = useAuth()
  const [data, setData] = useState(defaultPlanStatus)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  const refresh = useCallback(() => {
    setStatus('loading')
    setError(null)
    setReloadToken((value) => value + 1)
  }, [])

  useEffect(() => {
    if (authStatus === 'loading') return undefined

    const controller = new AbortController()

    fetchPlanStatus({
      accessToken: session?.access_token ?? null,
      signal: controller.signal,
    })
      .then((nextStatus) => {
        if (controller.signal.aborted) return
        setData(nextStatus)
        setError(null)
        setStatus('ready')
      })
      .catch((loadError) => {
        if (loadError?.name === 'AbortError' || controller.signal.aborted) return
        setData((current) => (current.enabled ? current : defaultPlanStatus()))
        setStatus('error')
        setError(loadError?.message ?? PLAN_STATUS_ERROR)
      })

    return () => controller.abort()
  }, [authStatus, session?.access_token, reloadToken])

  const applyChatUsage = useCallback((payload) => {
    setData((current) => mergeChatUsage(current, payload))
  }, [])

  const value = useMemo(
    () => ({
      status,
      error,
      ...data,
      refresh,
      applyChatUsage,
      isCurrentPlan(planId) {
        return data.plan?.id === planId
      },
      hasPaidAccess: data.plan?.billingType !== 'free',
    }),
    [status, error, data, refresh, applyChatUsage],
  )

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}
