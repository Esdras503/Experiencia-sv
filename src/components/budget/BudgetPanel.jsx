import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BUDGET_CATEGORY_LABELS,
  BUDGET_LODGING_TIERS,
  BUDGET_MEAL_TIERS,
  BUDGET_TRANSPORT_MODES,
  LODGING_TIER_OPTIONS,
  MEAL_TIER_OPTIONS,
  TRANSPORT_MODE_OPTIONS,
} from '../../../shared/budget.js'
import { useAuth } from '../../context/authContext.js'
import { calculateBudget } from '../../services/budgetService.js'
import { formatDistance } from '../../utils/placeFormatters.js'

const CATEGORY_COLORS = {
  transport: '#236b4d',
  meals: '#c18a3a',
  admissions: '#4b7d8f',
  activities: '#7b6ca8',
  lodging: '#b05b4e',
  extras: '#7b8b7e',
}

const VERIFICATION_LABELS = {
  verified: 'Verificado',
  estimated: 'Estimado',
  unverified: 'Sin verificar',
  mixed: 'Mixto',
}

function formatMoney(cents, currency = 'USD') {
  const value = Number(cents)
  if (!Number.isFinite(value)) return 'No disponible'
  try {
    return new Intl.NumberFormat('es-SV', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value / 100)
  } catch {
    return `$${(value / 100).toFixed(2)}`
  }
}

function formatRange(minCents, maxCents, currency) {
  const min = Number(minCents)
  const max = Number(maxCents)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 'No disponible'
  if (Math.round(min) === Math.round(max)) return formatMoney(min, currency)
  return `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`
}

