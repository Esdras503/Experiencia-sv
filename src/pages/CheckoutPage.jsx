import { useState } from 'react'
import { getPlan } from '../../shared/plans.js'
import AuthMessage from '../components/auth/AuthMessage.jsx'
import { useAuth } from '../context/authContext.js'
import { usePlanStatus } from '../context/planContext.js'
import { requestPlanCheckout } from '../services/planService.js'
import { buildLoginHref } from '../utils/authValidation.js'

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

export default function CheckoutPage({ search = '' }) {
  const { user, session } = useAuth()
  const {
    isCurrentPlan,
    paymentsEnabled,
    billingEnabled,
    demoMode,
    subscription,
    pass,
    status: planStatus,
  } = usePlanStatus()
  const [checkoutStatus, setCheckoutStatus] = useState('idle')
  const [checkoutError, setCheckoutError] = useState(null)

  const params = new URLSearchParams(search)
  const planId = params.get('plan')
  const plan = getPlan(planId)

  if (!plan || plan.billingType === 'free') {
    return (
      <section className="status-page" aria-labelledby="checkout-invalid-title">
        <span className="status-icon" aria-hidden="true">
          ?
        </span>
        <h1 id="checkout-invalid-title">Ese plan no requiere una compra</h1>
        <p>Vuelve a la página de planes para elegir una opción válida.</p>
        <a className="button-primary" href="/planes">
          Ver planes y precios
        </a>
      </section>
    )
  }

  if (demoMode) {
    return (
      <section className="checkout-page" aria-labelledby="checkout-demo-title">
        <nav className="account-breadcrumbs" aria-label="Ruta de navegación">
          <a href="/">Inicio</a>
          <span aria-hidden="true">/</span>
          <a href="/planes">Planes y precios</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Modo demostración</span>
        </nav>

        <header className="checkout-heading">
          <span className="eyebrow">MODO DEMOSTRACIÓN</span>
          <h1 id="checkout-demo-title">{plan.name}</h1>
          <p>
            Esta feria usa el modo demostración. Todas las funciones del plan ya
            están habilitadas gratuitamente, no se solicita ningún método de pago y
            no se activa ninguna suscripción ni pase.
          </p>
        </header>

        <div className="checkout-grid">
          <div className="checkout-card">
            <div className="checkout-plan-heading">
              <div>
                <span className="plan-badge">
                  {plan.billingType === 'pass'
                    ? 'Pase de 7 días'
                    : 'Suscripción mensual'}
                </span>
                <h2>{plan.name}</h2>
              </div>
              <span className="plan-demo-pill">Incluido en demo</span>
            </div>

            <p className="checkout-price">
              <strong>{plan.price}</strong>
              <span>{plan.priceSuffix}</span>
            </p>

            <ul className="plan-features">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <span className="plan-check" aria-hidden="true">
                    ✓
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <p className="checkout-note">
              El precio se muestra únicamente como referencia del catálogo. En la
              demostración no hay cobro, no se piden datos de tarjeta y no se crea
              una suscripción.
            </p>
          </div>

          <aside
            className="checkout-summary"
            aria-label="Resumen del modo demostración"
          >
            <h2>Resumen</h2>
            <dl className="checkout-summary-list">
              <div>
                <dt>Plan</dt>
                <dd>{plan.name}</dd>
              </div>
              <div>
                <dt>Importe</dt>
                <dd>Sin cargo</dd>
              </div>
              <div>
                <dt>Modo</dt>
                <dd>Demostración</dd>
              </div>
            </dl>

            <AuthMessage tone="info">
              Todas las funciones están habilitadas gratuitamente. No se ha
              realizado ningún cobro y no se activará ningún plan desde esta página.
            </AuthMessage>

            <a className="button-primary checkout-action" href="/">
              Usar todas las funciones
            </a>
            <a className="plan-secondary-link" href="/planes">
              Volver a planes y precios
            </a>
          </aside>
        </div>
      </section>
    )
  }

  const loginHref = buildLoginHref(`/planes/contratar?plan=${encodeURIComponent(plan.id)}`)
  const isCurrent = isCurrentPlan(plan.id)
  const currentExpiry =
    plan.billingType === 'pass'
      ? formatDate(pass?.expiresAt)
      : formatDate(subscription?.currentPeriodEnd)

  const handleCheckout = async () => {
    if (!paymentsEnabled || checkoutStatus === 'loading') return

    setCheckoutStatus('loading')
    setCheckoutError(null)

    try {
      const result = await requestPlanCheckout({
        planId: plan.id,
        accessToken: session?.access_token ?? null,
      })
      if (typeof result?.checkoutUrl === 'string' && result.checkoutUrl.startsWith('https://')) {
        window.location.assign(result.checkoutUrl)
        return
      }
      setCheckoutStatus('error')
      setCheckoutError(
        'La pasarela no devolvió una dirección de pago válida. No se ha realizado ningún cobro.',
      )
    } catch (error) {
      setCheckoutStatus('error')
      setCheckoutError(
        error?.message ??
          'No se pudo iniciar el pago. No se ha realizado ningún cobro.',
      )
    }
  }

  return (
    <section className="checkout-page" aria-labelledby="checkout-title">
      <nav className="account-breadcrumbs" aria-label="Ruta de navegación">
        <a href="/">Inicio</a>
        <span aria-hidden="true">/</span>
        <a href="/planes">Planes y precios</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Contratación</span>
      </nav>

      <header className="checkout-heading">
        <span className="eyebrow">CONTRATACIÓN</span>
        <h1 id="checkout-title">{plan.name}</h1>
        <p>
          Revisa las condiciones antes de continuar. La compra solo se activará
          cuando una pasarela de pago confirme el cobro en el servidor.
        </p>
      </header>

      <div className="checkout-grid">
        <div className="checkout-card">
          <div className="checkout-plan-heading">
            <div>
              <span className="plan-badge">
                {plan.billingType === 'pass' ? 'Pase de 7 días' : 'Suscripción mensual'}
              </span>
              <h2>{plan.name}</h2>
            </div>
            {isCurrent && <span className="plan-current-pill">Plan actual</span>}
          </div>

          <p className="checkout-price">
            <strong>{plan.price}</strong>
            <span>{plan.priceSuffix}</span>
          </p>

          <ul className="plan-features">
            {plan.features.map((feature) => (
              <li key={feature}>
                <span className="plan-check" aria-hidden="true">
                  ✓
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {plan.billingType === 'pass' && (
            <p className="checkout-note">
              La vigencia de 7 días empieza cuando se confirma el pago. No incluye
              entradas, transporte, alojamiento ni actividades pagadas.
            </p>
          )}
        </div>

        <aside className="checkout-summary" aria-label="Resumen de la contratación">
          <h2>Resumen</h2>
          <dl className="checkout-summary-list">
            <div>
              <dt>Plan</dt>
              <dd>{plan.name}</dd>
            </div>
            <div>
              <dt>Importe</dt>
              <dd>
                {plan.price} {plan.priceSuffix}
              </dd>
            </div>
            <div>
              <dt>Moneda</dt>
              <dd>USD</dd>
            </div>
            {isCurrent && currentExpiry && (
              <div>
                <dt>Vigencia actual</dt>
                <dd>Hasta el {currentExpiry}</dd>
              </div>
            )}
          </dl>

          {!user ? (
            <>
              <AuthMessage tone="info">
                Inicia sesión o crea una cuenta gratis para asociar el plan a tu
                perfil. Puedes seguir explorando sin cuenta.
              </AuthMessage>
              <a className="button-primary checkout-action" href={loginHref}>
                Iniciar sesión para continuar
              </a>
              <a
                className="plan-secondary-link"
                href="/cuenta/registro?next=%2Fplanes"
              >
                Crear cuenta gratis
              </a>
            </>
          ) : isCurrent ? (
            <>
              <AuthMessage tone="success">
                Ya tienes este plan activo
                {currentExpiry ? ` hasta el ${currentExpiry}` : ''}. No necesitas
                comprarlo de nuevo.
              </AuthMessage>
              <a className="button-primary checkout-action" href="/cuenta">
                Ver mi plan y consumo
              </a>
            </>
          ) : (
            <>
              {!paymentsEnabled && (
                <AuthMessage tone="info">
                  <strong>Pago aún no habilitado.</strong> No se ha realizado ningún
                  cobro y no se activará ningún plan desde esta página. La
                  contratación se habilitará cuando se conecte una pasarela real.
                </AuthMessage>
              )}

              {!billingEnabled && (
                <AuthMessage tone="info">
                  La verificación de planes tampoco está configurada en este
                  entorno. El equipo debe aplicar la migración y definir las
                  variables del servidor antes de aceptar pagos.
                </AuthMessage>
              )}

              {checkoutError && <AuthMessage>{checkoutError}</AuthMessage>}

              <button
                type="button"
                className="button-primary checkout-action"
                onClick={handleCheckout}
                disabled={!paymentsEnabled || checkoutStatus === 'loading'}
              >
                {checkoutStatus === 'loading'
                  ? 'Preparando pago…'
                  : paymentsEnabled
                    ? 'Continuar al pago'
                    : 'Pago no habilitado'}
              </button>
              <p className="checkout-note">
                El importe y la vigencia se confirman en el servidor. Esta página no
                simula pagos exitosos.
              </p>
            </>
          )}

          <a className="plan-secondary-link" href="/planes">
            Volver a planes y precios
          </a>
        </aside>
      </div>

      {planStatus === 'error' && (
        <p className="checkout-note" role="status">
          No pudimos consultar tu plan actual. Puedes revisar los precios, pero
          espera a que se restablezca la conexión antes de contratar.
        </p>
      )}
    </section>
  )
}
