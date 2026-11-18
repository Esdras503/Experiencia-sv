/**
 * Catálogo demostrativo de planes para negocios.
 *
 * Esta información es estática y vive únicamente en el frontend. No se guarda
 * en Supabase, no se envía a ningún endpoint y no representa una contratación
 * real. Los planes turísticos se mantienen en shared/plans.js y son un catálogo
 * independiente.
 */

export const BUSINESS_PLAN_IDS = Object.freeze({
  EXPLORER: 'negocio-explorador',
  FEATURED: 'negocio-destacado',
  PREMIUM: 'negocio-premium',
})

export const BUSINESS_PLANS = Object.freeze([
  Object.freeze({
    id: BUSINESS_PLAN_IDS.EXPLORER,
    name: 'Negocio Explorador',
    badge: 'Para empezar',
    tone: 'explorer',
    icon: 'compass',
    recommended: false,
    price: '$0.00',
    priceLabel: 'GRATIS',
    periodLabel: '/ mes',
    description:
      'Comienza a darle presencia digital a tu negocio dentro de Experiencia SV.',
    cta: 'Comenzar gratis',
    features: Object.freeze([
      Object.freeze({
        text: 'Registro demostrativo del negocio.',
        icon: 'profile',
      }),
      Object.freeze({
        text: 'Perfil público del establecimiento.',
        icon: 'store',
      }),
      Object.freeze({
        text: 'Descripción del negocio.',
        icon: 'file',
      }),
      Object.freeze({
        text: 'Fotografías básicas.',
        icon: 'image',
      }),
      Object.freeze({
        text: 'Ubicación dentro del mapa.',
        icon: 'map',
      }),
      Object.freeze({
        text: 'Información de contacto.',
        icon: 'contact',
      }),
      Object.freeze({
        text: 'Horarios de atención.',
        icon: 'clock',
      }),
      Object.freeze({
        text: 'Aparición en resultados orgánicos.',
        icon: 'search',
      }),
    ]),
  }),
  Object.freeze({
    id: BUSINESS_PLAN_IDS.FEATURED,
    name: 'Negocio Destacado',
    badge: 'Mayor visibilidad',
    tone: 'featured',
    icon: 'sparkles',
    recommended: true,
    price: '$9.99',
    priceLabel: null,
    periodLabel: '/ mes',
    description:
      'Consigue mayor visibilidad y permite que más turistas descubran tu negocio.',
    cta: 'Elegir Destacado',
    features: Object.freeze([
      Object.freeze({
        text: 'Todo lo incluido en Negocio Explorador.',
        icon: 'check',
      }),
      Object.freeze({
        text: 'Mayor visibilidad en búsquedas de su zona.',
        icon: 'visibility',
      }),
      Object.freeze({
        text: 'Posicionamiento patrocinado.',
        icon: 'sparkles',
      }),
      Object.freeze({
        text: 'Etiqueta de "Negocio destacado".',
        icon: 'tag',
      }),
      Object.freeze({
        text: 'Mayor exposición dentro de su categoría.',
        icon: 'exposure',
      }),
      Object.freeze({
        text: 'Estadísticas de visitas al perfil.',
        icon: 'chart',
      }),
      Object.freeze({
        text: 'Estadísticas de clics en WhatsApp.',
        icon: 'whatsapp',
      }),
      Object.freeze({
        text: 'Botón de contacto directo.',
        icon: 'contact',
      }),
    ]),
  }),
  Object.freeze({
    id: BUSINESS_PLAN_IDS.PREMIUM,
    name: 'Negocio Premium',
    badge: 'Más herramientas',
    tone: 'premium',
    icon: 'crown',
    recommended: false,
    price: '$19.99',
    priceLabel: null,
    periodLabel: '/ mes',
    description:
      'Lleva la presencia de tu negocio al siguiente nivel con herramientas promocionales adicionales.',
    cta: 'Elegir Premium',
    features: Object.freeze([
      Object.freeze({
        text: 'Todo lo incluido en Negocio Destacado.',
        icon: 'check',
      }),
      Object.freeze({
        text: 'Mayor prioridad entre los espacios patrocinados disponibles.',
        icon: 'priority',
      }),
      Object.freeze({
        text: 'Galería ampliada de fotografías.',
        icon: 'gallery',
      }),
      Object.freeze({
        text: 'Publicación de promociones y ofertas.',
        icon: 'promo',
      }),
      Object.freeze({
        text: 'Estadísticas avanzadas.',
        icon: 'analytics',
      }),
      Object.freeze({
        text: 'Herramientas promocionales adicionales.',
        icon: 'tools',
      }),
      Object.freeze({
        text: 'Mayor exposición dentro de la plataforma.',
        icon: 'exposure',
      }),
    ]),
  }),
])

