/**
 * Catálogo comercial de Experiencia SV.
 *
 * Los precios y límites de este archivo son los valores oficiales que se
 * muestran en la interfaz. La migración de Supabase siembra los mismos valores
 * en public.plans, que es la fuente de verdad para aplicar los límites en el
 * backend. Si cambia un precio o un límite, actualiza ambos lugares y las
 * pruebas.
 */

export const PLAN_IDS = Object.freeze({
  EXPLORER: 'explorador',
  PRO: 'pro',
  ELITE: 'elite',
  PASS: 'pase-7-dias',
})

export const FREE_PLAN_ID = PLAN_IDS.EXPLORER
export const PASS_PLAN_ID = PLAN_IDS.PASS
export const PAID_PLAN_IDS = Object.freeze([PLAN_IDS.PRO, PLAN_IDS.ELITE])

export const PLANS = Object.freeze([
  Object.freeze({
    id: PLAN_IDS.EXPLORER,
    name: 'Explorador',
    billingType: 'free',
    priceCents: 0,
    price: '$0.00',
    priceSuffix: '',
    periodLabel: 'para siempre',
    aiQueryLimit: 10,
    aiLimitLabel: '10 consultas de IA al mes',
    savedItineraryLimit: 2,
    savedItineraryLabel: 'Hasta 2 itinerarios guardados',
    durationDays: null,
    recommended: false,
    badge: 'Para empezar',
    cta: 'Explorar gratis',
    description:
      'Descubre El Salvador y prueba el asistente sin pagar. Ideal para una primera visita o una escapada corta.',
    features: Object.freeze([
      'Exploración de lugares turísticos',
      'Filtros de búsqueda y visualización en el mapa',
      'Hasta 2 itinerarios guardados',
      'Hasta 10 consultas de inteligencia artificial al mes',
      'Información turística básica',
    ]),
  }),
  Object.freeze({
    id: PLAN_IDS.PRO,
    name: 'Experiencia Pro',
    billingType: 'monthly',
    priceCents: 799,
    price: '$7.99',
    priceSuffix: 'al mes',
    periodLabel: 'mensual',
    aiQueryLimit: 200,
    aiLimitLabel: '200 consultas de IA al mes',
    savedItineraryLimit: null,
    savedItineraryLabel: 'Sin límite de itinerarios del plan',
    durationDays: null,
    recommended: true,
    badge: 'Recomendado',
    cta: 'Elegir Experiencia Pro',
    description:
      'Planifica tus viajes con más consultas, itinerarios personalizados y herramientas para organizar cada día.',
    features: Object.freeze([
      'Hasta 200 consultas de inteligencia artificial al mes',
      'Creación de itinerarios personalizados',
      'Guardado y organización de itinerarios',
      'Planificación según presupuesto',
      'Optimización de rutas',
      'Exportación de itinerarios a PDF',
      'Planificación de viajes de varios días',
      'Modificación de itinerarios mediante el chatbot',
    ]),
  }),
  Object.freeze({
    id: PLAN_IDS.ELITE,
    name: 'Experiencia Élite',
    billingType: 'monthly',
    priceCents: 1499,
    price: '$14.99',
    priceSuffix: 'al mes',
    periodLabel: 'mensual',
    aiQueryLimit: 600,
    aiLimitLabel: '600 consultas de IA al mes',
    savedItineraryLimit: null,
    savedItineraryLabel: 'Sin límite de itinerarios del plan',
    durationDays: null,
    recommended: false,
    badge: 'Para grupos y viajes largos',
    cta: 'Elegir Experiencia Élite',
    description:
      'Más capacidad para grupos, comparaciones y viajes de varios días, con todas las funciones de Pro.',
    features: Object.freeze([
      'Todas las funcionalidades de Experiencia Pro',
      'Hasta 600 consultas de inteligencia artificial al mes',
      'Planificación avanzada para grupos',
      'Comparación de itinerarios',
      'Alternativas de actividades y destinos según la información disponible',
      'Herramientas avanzadas para rutas',
      'Soporte prioritario cuando exista un canal de soporte disponible',
    ]),
  }),
  Object.freeze({
    id: PLAN_IDS.PASS,
    name: 'Pase turístico de 7 días',
    billingType: 'pass',
    priceCents: 399,
    price: '$3.99',
    priceSuffix: 'por 7 días',
    periodLabel: '7 días',
    aiQueryLimit: 50,
    aiLimitLabel: '50 consultas de IA durante el pase',
    savedItineraryLimit: null,
    savedItineraryLabel: 'Guardado y modificación de itinerarios',
    durationDays: 7,
    recommended: false,
    badge: 'Viaje puntual',
    cta: 'Comprar pase de 7 días',
    description:
      'Para quienes visitan El Salvador una vez y prefieren pagar solo por los días del viaje.',
    features: Object.freeze([
      'Acceso durante 7 días desde la confirmación del pago',
      'Hasta 50 consultas de inteligencia artificial durante la vigencia',
      'Creación de itinerarios turísticos',
      'Guardado y modificación de itinerarios',
      'Acceso a mapas y herramientas de rutas disponibles',
      'Exportación de itinerarios',
    ]),
  }),
])