function formatDuration(seconds) {
  const value = Number(seconds)
  if (!Number.isFinite(value) || value <= 0) return null
  const minutes = Math.round(value / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`
}

function midpoint(item) {
  return (Number(item?.minCents ?? 0) + Number(item?.maxCents ?? 0)) / 2
}

function initialOptionsFor(itinerary, estimate) {
  const inputs = estimate?.inputs ?? {}
  const preferences = itinerary?.budgetOptions ?? {}
  const days = Number(inputs.days ?? itinerary?.durationDays) || 1
  const includeLodging =
    typeof inputs.includeLodging === 'boolean'
      ? inputs.includeLodging
      : typeof preferences.includeLodging === 'boolean'
        ? preferences.includeLodging
        : days > 1
  return {
    travelers: Number(inputs.travelers ?? itinerary?.travelers) || 1,
    children: Number(inputs.children) || 0,
    days,
    nights: Number(inputs.nights) || (includeLodging ? Math.max(1, days - 1) : 0),
    transportMode: BUDGET_TRANSPORT_MODES.includes(
      inputs.transportMode ?? preferences.transportMode,
    )
      ? (inputs.transportMode ?? preferences.transportMode)
      : 'particular',
    mealTier: BUDGET_MEAL_TIERS.includes(inputs.mealTier ?? preferences.mealTier)
      ? (inputs.mealTier ?? preferences.mealTier)
      : 'estandar',
    lodgingTier: BUDGET_LODGING_TIERS.includes(
      inputs.lodgingTier ?? preferences.lodgingTier,
    )
      ? (inputs.lodgingTier ?? preferences.lodgingTier)
      : 'estandar',
    includeLodging,
  }
}

function verificationLabel(value) {
  return VERIFICATION_LABELS[value] ?? 'Estimado'
}

function verificationClass(value) {
  return `budget-badge budget-badge-${value || 'estimated'}`
}

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(maximum, Math.max(minimum, parsed))
}

export default function BudgetPanel({
  itinerary,
  initialEstimate = null,
  initialError = null,
  itineraryId = null,
  autoCalculate = false,
  onDownloadPdf = null,
  variant = 'chat',
  onEstimateChange = null,
}) {
  const { session } = useAuth()
  const accessToken = session?.access_token ?? null
  const [estimate, setEstimate] = useState(initialEstimate)
  const [status, setStatus] = useState(initialEstimate ? 'idle' : 'idle')
  const [error, setError] = useState(initialError)
  const [options, setOptions] = useState(() =>
    initialOptionsFor(itinerary, initialEstimate),
  )
  const [budgetAmount, setBudgetAmount] = useState(() =>
    Number.isFinite(Number(itinerary?.budget?.amount))
      ? String(itinerary.budget.amount)
      : '',
  )
  const [budgetScope, setBudgetScope] = useState(
    itinerary?.budget?.scope === 'persona' ? 'persona' : 'total',
  )
  const requestRef = useRef(null)
  const autoRef = useRef(false)
  const lastItineraryRef = useRef(itinerary)
  const lastInitialEstimateRef = useRef(initialEstimate)

  useEffect(() => {
    if (!itinerary) return
    const itineraryChanged = lastItineraryRef.current !== itinerary
    const estimateChanged =
      initialEstimate !== null &&
      initialEstimate !== lastInitialEstimateRef.current
    if (!itineraryChanged && !estimateChanged) return

    lastItineraryRef.current = itinerary
    lastInitialEstimateRef.current = initialEstimate
    const nextEstimate = estimateChanged ? initialEstimate : itineraryChanged ? initialEstimate : estimate
    setEstimate(nextEstimate)
    setError(nextEstimate ? null : initialError)
    setStatus('idle')
    setOptions(initialOptionsFor(itinerary, nextEstimate))
    setBudgetAmount(
      Number.isFinite(Number(itinerary?.budget?.amount))
        ? String(itinerary.budget.amount)
        : '',
    )
    setBudgetScope(itinerary?.budget?.scope === 'persona' ? 'persona' : 'total')
  }, [initialError, initialEstimate, itinerary, estimate])

  const runCalculation = useCallback(
    async ({ persist = true } = {}) => {
      if (!itinerary || !Array.isArray(itinerary.stops) || itinerary.stops.length === 0) {
        return
      }

      const amount = budgetAmount.trim() === '' ? null : Number(budgetAmount)
      if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
        setError({
          code: 'INVALID_REQUEST',
          message: 'El límite de presupuesto debe ser un número positivo o quedar vacío.',
        })
        setStatus('error')
        return
      }

      requestRef.current?.abort()
      const controller = new AbortController()
      requestRef.current = controller
      setStatus('loading')
      setError(null)

      try {
        const payload = await calculateBudget({
          itinerary: {
            ...itinerary,
            durationDays: options.days,
            travelers: options.travelers,
            budget:
              amount === null
                ? null
                : { amount, currency: 'USD', scope: budgetScope },
            budgetOptions: {
              transportMode: options.transportMode,
              mealTier: options.mealTier,
              lodgingTier: options.lodgingTier,
              includeLodging: options.includeLodging,
            },
          },
          options,
          itineraryId,
          accessToken,
          signal: controller.signal,
          persist: persist !== false,
        })
        if (controller.signal.aborted) return
        setEstimate(payload)
        setStatus('idle')
        onEstimateChange?.(payload)
      } catch (requestError) {
        if (requestError?.name === 'AbortError' || controller.signal.aborted) return
        setError({
          code: requestError?.code ?? 'INTERNAL',
          message:
            requestError?.message ??
            'No pudimos calcular el presupuesto. Intenta de nuevo.',
        })
        setStatus('error')
      } finally {
        if (requestRef.current === controller) requestRef.current = null
      }
    },
    [
      accessToken,
      budgetAmount,
      budgetScope,
      itinerary,
      itineraryId,
      onEstimateChange,
      options,
    ],
  )

  useEffect(() => {
    if (!autoCalculate || initialEstimate || autoRef.current) return undefined
    if (!Array.isArray(itinerary?.stops) || itinerary.stops.length === 0) return undefined
    // La marca se activa al ejecutar, no al programar: en StrictMode React
    // limpia el primer temporizador antes de volver a montar el efecto.
    const timer = setTimeout(() => {
      if (autoRef.current) return
      autoRef.current = true
      runCalculation({ persist: false })
    }, 0)
    return () => clearTimeout(timer)
  }, [autoCalculate, initialEstimate, itinerary, runCalculation])

  useEffect(
    () => () => {
      requestRef.current?.abort()
    },
    [],
  )

  const updateOption = (key, value) => {
    setOptions((current) => {
      const next = { ...current, [key]: value }
      if (key === 'travelers') {
        next.travelers = clampInteger(value, 1, 50, 1)
        next.children = Math.min(next.children, next.travelers)
      }
      if (key === 'children') {
        next.children = clampInteger(value, 0, next.travelers, 0)
      }
      if (key === 'days') {
        next.days = clampInteger(value, 1, 60, 1)
        if (next.includeLodging) {
          next.nights = Math.max(1, next.days - 1)
        }
      }
      if (key === 'nights') {
        next.nights = clampInteger(value, 0, 60, 0)
      }
      return next
    })
  }

  const breakdown = useMemo(
    () => (Array.isArray(estimate?.breakdown) ? estimate.breakdown : []),
    [estimate],
  )
  const chartTotal = useMemo(
    () => breakdown.reduce((sum, item) => sum + Math.max(0, midpoint(item)), 0),
    [breakdown],
  )
  const warnings = Array.isArray(estimate?.warnings) ? estimate.warnings : []
  const assumptions = Array.isArray(estimate?.assumptions) ? estimate.assumptions : []
  const entranceItems = Array.isArray(estimate?.entranceItems)
    ? estimate.entranceItems
    : []
  const distance = formatDistance(estimate?.route?.distanceMeters)
  const travelTime = formatDuration(estimate?.route?.durationSeconds)
  const currency = estimate?.currency ?? 'USD'
  const inputs = estimate?.inputs ?? {}
  const comparison = estimate?.budgetComparison ?? null
  const canCalculate = Boolean(itinerary?.stops?.length)

  if (!itinerary || !Array.isArray(itinerary.stops) || itinerary.stops.length === 0) {
    return null
  }

  return (
    <section
      className={`budget-panel budget-panel-${variant}`}
      aria-labelledby="budget-panel-title"
      data-budget-panel
    >
      <header className="budget-panel-header">
        <div>
          <p className="budget-eyebrow">Presupuesto inteligente</p>
          <h3 id="budget-panel-title">Cálculo estimado del viaje</h3>
          <p>
            Calculado por el servidor con tarifas configurables. No es una
            cotización ni confirma disponibilidad.
          </p>
        </div>
        {onDownloadPdf && (
          <button type="button" className="button-secondary" onClick={onDownloadPdf}>
            Descargar PDF
          </button>
        )}
      </header>

      <div className="budget-controls" aria-label="Ajustes del presupuesto">
        <label>
          <span>Personas</span>
          <input
            type="number"
            min="1"
            max="50"
            value={options.travelers}
            onChange={(event) => updateOption('travelers', event.target.value)}
          />
        </label>
        <label>
          <span>Niños incluidos</span>
          <input
            type="number"
            min="0"
            max={options.travelers}
            value={options.children}
            onChange={(event) => updateOption('children', event.target.value)}
          />
        </label>
        <label>
          <span>Días</span>
          <input
            type="number"
            min="1"
            max="60"
            value={options.days}
            onChange={(event) => updateOption('days', event.target.value)}
          />
        </label>
        <label>
          <span>Transporte</span>
          <select
            value={options.transportMode}
            onChange={(event) => updateOption('transportMode', event.target.value)}
          >
            {TRANSPORT_MODE_OPTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Comida</span>
          <select
            value={options.mealTier}
            onChange={(event) => updateOption('mealTier', event.target.value)}
          >
            {MEAL_TIER_OPTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="budget-check">
          <input
            type="checkbox"
            checked={options.includeLodging}
            onChange={(event) => {
              const checked = event.target.checked
              setOptions((current) => ({
                ...current,
                includeLodging: checked,
                nights: checked ? Math.max(1, current.nights || current.days - 1) : 0,
              }))
            }}
          />
          <span>Incluir hospedaje</span>
        </label>
        <label>
          <span>Noches</span>
          <input
            type="number"
            min="0"
            max="60"
            value={options.nights}
            disabled={!options.includeLodging}
            onChange={(event) => updateOption('nights', event.target.value)}
          />
        </label>
        <label>
          <span>Nivel de hospedaje</span>
          <select
            value={options.lodgingTier}
            disabled={!options.includeLodging}
            onChange={(event) => updateOption('lodgingTier', event.target.value)}
          >
            {LODGING_TIER_OPTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Límite para comparar</span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="Opcional"
            value={budgetAmount}
            onChange={(event) => setBudgetAmount(event.target.value)}
          />
        </label>
        <label>
          <span>Alcance del límite</span>
          <select
            value={budgetScope}
            onChange={(event) => setBudgetScope(event.target.value)}
          >
            <option value="total">Total del grupo</option>
            <option value="persona">Por persona</option>
          </select>
        </label>
        <button
          type="button"
          className="button-primary budget-recalculate"
          onClick={() => runCalculation({ persist: variant !== 'chat' })}
          disabled={!canCalculate || status === 'loading'}
        >
          {status === 'loading' ? 'Calculando…' : 'Recalcular presupuesto'}
        </button>
      </div>

      {error && (
        <div className="budget-error" role="alert">
          <p>{error.message}</p>
          <button type="button" onClick={() => runCalculation({ persist: variant !== 'chat' })}>
            Reintentar
          </button>
        </div>
      )}

      {!estimate && !error && status !== 'loading' && (
        <div className="budget-empty">
          <p>
            Aún no hay un presupuesto calculado. Usa «Recalcular presupuesto» para
            obtener el total, el desglose y las advertencias.
          </p>
        </div>
      )}

      {estimate && (
        <>
          <div className="budget-summary">
            <div className="budget-total">
              <span>Total estimado</span>
              <strong>{formatRange(estimate.totals?.minCents, estimate.totals?.maxCents, currency)}</strong>
              <small>
                {formatRange(
                  estimate.totals?.perPersonMinCents,
                  estimate.totals?.perPersonMaxCents,
                  currency,
                )}{' '}
                por persona ·{' '}
                {formatRange(
                  estimate.totals?.perDayMinCents,
                  estimate.totals?.perDayMaxCents,
                  currency,
                )}{' '}
                por día
              </small>
            </div>
            <div className="budget-facts">
              <span>
                <strong>{inputs.travelers ?? options.travelers}</strong> personas
              </span>
              <span>
                <strong>{inputs.days ?? options.days}</strong> días
              </span>
              <span>
                <strong>{inputs.nights ?? 0}</strong> noches
              </span>
              {distance && <span>Distancia: {distance}</span>}
              {travelTime && <span>Tiempo de viaje: {travelTime}</span>}
              {estimate.route?.source && (
                <span>
                  Ruta: {estimate.route.source === 'osrm' ? 'OSRM' : 'estimación de respaldo'}
                </span>
              )}
            </div>
          </div>

          <div className="budget-verification-bar">
            <span className={verificationClass(estimate.verification?.entranceStatus)}>
              Entradas: {verificationLabel(estimate.verification?.entranceStatus)}
            </span>
            <span>
              {estimate.verification?.verifiedEntrances ?? 0} verificadas ·{' '}
              {estimate.verification?.estimatedEntrances ?? 0} estimadas ·{' '}
              {estimate.verification?.unverifiedEntrances ?? 0} sin verificar
            </span>
            <span className="budget-estimate-note">
              Los costos que no sean entradas verificadas son estimaciones.
            </span>
          </div>

          {comparison && (
            <div
              className={`budget-comparison budget-comparison-${comparison.status}`}
              role="status"
            >
              {comparison.status === 'within' &&
                'El rango estimado queda dentro del límite declarado.'}
              {comparison.status === 'over' &&
                'El rango estimado supera el límite declarado. Ajusta el plan o el límite.'}
              {comparison.status === 'close' &&
                'El rango estimado cruza el límite declarado; revisa el desglose antes de decidir.'}
              {comparison.status === 'unavailable' &&
                (comparison.message ??
                  'No fue posible comparar el límite declarado con la estimación.')}
            </div>
          )}

          {chartTotal > 0 && (
            <div className="budget-chart" aria-label="Distribución del presupuesto por categoría">
              <div className="budget-chart-bar" role="img" aria-label="Distribución por categoría">
                {breakdown.map((item) => {
                  const share = (Math.max(0, midpoint(item)) / chartTotal) * 100
                  if (share <= 0) return null
                  return (
                    <span
                      key={item.key}
                      style={{
                        width: `${share}%`,
                        background: CATEGORY_COLORS[item.key] ?? '#7b8b7e',
                      }}
                      title={`${item.label}: ${Math.round(share)}%`}
                    />
                  )
                })}
              </div>
              <ul className="budget-chart-legend">
                {breakdown.map((item) => (
                  <li key={item.key}>
                    <span
                      className="budget-legend-dot"
                      style={{ background: CATEGORY_COLORS[item.key] ?? '#7b8b7e' }}
                      aria-hidden="true"
                    />
                    {item.label ?? BUDGET_CATEGORY_LABELS[item.key] ?? item.key}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="budget-breakdown">
            {breakdown.map((item) => {
              const share = chartTotal > 0 ? (midpoint(item) / chartTotal) * 100 : 0
              return (
                <li key={item.key} className="budget-breakdown-item">
                  <div className="budget-breakdown-heading">
                    <strong>
                      {item.label ?? BUDGET_CATEGORY_LABELS[item.key] ?? item.key}
                    </strong>
                    <span>{formatRange(item.minCents, item.maxCents, currency)}</span>
                  </div>
                  <div className="budget-breakdown-meta">
                    <span className={verificationClass(item.verification)}>
                      {verificationLabel(item.verification)}
                    </span>
                    <span className="budget-share">
                      {share > 0 ? `${Math.round(share)} %` : '—'}
                    </span>
                  </div>
                  <div className="budget-breakdown-track" aria-hidden="true">
                    <span
                      style={{
                        width: `${Math.min(100, Math.max(0, share))}%`,
                        background: CATEGORY_COLORS[item.key] ?? '#7b8b7e',
                      }}
                    />
                  </div>
                  {item.source && (
                    <p className="budget-item-source">Fuente: {item.source}</p>
                  )}
                  {Array.isArray(item.notes) && item.notes.length > 0 && (
                    <p className="budget-item-note">{item.notes.join(' ')}</p>
                  )}
                </li>
              )
            })}
          </ul>

          {entranceItems.length > 0 && (
            <details className="budget-details">
              <summary>Detalle de entradas y actividades ({entranceItems.length})</summary>
              <ul>
                {entranceItems.map((item) => (
                  <li key={`${item.placeId ?? item.name}-${item.verification}-${item.minCents}`}>
                    <span>
                      <strong>{item.name}</strong>{' '}
                      <span className={verificationClass(item.verification)}>
                        {verificationLabel(item.verification)}
                      </span>
                    </span>
                    <span>{formatRange(item.minCents, item.maxCents, currency)}</span>
                    {item.source && <small>Fuente: {item.source}</small>}
                    {item.verifiedAt && <small>Verificado: {item.verifiedAt}</small>}
                    {item.note && <small>{item.note}</small>}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {(assumptions.length > 0 || warnings.length > 0) && (
            <details className="budget-details budget-disclosures">
              <summary>
                Supuestos y advertencias ({assumptions.length + warnings.length})
              </summary>
              {warnings.length > 0 && (
                <div>
                  <h4>Advertencias</h4>
                  <ul>
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              {assumptions.length > 0 && (
                <div>
                  <h4>Supuestos</h4>
                  <ul>
                    {assumptions.map((assumption) => (
                      <li key={assumption}>{assumption}</li>
                    ))}
                  </ul>
                </div>
              )}
            </details>
          )}

          <p className="budget-footer-note">
            {estimate.persistence?.saved
              ? 'Este cálculo se guardó en tu historial privado.'
              : estimate.storage === 'none'
                ? 'El historial no está configurado en este entorno; el cálculo sigue siendo válido en esta sesión.'
                : 'El cálculo no se guardó en el historial porque no hay una sesión autenticada.'}
          </p>
        </>
      )}
    </section>
  )
}
