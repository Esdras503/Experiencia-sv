import { useCallback, useState } from 'react'
import BusinessIcon from '../components/business/BusinessIcon.jsx'
import InfoDialog from '../components/ui/InfoDialog.jsx'
import {
  BUSINESS_BENEFITS,
  BUSINESS_DISCOVERY_STEPS,
  BUSINESS_FAQS,
  BUSINESS_PLANS,
  BUSINESS_PLANS_DEMO_MESSAGE,
  BUSINESS_POSITIONING_STEPS,
} from '../data/businessPlans.js'

function BusinessPlanCard({ plan, onSelect }) {
  return (
    <article
      className={`business-plan-card business-plan-${plan.tone}${
        plan.recommended ? ' is-recommended' : ''
      }`}
      aria-labelledby={`business-plan-${plan.id}-title`}
    >
      {plan.recommended && (
        <span className="business-plan-ribbon">Recomendado</span>
      )}

      <div className="business-plan-heading">
        <span className="business-plan-icon">
          <BusinessIcon name={plan.icon} size={27} />
        </span>
        <span className="business-plan-badge">{plan.badge}</span>
      </div>

      <h3 id={`business-plan-${plan.id}-title`}>{plan.name}</h3>
      <p className="business-plan-description">{plan.description}</p>

      <div className="business-plan-price" aria-label={`Precio: ${plan.priceLabel ?? plan.price} ${plan.periodLabel}`}>
        {plan.priceLabel && (
          <strong className="business-plan-price-label">{plan.priceLabel}</strong>
        )}
        <span className="business-plan-price-amount">{plan.price}</span>
        <span className="business-plan-price-period">{plan.periodLabel}</span>
      </div>
      <p className="business-plan-price-note">
        Precio de referencia en USD. Sin cobros en esta demostración.
      </p>

      <ul className="business-plan-features">
        {plan.features.map((feature) => (
          <li key={feature.text}>
            <span className="business-feature-icon">
              <BusinessIcon name={feature.icon} size={15} />
            </span>
            <span>{feature.text}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={`business-plan-cta ${
          plan.recommended ? 'button-primary' : 'button-secondary'
        }`}
        onClick={() => onSelect(plan)}
        aria-haspopup="dialog"
      >
        {plan.cta} <span aria-hidden="true">→</span>
      </button>
    </article>
  )
}

export default function BusinessPlansPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)

  const openDemo = (plan = null) => {
    setSelectedPlan(plan)
    setDialogOpen(true)
  }

  const closeDialog = useCallback(() => {
    setDialogOpen(false)
  }, [])

  return (
    <div className="plans-page business-plans-page">
      <section className="plans-hero business-hero" aria-labelledby="business-plans-title">
        <nav className="account-breadcrumbs" aria-label="Ruta de navegación">
          <a href="/">Inicio</a>
          <span aria-hidden="true">/</span>
          <a href="/planes">Planes y precios</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Planes para negocios</span>
        </nav>

        <div className="business-hero-kicker">
          <span className="eyebrow">PLANES PARA NEGOCIOS</span>
          <span className="business-demo-pill">Demostración · sin cobros</span>
        </div>

        <h1 id="business-plans-title">Tu negocio, más cerca de cada viajero.</h1>
        <p className="plans-hero-description">
          Impulsa tu negocio turístico, llega a más visitantes y consigue mayor
          visibilidad dentro de Experiencia SV. Muestra lo que haces y aparece
          cuando los turistas buscan lugares, servicios y establecimientos
          cercanos.
        </p>

        <div className="plans-hero-points" aria-label="Resumen de los planes para negocios">
          <span>Perfil público del negocio</span>
          <span>Más visibilidad local</span>
          <span>Información para tomar decisiones</span>
        </div>

        <div className="business-hero-actions">
          <a className="button-primary" href="#business-plans">
            Ver los tres planes <span aria-hidden="true">↓</span>
          </a>
          <a className="button-secondary" href="#como-funciona">
            Cómo funciona la visibilidad
          </a>
        </div>

        <p className="business-separation-note">
          Estos planes son independientes de Explorador, Experiencia Pro,
          Experiencia Élite y el pase turístico. No modifican tu cuenta ni tus
          beneficios como viajero.
        </p>
      </section>

      <section className="business-section business-benefits-section" aria-labelledby="business-benefits-title">
        <div className="plans-section-heading">
          <span className="eyebrow">VISIBILIDAD CON PROPÓSITO</span>
          <h2 id="business-benefits-title">
            Una forma más clara de ser descubierto
          </h2>
          <p>
            Los turistas ya buscan qué hacer, dónde comer y qué servicios usar.
            Experiencia SV conecta esas búsquedas con negocios que tienen una
            ubicación y una categoría relevantes.
          </p>
        </div>

        <div className="business-benefit-grid">
          {BUSINESS_BENEFITS.map((benefit) => (
            <article className="business-benefit-card" key={benefit.title}>
              <span className="business-benefit-icon">
                <BusinessIcon name={benefit.icon} size={23} />
              </span>
              <h3>{benefit.title}</h3>
              <p>{benefit.description}</p>
            </article>
          ))}
        </div>

        <div className="business-discovery">
          <div className="business-discovery-heading">
            <span className="eyebrow">EL RECORRIDO</span>
            <h3>Así puede encontrarte un turista</h3>
          </div>
          <ol className="business-discovery-steps">
            {BUSINESS_DISCOVERY_STEPS.map((step, index) => (
              <li key={step.title}>
                <span className="business-discovery-icon">
                  <BusinessIcon name={step.icon} size={20} />
                </span>
                <span className="business-discovery-number" aria-hidden="true">
                  0{index + 1}
                </span>
                <strong>{step.title}</strong>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        className="business-section business-plans-section"
        id="business-plans"
        aria-labelledby="business-plans-options-title"
      >
        <div className="plans-section-heading">
          <span className="eyebrow">ELIGE TU PLAN</span>
          <h2 id="business-plans-options-title">
            Tres formas de mostrar tu negocio
          </h2>
          <p>
            Empieza gratis y aumenta la visibilidad cuando quieras. Todos los
            precios son de referencia y esta demostración no procesa pagos ni
            registra información.
          </p>
        </div>

        <div className="business-plan-grid">
          {BUSINESS_PLANS.map((plan) => (
            <BusinessPlanCard
              key={plan.id}
              plan={plan}
              onSelect={openDemo}
            />
          ))}
        </div>

        <p className="business-demo-note" role="note">
          <strong>Demostración informativa.</strong> Los botones abren un aviso
          con el siguiente paso previsto. No se solicita tarjeta, no se guarda
          información y no se activa ningún plan.
        </p>
      </section>

      <section
        className="business-section business-positioning-section"
        id="como-funciona"
        aria-labelledby="business-positioning-title"
      >
        <div className="plans-section-heading">
          <span className="eyebrow">POSICIONAMIENTO TRANSPARENTE</span>
          <h2 id="business-positioning-title">
            La visibilidad depende de la búsqueda
          </h2>
          <p>
            No prometemos el primer lugar ni una posición absoluta. La aparición
            de un negocio depende de la coincidencia entre la búsqueda del
            turista, la ubicación y categoría del negocio, el plan activo y los
            espacios disponibles.
          </p>
        </div>

        <div className="business-positioning-layout">
          <ol className="business-positioning-steps">
            {BUSINESS_POSITIONING_STEPS.map((step) => (
              <li key={step.label}>
                <span className="business-positioning-icon">
                  <BusinessIcon name={step.icon} size={21} />
                </span>
                <span className="business-positioning-number">{step.label}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="business-search-example" aria-label="Ejemplo ilustrativo de resultados patrocinados y orgánicos">
            <div className="business-example-heading">
              <span className="business-example-label">Ejemplo ilustrativo</span>
              <span className="business-example-caption">
                Así podría verse una búsqueda
              </span>
            </div>

            <div className="business-example-search" aria-hidden="true">
              <BusinessIcon name="search" size={18} />
              <span>Cafeterías cerca de Suchitoto</span>
            </div>

            <div className="business-example-results">
              <div className="business-example-result is-sponsored is-premium">
                <span className="business-example-badge">Patrocinado · Premium</span>
                <strong>Negocio de ejemplo</strong>
                <p>Mayor prioridad entre los espacios patrocinados disponibles.</p>
              </div>
              <div className="business-example-result is-sponsored">
                <span className="business-example-badge">Patrocinado</span>
                <strong>Negocio destacado de ejemplo</strong>
                <p>Resultado promocionado con etiqueta visible.</p>
              </div>
              <div className="business-example-result is-organic">
                <span className="business-example-badge is-organic">Resultado orgánico</span>
                <strong>Negocio local de ejemplo</strong>
                <p>Aparece por coincidencia de categoría y ubicación.</p>
              </div>
            </div>

            <p className="business-example-footnote">
              Ejemplo visual sin establecimientos reales. La posición y la
              disponibilidad pueden variar; no se garantiza un lugar fijo.
            </p>
          </div>
        </div>

        <p className="business-positioning-note">
          Los resultados patrocinados siempre deben mostrar una etiqueta visible.
          La ubicación y la categoría del negocio deben coincidir con la búsqueda
          del turista para que el perfil sea relevante.
        </p>
      </section>

      <section className="business-section business-faq-section" aria-labelledby="business-faq-title">
        <div className="plans-section-heading">
          <span className="eyebrow">ANTES DE CONTINUAR</span>
          <h2 id="business-faq-title">Preguntas claras</h2>
        </div>

        <div className="plans-faq business-faq">
          {BUSINESS_FAQS.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="business-final-cta" aria-labelledby="business-final-title">
        <div>
          <span className="eyebrow">TU NEGOCIO, EN EL MAPA</span>
          <h2 id="business-final-title">Haz que tu negocio forme parte del viaje.</h2>
          <p>
            Muy pronto podrás crear el perfil de tu negocio y elegir el plan que
            mejor se adapte a tus objetivos.
          </p>
        </div>
        <button
          type="button"
          className="business-final-button"
          onClick={() => openDemo(BUSINESS_PLANS[1])}
          aria-haspopup="dialog"
        >
          Quiero conocer los planes <span aria-hidden="true">→</span>
        </button>
      </section>

      <p className="business-page-note">
        Esta página es una demostración visual. No utiliza base de datos, no
        procesa pagos y no envía información a ningún servicio externo.
      </p>

      <InfoDialog
        open={dialogOpen}
        title={BUSINESS_PLANS_DEMO_MESSAGE.title}
        eyebrow={
          selectedPlan
            ? `Plan seleccionado · ${selectedPlan.name}`
            : 'PLANES PARA NEGOCIOS'
        }
        onClose={closeDialog}
      >
        <p>{BUSINESS_PLANS_DEMO_MESSAGE.firstParagraph}</p>
        <p>{BUSINESS_PLANS_DEMO_MESSAGE.secondParagraph}</p>
        {selectedPlan && (
          <p className="info-dialog-plan">
            Plan de referencia: <strong>{selectedPlan.name}</strong>
          </p>
        )}
        <p className="info-dialog-note">
          No se guardó información. Esta ventana forma parte de la demostración.
        </p>
      </InfoDialog>
    </div>
  )
}