export const BUSINESS_BENEFITS = Object.freeze([
  Object.freeze({
    title: 'Más descubrimiento',
    description:
      'Tu negocio puede aparecer cuando los turistas buscan lugares o servicios por categoría y zona.',
    icon: 'search',
  }),
  Object.freeze({
    title: 'Un perfil con identidad',
    description:
      'Presenta tu negocio con fotografías, descripción, ubicación, horarios y datos de contacto.',
    icon: 'store',
  }),
  Object.freeze({
    title: 'Contacto más directo',
    description:
      'Los planes Destacado y Premium incluyen un botón de contacto directo para facilitar la conversación.',
    icon: 'whatsapp',
  }),
  Object.freeze({
    title: 'Información para mejorar',
    description:
      'Consulta visitas al perfil y clics de contacto para entender cómo descubren tu negocio.',
    icon: 'chart',
  }),
])

export const BUSINESS_DISCOVERY_STEPS = Object.freeze([
  Object.freeze({
    title: 'El turista busca',
    description: 'Explora una categoría, un lugar o una zona cercana.',
    icon: 'search',
  }),
  Object.freeze({
    title: 'Coincide con tu negocio',
    description: 'Tu categoría, ubicación y perfil se relacionan con la búsqueda.',
    icon: 'map',
  }),
  Object.freeze({
    title: 'Descubre tu perfil',
    description: 'Ve tus fotografías, descripción, horarios y datos de contacto.',
    icon: 'store',
  }),
  Object.freeze({
    title: 'Contacta o visita',
    description: 'Puede iniciar una conversación directa o visitar tu negocio.',
    icon: 'contact',
  }),
])

export const BUSINESS_POSITIONING_STEPS = Object.freeze([
  Object.freeze({
    label: '01',
    title: 'Resultados orgánicos',
    description:
      'Los negocios con Negocio Explorador pueden aparecer en los resultados normales cuando su ubicación y categoría coinciden con la búsqueda del turista.',
    icon: 'search',
  }),
  Object.freeze({
    label: '02',
    title: 'Espacios patrocinados',
    description:
      'Los negocios con Negocio Destacado pueden aparecer en posiciones patrocinadas dentro de su categoría. Estos resultados siempre muestran una etiqueta visible.',
    icon: 'tag',
  }),
  Object.freeze({
    label: '03',
    title: 'Mayor prioridad',
    description:
      'Negocio Premium puede tener mayor prioridad entre los espacios patrocinados disponibles. La aparición depende de la coincidencia y de la disponibilidad de esos espacios.',
    icon: 'priority',
  }),
])

export const BUSINESS_FAQS = Object.freeze([
  Object.freeze({
    question: '¿Estos planes ya se pueden contratar?',
    answer:
      'Todavía no. Esta página es una demostración visual de los planes comerciales. Los botones muestran un aviso y no solicitan datos ni procesan pagos.',
  }),
  Object.freeze({
    question: '¿Los planes para negocios cambian mi cuenta de turista?',
    answer:
      'No. Los planes para negocios son independientes de Explorador, Experiencia Pro, Experiencia Élite y el pase turístico. Este catálogo no modifica cuentas ni suscripciones turísticas.',
  }),
  Object.freeze({
    question: '¿Contratar un plan garantiza el primer lugar?',
    answer:
      'No. Ningún plan garantiza una posición absoluta. La visibilidad depende de la coincidencia entre la búsqueda del turista, la ubicación y categoría del negocio, el plan activo y los espacios disponibles.',
  }),
  Object.freeze({
    question: '¿Los resultados patrocinados se identifican?',
    answer:
      'Sí. Los espacios patrocinados deben mostrar una etiqueta visible para que el turista distinga la promoción del resultado orgánico.',
  }),
])

export const BUSINESS_PLANS_DEMO_MESSAGE = Object.freeze({
  title: 'Gracias por tu interés',
  firstParagraph: '¡Gracias por tu interés en formar parte de Experiencia SV!',
  secondParagraph:
    'Esta es una demostración de nuestros planes comerciales. Próximamente podrás registrar tu negocio y contratar el plan que mejor se adapte a tus necesidades.',
})