export const PLAN_BY_ID = Object.freeze(
  Object.fromEntries(PLANS.map((plan) => [plan.id, plan])),
)

export const PLANS_BY_ID = PLAN_BY_ID

export const COMPARISON_ROWS = Object.freeze([
  Object.freeze({
    label: 'Precio',
    explorador: '$0.00',
    pro: '$7.99 al mes',
    elite: '$14.99 al mes',
    pass: '$3.99 por 7 días',
  }),
  Object.freeze({
    label: 'Consultas de IA',
    explorador: '10 al mes',
    pro: '200 al mes',
    elite: '600 al mes',
    pass: '50 durante el pase',
  }),
  Object.freeze({
    label: 'Itinerarios guardados',
    explorador: 'Hasta 2',
    pro: 'Sin límite del plan',
    elite: 'Sin límite del plan',
    pass: 'Durante el pase',
  }),
  Object.freeze({
    label: 'Explorar lugares, filtros y mapa',
    explorador: 'Incluido',
    pro: 'Incluido',
    elite: 'Incluido',
    pass: 'Incluido',
  }),
  Object.freeze({
    label: 'Itinerarios personalizados',
    explorador: 'Básico',
    pro: 'Incluido',
    elite: 'Incluido',
    pass: 'Incluido',
  }),
  Object.freeze({
    label: 'Planificación según presupuesto',
    explorador: '—',
    pro: 'Incluido',
    elite: 'Incluido',
    pass: '—',
  }),
  Object.freeze({
    label: 'Optimización de rutas',
    explorador: '—',
    pro: 'Asistida por IA',
    elite: 'Herramientas avanzadas',
    pass: 'Herramientas disponibles',
  }),
  Object.freeze({
    label: 'Exportación a PDF',
    explorador: '—',
    pro: 'Incluido',
    elite: 'Incluido',
    pass: 'Incluido',
  }),
  Object.freeze({
    label: 'Viajes de varios días',
    explorador: '—',
    pro: 'Incluido',
    elite: 'Incluido',
    pass: 'Incluido',
  }),
  Object.freeze({
    label: 'Modificación con el chatbot',
    explorador: '—',
    pro: 'Incluido',
    elite: 'Incluido',
    pass: 'Incluido',
  }),
  Object.freeze({
    label: 'Planificación para grupos',
    explorador: '—',
    pro: '—',
    elite: 'Incluido',
    pass: '—',
  }),
  Object.freeze({
    label: 'Comparación de itinerarios',
    explorador: '—',
    pro: '—',
    elite: 'Incluido',
    pass: '—',
  }),
  Object.freeze({
    label: 'Alternativas de actividades y destinos',
    explorador: '—',
    pro: '—',
    elite: 'Según información disponible',
    pass: '—',
  }),
  Object.freeze({
    label: 'Soporte prioritario',
    explorador: '—',
    pro: '—',
    elite: 'Cuando haya canal disponible',
    pass: '—',
  }),
])

export const PLAN_NOTICES = Object.freeze([
  'Los precios están expresados en dólares estadounidenses (USD).',
  'El pase de 7 días empieza a contar cuando se confirma el pago, no al abrir la página ni al seleccionar el pase.',
  'El pase no incluye entradas, transporte, alojamiento, actividades pagadas ni otros servicios externos.',
  'Las consultas de IA son independientes de las llamadas a mapas, rutas o servicios de OpenStreetMap.',
  'Las funciones de planificación usan la información disponible en OpenStreetMap y el asistente. No confirman disponibilidad, horarios, precios ni reservas en tiempo real.',
  'El soporte prioritario solo se ofrece si existe un canal de soporte activo. Actualmente no se promete atención prioritaria.',
])

export function getPlan(planId) {
  return typeof planId === 'string' ? PLAN_BY_ID[planId] ?? null : null
}

export function isPaidPlan(planId) {
  return PAID_PLAN_IDS.includes(planId) || planId === PASS_PLAN_ID
}

export function isMonthlyPlan(planId) {
  return PAID_PLAN_IDS.includes(planId)
}

export function formatCents(cents) {
  const value = Number(cents)
  if (!Number.isFinite(value) || value < 0) return '$0.00'
  return `$${(value / 100).toFixed(2)}`
}

export function getCheckoutHref(planId) {
  const plan = getPlan(planId)
  if (!plan || plan.billingType === 'free') return '/planes'
  return `/planes/contratar?plan=${encodeURIComponent(plan.id)}`
}

export function getPlanFeatures(planId) {
  return getPlan(planId)?.features ?? []
}
