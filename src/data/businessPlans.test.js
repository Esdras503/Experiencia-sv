import test from 'node:test'
import assert from 'node:assert/strict'
import { PLANS } from '../../shared/plans.js'
import {
  BUSINESS_PLANS,
  BUSINESS_PLANS_DEMO_MESSAGE,
  BUSINESS_PLAN_IDS,
} from './businessPlans.js'

test('muestra los tres planes comerciales con sus precios y botones', () => {
  assert.equal(BUSINESS_PLANS.length, 3)
  assert.deepEqual(
    BUSINESS_PLANS.map((plan) => ({
      name: plan.name,
      price: plan.price,
      priceLabel: plan.priceLabel,
      period: plan.periodLabel,
      cta: plan.cta,
    })),
    [
      {
        name: 'Negocio Explorador',
        price: '$0.00',
        priceLabel: 'GRATIS',
        period: '/ mes',
        cta: 'Comenzar gratis',
      },
      {
        name: 'Negocio Destacado',
        price: '$9.99',
        priceLabel: null,
        period: '/ mes',
        cta: 'Elegir Destacado',
      },
      {
        name: 'Negocio Premium',
        price: '$19.99',
        priceLabel: null,
        period: '/ mes',
        cta: 'Elegir Premium',
      },
    ],
  )
})

test('marca únicamente Negocio Destacado como recomendado', () => {
  const recommended = BUSINESS_PLANS.filter((plan) => plan.recommended)
  assert.equal(recommended.length, 1)
  assert.equal(recommended[0].id, BUSINESS_PLAN_IDS.FEATURED)
})

test('incluye las características comerciales solicitadas', () => {
  const explorerFeatures = BUSINESS_PLANS[0].features.map((feature) => feature.text)
  assert.ok(explorerFeatures.includes('Ubicación dentro del mapa.'))
  assert.ok(explorerFeatures.includes('Aparición en resultados orgánicos.'))

  const featuredFeatures = BUSINESS_PLANS[1].features.map((feature) => feature.text)
  assert.ok(featuredFeatures.includes('Posicionamiento patrocinado.'))
  assert.ok(featuredFeatures.includes('Etiqueta de "Negocio destacado".'))
  assert.ok(featuredFeatures.includes('Estadísticas de clics en WhatsApp.'))
  assert.ok(featuredFeatures.includes('Botón de contacto directo.'))

  const premiumFeatures = BUSINESS_PLANS[2].features.map((feature) => feature.text)
  assert.ok(
    premiumFeatures.includes(
      'Mayor prioridad entre los espacios patrocinados disponibles.',
    ),
  )
  assert.ok(premiumFeatures.includes('Galería ampliada de fotografías.'))
  assert.ok(premiumFeatures.includes('Publicación de promociones y ofertas.'))
  assert.ok(premiumFeatures.includes('Herramientas promocionales adicionales.'))
})

test('cada característica tiene un icono y los identificadores son únicos', () => {
  const ids = new Set()

  for (const plan of BUSINESS_PLANS) {
    assert.ok(plan.features.length > 0)
    for (const feature of plan.features) {
      assert.ok(feature.text.length > 0)
      assert.ok(feature.icon.length > 0)
    }
    assert.equal(ids.has(plan.id), false)
    ids.add(plan.id)
  }
})

test('mantiene los planes turísticos separados del catálogo comercial', () => {
  assert.deepEqual(
    PLANS.map((plan) => plan.id),
    ['explorador', 'pro', 'elite', 'pase-7-dias'],
  )
  assert.equal(
    PLANS.some((plan) => Object.values(BUSINESS_PLAN_IDS).includes(plan.id)),
    false,
  )
})

test('conserva el mensaje exacto del modal demostrativo', () => {
  assert.equal(BUSINESS_PLANS_DEMO_MESSAGE.firstParagraph, '¡Gracias por tu interés en formar parte de Experiencia SV!')
  assert.equal(
    BUSINESS_PLANS_DEMO_MESSAGE.secondParagraph,
    'Esta es una demostración de nuestros planes comerciales. Próximamente podrás registrar tu negocio y contratar el plan que mejor se adapte a tus necesidades.',
  )
})
