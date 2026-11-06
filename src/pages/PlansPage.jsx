import {
  COMPARISON_ROWS,
  PLAN_NOTICES,
  PLANS,
  getCheckoutHref,
  getPlan,
} from '../../shared/plans.js'
import { useAuth } from '../context/authContext.js'
import { usePlanStatus } from '../context/planContext.js'

function formatDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return new Intl.DateTimeFormat('es-SV', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}

function PlanFeatureList({ features }) {
  return (
    <ul className="plan-features">
      {features.map((feature) => (
        <li key={feature}>
          <span className="plan-check" aria-hidden="true">
            ✓
          </span>
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  )
}

function PlanCard({
  plan,
  authenticated,
  accountsConfigured,
  isCurrentPlan,
}) {
  const isCurrent = isCurrentPlan(plan.id)
  const recommended = plan.recommended

  let primaryAction
  if (plan.billingType === 'free') {
    primaryAction = (
      <a className="button-primary plan-cta" href="/">
        Explorar gratis <span aria-hidden="true">→</span>
      </a>
    )
  } else if (isCurrent) {
    primaryAction = (
      <button type="button" className="button-secondary plan-cta" disabled>
        Tu plan actual
      </button>
    )
  } else {
    primaryAction = (
      <a className="button-primary plan-cta" href={getCheckoutHref(plan.id)}>
        {plan.cta} <span aria-hidden="true">→</span>
      </a>
    )
  }

  return (
    <article
      className={`plan-card${recommended ? ' is-recommended' : ''}${
        isCurrent ? ' is-current' : ''
      }`}
      aria-labelledby={`plan-${plan.id}-title`}
    >
      <div className="plan-card-top">
        <span className="plan-badge">{recommended ? 'Recomendado' : plan.badge}</span>
        {isCurrent && <span className="plan-current-pill">Plan actual</span>}
      </div>

      <h2 id={`plan-${plan.id}-title`}>{plan.name}</h2>
      <p className="plan-description">{plan.description}</p>

      <p className="plan-price">
        <span>{plan.price}</span>
        <span className="plan-price-period">
          {plan.billingType === 'free' ? plan.periodLabel : plan.priceSuffix}
        </span>
      </p>
      <p className="plan-ai-limit">{plan.aiLimitLabel}</p>

      <PlanFeatureList features={plan.features} />

      {primaryAction}

      {plan.billingType === 'free' && accountsConfigured && (
        <a
          className="plan-secondary-link"
          href={authenticated ? '/cuenta' : '/cuenta/registro?next=%2Fplanes'}
        >
          {authenticated ? 'Ver mi cuenta' : 'Crear cuenta gratis'}
        </a>
      )}
    </article>
  )
}

export default function PlansPage() {
  const { configured: accountsConfigured } = useAuth()
  const {
    plan: currentPlan,
    usage,
    billingEnabled,
    paymentsEnabled,
    authenticated,
    status,
    isCurrentPlan,
  } = usePlanStatus()

  const subscriptionPlans = PLANS.filter((plan) => plan.billingType !== 'pass')
  const passPlan = getPlan('pase-7-dias')
  const usagePercent = usage
    ? Math.min(100, Math.round((usage.used / Math.max(usage.limit, 1)) * 100))
    : 0
  const periodEnd = formatDate(usage?.periodEnd)

  return (
    <div className="plans-page">
      <section className="plans-hero" aria-labelledby="plans-title">
        <nav className="account-breadcrumbs" aria-label="Ruta de navegación">
          <a href="/">Inicio</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Planes y precios</span>
        </nav>

        <span className="eyebrow">PLANES Y PRECIOS</span>
        <h1 id="plans-title">Descubre El Salvador a tu manera</h1>
        <p className="plans-hero-description">
          Explora gratis o elige más consultas y herramientas para planificar tu
          viaje. No necesitas pagar para buscar lugares, ver el mapa o conocer la
          plataforma.
        </p>

        <div className="plans-hero-points" aria-label="Resumen de los planes">
          <span>Exploración gratuita</span>
          <span>Hasta 600 consultas de IA al mes</span>
          <span>Pase de 7 días sin suscripción</span>
        </div>
      </section>

      {billingEnabled && usage && (
        <aside className="plan-current-banner" aria-label="Tu plan actual">
          <div>
            <span className="eyebrow">
              {authenticated ? 'TU PLAN ACTUAL' : 'CUPO DE VISITANTE'}
            </span>
            <strong>{currentPlan.name}</strong>
            <p>
              {usage.used} de {usage.limit} consultas de IA usadas
              {periodEnd ? ` · se reinicia el ${periodEnd}` : ''}
            </p>
          </div>
          <div
            className="plan-usage-meter"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={usage.limit}
            aria-valuenow={usage.used}
            aria-label={`${usage.used} de ${usage.limit} consultas utilizadas`}
          >
            <span style={{ width: `${usagePercent}%` }} />
          </div>
          <a
            className="button-secondary"
            href={authenticated ? '/cuenta' : '/cuenta/registro?next=%2Fplanes'}
          >
            {authenticated ? 'Ver consumo en mi cuenta' : 'Crear cuenta gratis'}
          </a>
        </aside>
      )}

      {status === 'ready' && !billingEnabled && (
        <p className="plans-info-note" role="status">
          Los límites de plan todavía no están activos en este entorno. Los precios
          y las condiciones que ves son los oficiales; el chat seguirá disponible
          mientras se completa la configuración.
        </p>
      )}

      {!paymentsEnabled && (
        <p className="plans-payment-note" role="status">
          <strong>Pago aún no habilitado.</strong> Los botones de los planes de pago
          abren el proceso de contratación, pero todavía no se puede cobrar ni se
          activa ningún plan. No se realizará ningún cargo.
        </p>
      )}

      <section className="plans-section" aria-labelledby="plans-options-title">
        <div className="plans-section-heading">
          <span className="eyebrow">ELIGE TU EXPERIENCIA</span>
          <h2 id="plans-options-title">Planes para cada tipo de viaje</h2>
          <p>
            Puedes empezar gratis y cambiar cuando necesites más consultas o
            herramientas de planificación.
          </p>
        </div>

        <div className="plans-grid">
          {subscriptionPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              authenticated={authenticated}
              accountsConfigured={accountsConfigured}
              isCurrentPlan={isCurrentPlan}
            />
          ))}
        </div>
      </section>

      <section className="pass-section" aria-labelledby="pass-title">
        <div className="pass-copy">
          <span className="eyebrow">VISITA PUNTUAL</span>
          <h2 id="pass-title">{passPlan.name}</h2>
          <p>
            Si vienes a El Salvador por unos días y no quieres una suscripción
            mensual, el pase te da acceso durante 7 días desde que se confirma el
            pago.
          </p>
          <p className="pass-price">
            <strong>{passPlan.price}</strong>
            <span>{passPlan.priceSuffix}</span>
          </p>
          <p className="pass-note">
            La vigencia no empieza al abrir esta página ni al seleccionar el pase.
            No incluye entradas, transporte, alojamiento ni actividades pagadas.
          </p>
        </div>

        <div className="pass-details">
          <h3>Incluye</h3>
          <PlanFeatureList features={passPlan.features} />
          {isCurrentPlan(passPlan.id) ? (
            <button type="button" className="button-secondary plan-cta" disabled>
              Pase activo
            </button>
          ) : (
            <a className="button-primary plan-cta" href={getCheckoutHref(passPlan.id)}>
              {passPlan.cta} <span aria-hidden="true">→</span>
            </a>
          )}
        </div>
      </section>

      <section className="plans-section" aria-labelledby="comparison-title">
        <div className="plans-section-heading">
          <span className="eyebrow">COMPARACIÓN</span>
          <h2 id="comparison-title">Funcionalidades lado a lado</h2>
          <p>
            Los límites se aplican en el servidor. Las llamadas a mapas y servicios
            de OpenStreetMap son un consumo distinto de las consultas de IA.
          </p>
        </div>

        <div className="plans-table-wrap">
          <table className="plans-table">
            <caption className="visually-hidden">
              Comparación de los planes Explorador, Experiencia Pro, Experiencia
              Élite y el pase turístico de 7 días
            </caption>
            <thead>
              <tr>
                <th scope="col">Funcionalidad</th>
                <th scope="col">Explorador</th>
                <th scope="col" className="is-recommended-column">
                  Experiencia Pro
                </th>
                <th scope="col">Experiencia Élite</th>
                <th scope="col">Pase de 7 días</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.explorador}</td>
                  <td className="is-recommended-column">{row.pro}</td>
                  <td>{row.elite}</td>
                  <td>{row.pass}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="plans-section" aria-labelledby="plans-notes-title">
        <div className="plans-section-heading">
          <span className="eyebrow">ANTES DE ELEGIR</span>
          <h2 id="plans-notes-title">Condiciones claras</h2>
        </div>

        <ul className="plans-notices">
          {PLAN_NOTICES.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>

        <div className="plans-faq">
          <details>
            <summary>¿Puedo usar Experiencia SV sin pagar?</summary>
            <p>
              Sí. El plan Explorador es gratuito e incluye búsqueda, mapa, 2
              itinerarios guardados y 10 consultas de IA al mes.
            </p>
          </details>
          <details>
            <summary>¿Qué ocurre si alcanzo el límite de consultas?</summary>
            <p>
              El asistente dejará de procesar nuevas consultas hasta que se renueve
              el período o cambies de plan. La búsqueda de lugares y el mapa siguen
              disponibles.
            </p>
          </details>
          <details>
            <summary>¿Ya se puede pagar con tarjeta?</summary>
            <p>
              Todavía no hay una pasarela de pago conectada. Cuando se habilite, los
              pagos se confirmarán en el backend y el pase empezará a contar en ese
              momento. No se activa ningún plan por visitar esta página.
            </p>
          </details>
          <details>
            <summary>¿Los planes incluyen reservas o disponibilidad en tiempo real?</summary>
            <p>
              No mientras no exista una integración de reservas verificada. Los
              itinerarios usan información disponible en OpenStreetMap y el
              asistente; confirma horarios, precios y disponibilidad antes de viajar.
            </p>
          </details>
        </div>
      </section>
    </div>
  )
}
