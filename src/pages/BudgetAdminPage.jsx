import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/authContext.js'
import {
  deleteAdminEntrance,
  fetchAdminBudget,
  saveAdminEntrance,
  updateAdminBudgetSettings,
} from '../services/budgetService.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import AuthMessage from '../components/auth/AuthMessage.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import ErrorState from '../components/ui/ErrorState.jsx'
import LoadingState from '../components/ui/LoadingState.jsx'

const MEAL_TIERS = [
  { id: 'economico', label: 'Económico' },
  { id: 'estandar', label: 'Estándar' },
  { id: 'premium', label: 'Premium' },
]
const MEALS = [
  { id: 'breakfast', label: 'Desayuno' },
  { id: 'lunch', label: 'Almuerzo' },
  { id: 'dinner', label: 'Cena' },
  { id: 'snack', label: 'Refrigerio' },
]
const VERIFICATION_OPTIONS = [
  { id: 'unverified', label: 'Sin verificar' },
  { id: 'estimated', label: 'Estimado' },
  { id: 'verified', label: 'Verificado' },
]

function centsToDollars(value) {
  const cents = Number(value)
  return Number.isFinite(cents) ? (cents / 100).toFixed(2) : '0.00'
}

function dollarsToCents(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0
}

function numberValue(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formFromSettings(settings = {}) {
  const mealTiers = {}
  for (const tier of MEAL_TIERS) {
    mealTiers[tier.id] = {}
    for (const meal of MEALS) {
      mealTiers[tier.id][meal.id] = centsToDollars(
        settings.mealTiers?.[tier.id]?.[`${meal.id}Cents`],
      )
    }
  }
  return {
    fuelPricePerLiter: centsToDollars(settings.fuelPricePerLiterCents),
    vehicleConsumptionLitersPer100Km: String(
      settings.vehicleConsumptionLitersPer100Km ?? 8.5,
    ),
    fuelSafetyMarginPercent: String(settings.fuelSafetyMarginPercent ?? 10),
    parkingPerDay: centsToDollars(settings.parkingPerDayCents),
    tollsPerDay: centsToDollars(settings.tollsPerDayCents),
    publicTransportPerKmPerPerson: centsToDollars(
      settings.publicTransportPerKmPerPersonCents,
    ),
    publicTransportMinimumPerLeg: centsToDollars(
      settings.publicTransportMinimumPerLegCents,
    ),
    averageSpeedKmh: String(settings.averageSpeedKmh ?? 45),
    roadFactor: String(settings.roadFactor ?? 1.25),
    mealTiers,
    lodging: {
      economico: centsToDollars(
        settings.lodgingPerPersonNightCents?.economico,
      ),
      estandar: centsToDollars(settings.lodgingPerPersonNightCents?.estandar),
      premium: centsToDollars(settings.lodgingPerPersonNightCents?.premium),
    },
    activityAllowance: centsToDollars(
      settings.activityAllowancePerPersonPerDayCents,
    ),
    unverifiedEntranceMin: centsToDollars(
      settings.unverifiedEntranceMinPerPersonCents,
    ),
    unverifiedEntranceMax: centsToDollars(
      settings.unverifiedEntranceMaxPerPersonCents,
    ),
    extrasPercent: String(settings.extrasPercent ?? 10),
    estimateRangePercent: String(settings.estimateRangePercent ?? 10),
  }
}

function settingsPayload(form) {
  const mealTiers = {}
  for (const tier of MEAL_TIERS) {
    mealTiers[tier.id] = {}
    for (const meal of MEALS) {
      mealTiers[tier.id][`${meal.id}Cents`] = dollarsToCents(
        form.mealTiers?.[tier.id]?.[meal.id],
      )
    }
  }
  return {
    currency: 'USD',
    fuelPricePerLiterCents: dollarsToCents(form.fuelPricePerLiter),
    vehicleConsumptionLitersPer100Km: numberValue(
      form.vehicleConsumptionLitersPer100Km,
    ),
    fuelSafetyMarginPercent: numberValue(form.fuelSafetyMarginPercent),
    parkingPerDayCents: dollarsToCents(form.parkingPerDay),
    tollsPerDayCents: dollarsToCents(form.tollsPerDay),
    publicTransportPerKmPerPersonCents: dollarsToCents(
      form.publicTransportPerKmPerPerson,
    ),
    publicTransportMinimumPerLegCents: dollarsToCents(
      form.publicTransportMinimumPerLeg,
    ),
    averageSpeedKmh: numberValue(form.averageSpeedKmh),
    roadFactor: numberValue(form.roadFactor),
    mealTiers,
    lodgingPerPersonNightCents: {
      economico: dollarsToCents(form.lodging.economico),
      estandar: dollarsToCents(form.lodging.estandar),
      premium: dollarsToCents(form.lodging.premium),
    },
    activityAllowancePerPersonPerDayCents: dollarsToCents(form.activityAllowance),
    unverifiedEntranceMinPerPersonCents: dollarsToCents(form.unverifiedEntranceMin),
    unverifiedEntranceMaxPerPersonCents: dollarsToCents(form.unverifiedEntranceMax),
    extrasPercent: numberValue(form.extrasPercent),
    estimateRangePercent: numberValue(form.estimateRangePercent),
  }
}

function emptyEntrance() {
  return {
    id: null,
    name: '',
    placeId: '',
    category: '',
    adult: '',
    child: '',
    group: '',
    groupMinPeople: '',
    activity: '',
    verificationStatus: 'unverified',
    source: '',
    verifiedAt: '',
    notes: '',
    isActive: true,
  }
}

function entranceToForm(entrance) {
  return {
    id: entrance.id ?? null,
    name: entrance.name ?? '',
    placeId: entrance.placeId ?? '',
    category: entrance.category ?? '',
    adult: entrance.adultCents === null ? '' : centsToDollars(entrance.adultCents),
    child: entrance.childCents === null ? '' : centsToDollars(entrance.childCents),
    group: entrance.groupCents === null ? '' : centsToDollars(entrance.groupCents),
    groupMinPeople:
      entrance.groupMinPeople === null ? '' : String(entrance.groupMinPeople),
    activity:
      entrance.activityCents === null ? '' : centsToDollars(entrance.activityCents),
    verificationStatus: entrance.verificationStatus ?? 'unverified',
    source: entrance.source ?? '',
    verifiedAt: entrance.verifiedAt ?? '',
    notes: entrance.notes ?? '',
    isActive: entrance.isActive !== false,
  }
}

function optionalMoney(value) {
  return String(value ?? '').trim() === '' ? null : dollarsToCents(value)
}

function entrancePayload(form) {
  return {
    id: form.id || null,
    name: form.name,
    placeId: form.placeId.trim() || null,
    category: form.category.trim() || null,
    adultCents: optionalMoney(form.adult),
    childCents: optionalMoney(form.child),
    groupCents: optionalMoney(form.group),
    groupMinPeople:
      String(form.groupMinPeople).trim() === ''
        ? null
        : Number(form.groupMinPeople),
    activityCents: optionalMoney(form.activity),
    currency: 'USD',
    verificationStatus: form.verificationStatus,
    source: form.source.trim() || null,
    verifiedAt: form.verifiedAt || null,
    notes: form.notes.trim() || null,
    isActive: form.isActive,
  }
}

export default function BudgetAdminPage() {
  useDocumentTitle('Administración de presupuestos — Experiencia SV')
  const { session } = useAuth()
  const accessToken = session?.access_token ?? null
  const [config, setConfig] = useState(null)
  const [form, setForm] = useState(() => formFromSettings({}))
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [entranceForm, setEntranceForm] = useState(emptyEntrance)
  const [savingEntrance, setSavingEntrance] = useState(false)
  const [entranceError, setEntranceError] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deletingEntrance, setDeletingEntrance] = useState(false)

  const load = useCallback(async () => {
    if (!accessToken) return
    setStatus('loading')
    setError(null)
    try {
      const payload = await fetchAdminBudget({ accessToken })
      setConfig(payload)
      setForm(formFromSettings(payload.settings))
      setStatus('success')
    } catch (loadError) {
      setError(loadError)
      setStatus('error')
    }
  }, [accessToken])

  useEffect(() => {
    const timer = setTimeout(() => load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const updateMeal = (tier, meal, value) => {
    setForm((current) => ({
      ...current,
      mealTiers: {
        ...current.mealTiers,
        [tier]: {
          ...current.mealTiers[tier],
          [meal]: value,
        },
      },
    }))
  }

  const handleSaveSettings = async (event) => {
    event.preventDefault()
    setSavingSettings(true)
    setSettingsError(null)
    setNotice(null)
    try {
      const result = await updateAdminBudgetSettings(settingsPayload(form), {
        accessToken,
      })
      setConfig((current) => ({ ...current, settings: result.settings }))
      setForm(formFromSettings(result.settings))
      setNotice('La configuración de tarifas se guardó correctamente.')
    } catch (saveError) {
      setSettingsError(
        saveError?.message ?? 'No se pudo guardar la configuración.',
      )
    } finally {
      setSavingSettings(false)
    }
  }

  const updateEntrance = (key, value) => {
    setEntranceForm((current) => ({ ...current, [key]: value }))
  }

  const handleSaveEntrance = async (event) => {
    event.preventDefault()
    setSavingEntrance(true)
    setEntranceError(null)
    setNotice(null)
    try {
      await saveAdminEntrance(entrancePayload(entranceForm), { accessToken })
      setEntranceForm(emptyEntrance())
      setNotice('La entrada se guardó correctamente.')
      await load()
    } catch (saveError) {
      setEntranceError(saveError?.message ?? 'No se pudo guardar la entrada.')
    } finally {
      setSavingEntrance(false)
    }
  }

  const handleDeleteEntrance = async () => {
    if (!pendingDelete?.id) return
    setDeletingEntrance(true)
    setEntranceError(null)
    try {
      await deleteAdminEntrance(pendingDelete.id, { accessToken })
      setPendingDelete(null)
      setNotice('La entrada se eliminó del catálogo.')
      await load()
    } catch (deleteError) {
      setEntranceError(
        deleteError?.message ?? 'No se pudo eliminar la entrada.',
      )
    } finally {
      setDeletingEntrance(false)
    }
  }

  const entrances = useMemo(
    () => (Array.isArray(config?.entrancePrices) ? config.entrancePrices : []),
    [config],
  )

  if (!accessToken) return null

  if (status === 'loading') {
    return (
      <section className="account-page" aria-busy="true">
        <LoadingState count={2} message="Cargando la administración de presupuestos…" />
      </section>
    )
  }

  if (status === 'error') {
    const forbidden =
      error?.code === 'ADMIN_FORBIDDEN' || error?.status === 401 || error?.status === 403
    return (
      <section className="account-page admin-budget-page">
        <ErrorState
          title={forbidden ? 'Acceso restringido' : 'No pudimos cargar la administración'}
          description={
            forbidden
              ? 'Esta sección solo está disponible para las cuentas incluidas en ADMIN_EMAILS o ADMIN_USER_IDS en el servidor.'
              : (error?.message ?? 'Revisa tu conexión e intenta de nuevo.')
          }
          actionLabel={forbidden ? undefined : 'Reintentar'}
          onAction={forbidden ? undefined : load}
        />
      </section>
    )
  }

  return (
    <section className="account-page admin-budget-page" aria-labelledby="admin-budget-title">
      <nav className="account-breadcrumbs" aria-label="Ruta de navegación">
        <a href="/cuenta">Mi cuenta</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Administración de presupuestos</span>
      </nav>

      <header className="account-heading">
        <span className="eyebrow">ADMINISTRACIÓN</span>
        <h1 id="admin-budget-title">Tarifas y catálogo de entradas</h1>
        <p>
          Los cambios se aplican a los próximos cálculos. Los importes se guardan
          en centavos y las tarifas no verificadas nunca se presentan como
          confirmadas. El historial de presupuestos es privado para cada usuario.
        </p>
      </header>

      <AuthMessage tone="success">{notice}</AuthMessage>

      <form className="account-card admin-budget-settings" onSubmit={handleSaveSettings}>
        <h2>Tarifas configurables</h2>
        <div className="admin-budget-grid">
          <label>
            <span>Combustible (USD por litro)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.fuelPricePerLiter}
              onChange={(event) => updateForm('fuelPricePerLiter', event.target.value)}
            />
          </label>
          <label>
            <span>Consumo (L/100 km)</span>
            <input
              type="number"
              min="1"
              max="50"
              step="0.1"
              value={form.vehicleConsumptionLitersPer100Km}
              onChange={(event) =>
                updateForm('vehicleConsumptionLitersPer100Km', event.target.value)
              }
            />
          </label>
          <label>
            <span>Margen de seguridad (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.fuelSafetyMarginPercent}
              onChange={(event) =>
                updateForm('fuelSafetyMarginPercent', event.target.value)
              }
            />
          </label>
          <label>
            <span>Parqueo (USD por día)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.parkingPerDay}
              onChange={(event) => updateForm('parkingPerDay', event.target.value)}
            />
          </label>
          <label>
            <span>Peajes (USD por día)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.tollsPerDay}
              onChange={(event) => updateForm('tollsPerDay', event.target.value)}
            />
          </label>
          <label>
            <span>Transporte público (USD/km/persona)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.publicTransportPerKmPerPerson}
              onChange={(event) =>
                updateForm('publicTransportPerKmPerPerson', event.target.value)
              }
            />
          </label>
          <label>
            <span>Tarifa mínima por tramo (USD)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.publicTransportMinimumPerLeg}
              onChange={(event) =>
                updateForm('publicTransportMinimumPerLeg', event.target.value)
              }
            />
          </label>
          <label>
            <span>Velocidad media de respaldo (km/h)</span>
            <input
              type="number"
              min="5"
              max="120"
              step="1"
              value={form.averageSpeedKmh}
              onChange={(event) => updateForm('averageSpeedKmh', event.target.value)}
            />
          </label>
          <label>
            <span>Factor de carretera (respaldo)</span>
            <input
              type="number"
              min="1"
              max="2"
              step="0.01"
              value={form.roadFactor}
              onChange={(event) => updateForm('roadFactor', event.target.value)}
            />
          </label>
          <label>
            <span>Fondo de actividades (USD/persona/día)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.activityAllowance}
              onChange={(event) => updateForm('activityAllowance', event.target.value)}
            />
          </label>
          <label>
            <span>Entrada no verificada mínima (USD/persona)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.unverifiedEntranceMin}
              onChange={(event) =>
                updateForm('unverifiedEntranceMin', event.target.value)
              }
            />
          </label>
          <label>
            <span>Entrada no verificada máxima (USD/persona)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.unverifiedEntranceMax}
              onChange={(event) =>
                updateForm('unverifiedEntranceMax', event.target.value)
              }
            />
          </label>
          <label>
            <span>Gastos adicionales (%)</span>
            <input
              type="number"
              min="0"
              max="50"
              step="0.1"
              value={form.extrasPercent}
              onChange={(event) => updateForm('extrasPercent', event.target.value)}
            />
          </label>
          <label>
            <span>Margen del rango estimado (%)</span>
            <input
              type="number"
              min="0"
              max="50"
              step="0.1"
              value={form.estimateRangePercent}
              onChange={(event) =>
                updateForm('estimateRangePercent', event.target.value)
              }
            />
          </label>
        </div>

        <h3>Alimentación por persona y día</h3>
        <div className="admin-meal-table" role="table" aria-label="Tarifas de alimentación">
          <div className="admin-meal-row admin-meal-head" role="row">
            <span role="columnheader">Nivel</span>
            {MEALS.map((meal) => (
              <span role="columnheader" key={meal.id}>
                {meal.label}
              </span>
            ))}
          </div>
          {MEAL_TIERS.map((tier) => (
            <div className="admin-meal-row" role="row" key={tier.id}>
              <strong role="cell">{tier.label}</strong>
              {MEALS.map((meal) => (
                <label key={meal.id} role="cell">
                  <span className="visually-hidden">
                    {tier.label}, {meal.label}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.mealTiers[tier.id][meal.id]}
                    onChange={(event) =>
                      updateMeal(tier.id, meal.id, event.target.value)
                    }
                  />
                </label>
              ))}
            </div>
          ))}
        </div>

        <h3>Hospedaje por persona y noche</h3>
        <div className="admin-budget-grid">
          {MEAL_TIERS.map((tier) => (
            <label key={tier.id}>
              <span>{tier.label} (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.lodging[tier.id]}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    lodging: {
                      ...current.lodging,
                      [tier.id]: event.target.value,
                    },
                  }))
                }
              />
            </label>
          ))}
        </div>

        <AuthMessage>{settingsError}</AuthMessage>
        <button type="submit" className="button-primary" disabled={savingSettings}>
          {savingSettings ? 'Guardando tarifas…' : 'Guardar tarifas'}
        </button>
      </form>

      <section className="account-card admin-entrance-section" aria-labelledby="entrance-admin-title">
        <div className="admin-section-heading">
          <div>
            <h2 id="entrance-admin-title">Catálogo de entradas y actividades</h2>
            <p>
              Marca «Verificado» solo cuando tengas una fuente y una fecha. Si no
              hay precio, déjalo vacío: se mostrará «Precio no verificado».
            </p>
          </div>
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              setEntranceForm(emptyEntrance())
              setEntranceError(null)
            }}
          >
            Nueva entrada
          </button>
        </div>

        <form className="admin-entrance-form" onSubmit={handleSaveEntrance}>
          <div className="admin-budget-grid">
            <label>
              <span>Nombre</span>
              <input
                type="text"
                maxLength={160}
                value={entranceForm.name}
                onChange={(event) => updateEntrance('name', event.target.value)}
                required
              />
            </label>
            <label>
              <span>ID de OpenStreetMap (opcional)</span>
              <input
                type="text"
                placeholder="osm-node-123"
                value={entranceForm.placeId}
                onChange={(event) => updateEntrance('placeId', event.target.value)}
              />
            </label>
            <label>
              <span>Categoría</span>
              <input
                type="text"
                maxLength={80}
                value={entranceForm.category}
                onChange={(event) => updateEntrance('category', event.target.value)}
              />
            </label>
            <label>
              <span>Adulto (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={entranceForm.adult}
                onChange={(event) => updateEntrance('adult', event.target.value)}
              />
            </label>
            <label>
              <span>Niño (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={entranceForm.child}
                onChange={(event) => updateEntrance('child', event.target.value)}
              />
            </label>
            <label>
              <span>Grupo (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={entranceForm.group}
                onChange={(event) => updateEntrance('group', event.target.value)}
              />
            </label>
            <label>
              <span>Mínimo de personas para grupo</span>
              <input
                type="number"
                min="1"
                max="50"
                value={entranceForm.groupMinPeople}
                onChange={(event) =>
                  updateEntrance('groupMinPeople', event.target.value)
                }
              />
            </label>
            <label>
              <span>Actividad (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={entranceForm.activity}
                onChange={(event) => updateEntrance('activity', event.target.value)}
              />
            </label>
            <label>
              <span>Estado de verificación</span>
              <select
                value={entranceForm.verificationStatus}
                onChange={(event) =>
                  updateEntrance('verificationStatus', event.target.value)
                }
              >
                {VERIFICATION_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Fuente</span>
              <input
                type="text"
                maxLength={300}
                value={entranceForm.source}
                onChange={(event) => updateEntrance('source', event.target.value)}
                required={entranceForm.verificationStatus === 'verified'}
              />
            </label>
            <label>
              <span>Fecha de verificación</span>
              <input
                type="date"
                value={entranceForm.verifiedAt}
                onChange={(event) =>
                  updateEntrance('verifiedAt', event.target.value)
                }
                required={entranceForm.verificationStatus === 'verified'}
              />
            </label>
            <label className="budget-check">
              <input
                type="checkbox"
                checked={entranceForm.isActive}
                onChange={(event) =>
                  updateEntrance('isActive', event.target.checked)
                }
              />
              <span>Activo en el catálogo</span>
            </label>
          </div>
          <label className="admin-notes-field">
            <span>Notas</span>
            <textarea
              rows={2}
              maxLength={500}
              value={entranceForm.notes}
              onChange={(event) => updateEntrance('notes', event.target.value)}
            />
          </label>
          <AuthMessage>{entranceError}</AuthMessage>
          <div className="admin-form-actions">
            <button type="submit" className="button-primary" disabled={savingEntrance}>
              {savingEntrance
                ? 'Guardando entrada…'
                : entranceForm.id
                  ? 'Actualizar entrada'
                  : 'Agregar entrada'}
            </button>
            {entranceForm.id && (
              <button
                type="button"
                className="button-secondary"
                onClick={() => setEntranceForm(emptyEntrance())}
              >
                Cancelar edición
              </button>
            )}
          </div>
        </form>

        {entrances.length > 0 ? (
          <div className="admin-entrance-list">
            <h3>Entradas registradas</h3>
            <div className="admin-entrance-table" role="table">
              <div className="admin-entrance-row admin-entrance-head" role="row">
                <span role="columnheader">Nombre</span>
                <span role="columnheader">Estado</span>
                <span role="columnheader">Precios</span>
                <span role="columnheader">Fuente</span>
                <span role="columnheader">Acciones</span>
              </div>
              {entrances.map((entrance) => (
                <div className="admin-entrance-row" role="row" key={entrance.id}>
                  <span role="cell">
                    <strong>{entrance.name}</strong>
                    {entrance.placeId && <small>{entrance.placeId}</small>}
                  </span>
                  <span role="cell">
                    <span className={`budget-badge budget-badge-${entrance.verificationStatus}`}>
                      {VERIFICATION_OPTIONS.find(
                        (option) => option.id === entrance.verificationStatus,
                      )?.label ?? entrance.verificationStatus}
                    </span>
                    {entrance.verifiedAt && <small>{entrance.verifiedAt}</small>}
                  </span>
                  <span role="cell">
                    <small>
                      Adulto:{' '}
                      {entrance.adultCents === null
                        ? 'No verificado'
                        : `$${(entrance.adultCents / 100).toFixed(2)}`}
                    </small>
                    <small>
                      Niño:{' '}
                      {entrance.childCents === null
                        ? 'No verificado'
                        : `$${(entrance.childCents / 100).toFixed(2)}`}
                    </small>
                    <small>
                      Grupo:{' '}
                      {entrance.groupCents === null
                        ? 'No verificado'
                        : `$${(entrance.groupCents / 100).toFixed(2)}`}
                    </small>
                  </span>
                  <span role="cell">
                    <small>{entrance.source || 'Sin fuente'}</small>
                  </span>
                  <span role="cell" className="admin-row-actions">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setEntranceForm(entranceToForm(entrance))}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="admin-danger-button"
                      onClick={() => setPendingDelete(entrance)}
                    >
                      Eliminar
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="admin-empty">
            Todavía no hay entradas en el catálogo. Las paradas sin precio se
            mostrarán como «Precio no verificado» usando el rango configurable.
          </p>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="¿Eliminar esta entrada del catálogo?"
        description={`Se eliminará “${pendingDelete?.name ?? ''}”. Los presupuestos futuros volverán a mostrar el precio como no verificado.`}
        confirmLabel="Sí, eliminar"
        busy={deletingEntrance}
        onConfirm={handleDeleteEntrance}
        onCancel={() => {
          if (!deletingEntrance) setPendingDelete(null)
        }}
      />
    </section>
  )
}
