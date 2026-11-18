import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_BUDGET_SETTINGS } from '../shared/budget.js'

const migration = readFileSync(
  join(
    import.meta.dirname,
    'migrations',
    '20261117000000_phase8_budget_estimates.sql',
  ),
  'utf8',
).toLowerCase()

test('la fase 8 crea tarifas, catálogo, estimaciones y desglose', () => {
  assert.match(migration, /create table if not exists public\.budget_settings/)
  assert.match(migration, /create table if not exists public\.budget_entrance_prices/)
  assert.match(migration, /create table if not exists public\.budget_estimates/)
  assert.match(migration, /create table if not exists public\.budget_estimate_items/)
  assert.match(
    migration,
    /estimate_id uuid not null references public\.budget_estimates \(id\) on delete cascade/,
  )
  assert.match(
    migration,
    /itinerary_id uuid references public\.itineraries \(id\) on delete set null/,
  )
})

test('budget_settings es una sola fila con los valores iniciales de shared/budget.js', () => {
  assert.match(migration, /constraint budget_settings_single_row check \(id = 1\)/)
  assert.match(
    migration,
    new RegExp(
      `fuel_price_per_liter_cents integer not null default ${DEFAULT_BUDGET_SETTINGS.fuelPricePerLiterCents}`,
    ),
  )
  assert.match(
    migration,
    new RegExp(
      `vehicle_consumption_liters_per_100km numeric\\(6, 2\\) not null default ${DEFAULT_BUDGET_SETTINGS.vehicleConsumptionLitersPer100Km.toFixed(2)}`,
    ),
  )
  assert.match(
    migration,
    new RegExp(
      `meal_estandar_lunch_cents integer not null default ${DEFAULT_BUDGET_SETTINGS.mealTiers.estandar.lunchCents}`,
    ),
  )
  assert.match(
    migration,
    new RegExp(
      `lodging_estandar_per_person_night_cents integer not null default ${DEFAULT_BUDGET_SETTINGS.lodgingPerPersonNightCents.estandar}`,
    ),
  )
  assert.match(migration, /insert into public\.budget_settings[\s\S]*?values \(1\)/)
})

test('el catálogo exige fuente y fecha para precios verificados', () => {
  assert.match(migration, /verification_status text not null default 'unverified'/)
  assert.match(migration, /source text,/)
  assert.match(migration, /verified_at date,/)
  assert.match(
    migration,
    /constraint budget_entrance_prices_verified_data check \([\s\S]*?verification_status <> 'verified'[\s\S]*?source is not null and verified_at is not null/,
  )
  assert.match(migration, /adult_cents integer/)
  assert.match(migration, /child_cents integer/)
  assert.match(migration, /group_cents integer/)
  assert.match(migration, /activity_cents integer/)
})

test('las estimaciones guardan totales, rangos, supuestos y una copia de tarifas', () => {
  assert.match(migration, /total_min_cents bigint not null/)
  assert.match(migration, /total_max_cents bigint not null/)
  assert.match(migration, /per_person_min_cents bigint not null/)
  assert.match(migration, /per_day_max_cents bigint not null/)
  assert.match(migration, /assumptions jsonb not null default '\[\]'::jsonb/)
  assert.match(migration, /warnings jsonb not null default '\[\]'::jsonb/)
  assert.match(migration, /pricing_snapshot jsonb not null default '\{\}'::jsonb/)
  assert.match(
    migration,
    /constraint budget_estimates_totals check \([\s\S]*?total_max_cents >= total_min_cents/,
  )
})

test('las tablas tienen índices para historial, catálogo y desglose', () => {
  assert.match(
    migration,
    /create index if not exists budget_estimates_user_created_idx[\s\S]*?\(user_id, created_at desc\)/,
  )
  assert.match(
    migration,
    /create index if not exists budget_estimates_itinerary_idx[\s\S]*?\(itinerary_id\)/,
  )
  assert.match(
    migration,
    /create unique index if not exists budget_entrance_prices_place_id_idx[\s\S]*?where place_id is not null/,
  )
  assert.match(
    migration,
    /create index if not exists budget_estimate_items_estimate_idx[\s\S]*?\(estimate_id, sort_order\)/,
  )
})

test('RLS deja leer solo presupuestos propios y bloquea la configuración', () => {
  assert.match(migration, /alter table public\.budget_settings enable row level security/)
  assert.match(migration, /alter table public\.budget_entrance_prices enable row level security/)
  assert.match(migration, /alter table public\.budget_estimates enable row level security/)
  assert.match(migration, /alter table public\.budget_estimate_items enable row level security/)

  assert.match(migration, /revoke all on table public\.budget_settings from anon/)
  assert.match(migration, /revoke all on table public\.budget_settings from authenticated/)
  assert.match(migration, /revoke all on table public\.budget_entrance_prices from anon/)
  assert.match(migration, /revoke all on table public\.budget_entrance_prices from authenticated/)
  assert.doesNotMatch(
    migration,
    /grant[^;]*on table public\.budget_settings[^;]*to (anon|authenticated)/,
  )
  assert.doesNotMatch(
    migration,
    /grant[^;]*on table public\.budget_entrance_prices[^;]*to (anon|authenticated)/,
  )

  assert.match(
    migration,
    /create policy budget_estimates_select_own[\s\S]*?for select[\s\S]*?to authenticated[\s\S]*?using \(\(select auth\.uid\(\)\) = user_id\)/,
  )
  assert.match(
    migration,
    /create policy budget_estimate_items_select_own[\s\S]*?for select[\s\S]*?to authenticated[\s\S]*?exists \([\s\S]*?e\.user_id = \(select auth\.uid\(\)\)/,
  )
  assert.doesNotMatch(
    migration,
    /create policy[^;]*for (insert|update|delete)/,
  )
})

test('service_role recibe escritura explícita y el trigger actualiza updated_at', () => {
  assert.match(
    migration,
    /grant select, insert, update, delete on table public\.budget_settings to service_role/,
  )
  assert.match(
    migration,
    /grant select, insert, update, delete on table public\.budget_estimates to service_role/,
  )
  assert.match(
    migration,
    /create trigger budget_settings_set_updated_at[\s\S]*?before update on public\.budget_settings/,
  )
  assert.match(
    migration,
    /create trigger budget_entrance_prices_set_updated_at[\s\S]*?before update on public\.budget_entrance_prices/,
  )
})

test('la prueba SQL de la fase 8 usa dos usuarios, transacción y rollback', () => {
  const sql = readFileSync(
    join(import.meta.dirname, 'tests', 'phase8_budget_rls.sql'),
    'utf8',
  ).toLowerCase()

  assert.match(sql, /\bbegin;/)
  assert.match(sql, /\brollback;/)
  assert.match(sql, /presupuesto-a@example\.test/)
  assert.match(sql, /presupuesto-b@example\.test/)
  assert.match(sql, /from public\.budget_estimates/)
  assert.match(sql, /from public\.budget_estimate_items/)
  assert.match(sql, /from public\.budget_settings/)
  assert.match(sql, /from public\.budget_entrance_prices/)
})
