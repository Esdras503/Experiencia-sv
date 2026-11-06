import test from 'node:test'
import assert from 'node:assert/strict'
import {
  COMPARISON_ROWS,
  PLANS,
  PLAN_IDS,
  formatCents,
  getCheckoutHref,
  getPlan,
  isPaidPlan,
} from './plans.js'

test('el catálogo muestra los precios y límites acordados', () => {
  const explorer = getPlan(PLAN_IDS.EXPLORER)
  const pro = getPlan(PLAN_IDS.PRO)
  const elite = getPlan(PLAN_IDS.ELITE)
  const pass = getPlan(PLAN_IDS.PASS)

  assert.equal(explorer.price, '$0.00')
  assert.equal(explorer.aiQueryLimit, 10)
  assert.equal(explorer.savedItineraryLimit, 2)

  assert.equal(pro.price, '$7.99')
  assert.equal(pro.priceCents, 799)
  assert.equal(pro.aiQueryLimit, 200)

  assert.equal(elite.price, '$14.99')
  assert.equal(elite.priceCents, 1499)
  assert.equal(elite.aiQueryLimit, 600)

  assert.equal(pass.price, '$3.99')
  assert.equal(pass.priceCents, 399)
  assert.equal(pass.aiQueryLimit, 50)
  assert.equal(pass.durationDays, 7)
  assert.equal(pass.billingType, 'pass')
})

test('cada plan tiene una tarjeta, características y llamada a la acción', () => {
  assert.equal(PLANS.length, 4)
  for (const plan of PLANS) {
    assert.ok(plan.name)
    assert.ok(plan.description)
    assert.ok(plan.features.length >= 5)
    assert.ok(plan.cta)
    assert.equal(typeof plan.recommended, 'boolean')
  }
  assert.equal(PLANS.filter((plan) => plan.recommended).length, 1)
  assert.equal(PLANS.find((plan) => plan.recommended).id, PLAN_IDS.PRO)
})

test('la comparativa incluye consultas, itinerarios y funciones de pago', () => {
  const labels = COMPARISON_ROWS.map((row) => row.label)
  assert.ok(labels.includes('Consultas de IA'))
  assert.ok(labels.includes('Itinerarios guardados'))
  assert.ok(labels.includes('Exportación a PDF'))
  assert.ok(labels.includes('Soporte prioritario'))
  for (const row of COMPARISON_ROWS) {
    for (const key of ['explorador', 'pro', 'elite', 'pass']) {
      assert.equal(typeof row[key], 'string')
    }
  }
})

test('las suscripciones y el pase llevan al flujo de contratación', () => {
  assert.equal(getCheckoutHref(PLAN_IDS.PRO), '/planes/contratar?plan=pro')
  assert.equal(getCheckoutHref(PLAN_IDS.ELITE), '/planes/contratar?plan=elite')
  assert.equal(
    getCheckoutHref(PLAN_IDS.PASS),
    '/planes/contratar?plan=pase-7-dias',
  )
  assert.equal(getCheckoutHref(PLAN_IDS.EXPLORER), '/planes')
  assert.equal(isPaidPlan(PLAN_IDS.EXPLORER), false)
  assert.equal(isPaidPlan(PLAN_IDS.PRO), true)
  assert.equal(isPaidPlan(PLAN_IDS.PASS), true)
})

test('los importes se formatean sin inventar decimales', () => {
  assert.equal(formatCents(0), '$0.00')
  assert.equal(formatCents(799), '$7.99')
  assert.equal(formatCents(1499), '$14.99')
  assert.equal(formatCents(399), '$3.99')
  assert.equal(formatCents(-1), '$0.00')
})
