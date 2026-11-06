import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync(
  join(import.meta.dirname, 'migrations', '20261105000000_phase7_demo_mode.sql'),
  'utf8',
).toLowerCase()

test('la fase 7 crea un indicador global de demostración de una sola fila', () => {
  assert.match(migration, /create table if not exists public\.app_settings/)
  assert.match(migration, /demo_mode boolean not null default false/)
  assert.match(migration, /constraint app_settings_single_row check \(id = 1\)/)
  assert.match(migration, /insert into public\.app_settings[\s\S]*?values \(1, false, now\(\)\)/)
})

test('app_settings queda aislado: RLS, sin permisos de cliente y service_role explícito', () => {
  assert.match(migration, /alter table public\.app_settings enable row level security/)
  assert.match(migration, /revoke all on table public\.app_settings from anon/)
  assert.match(migration, /revoke all on table public\.app_settings from authenticated/)
  assert.match(migration, /grant select, insert, update on table public\.app_settings to service_role/)
  assert.doesNotMatch(
    migration,
    /grant[^;]*on table public\.app_settings[^;]*to (anon|authenticated)/,
  )
})

test('el cambio de modo solo lo puede hacer el backend', () => {
  assert.match(migration, /create or replace function public\.set_demo_mode\(p_enabled boolean\)/)
  assert.match(migration, /security definer/)
  assert.match(migration, /grant execute on function public\.set_demo_mode\(boolean\) to service_role/)
  assert.match(migration, /revoke all on function public\.set_demo_mode\(boolean\) from anon/)
  assert.match(migration, /revoke all on function public\.set_demo_mode\(boolean\) from authenticated/)
})

test('el trigger de itinerarios sigue aplicando el plan comercial cuando demo=false', () => {
  assert.match(migration, /create or replace function public\.enforce_itinerary_plan_limit\(\)/)
  assert.match(migration, /if public\.demo_mode_enabled\(\) then\s+return new;/)
  assert.match(migration, /if v_count >= v_period\.saved_itinerary_limit then/)
  assert.match(migration, /message = 'plan_limit_itineraries:' \|\| v_period\.saved_itinerary_limit/)
  assert.match(migration, /create trigger itineraries_enforce_plan_limit/)
})

test('la prueba SQL de demostración usa una transacción y revierte los cambios', () => {
  const sql = readFileSync(
    join(import.meta.dirname, 'tests', 'phase7_demo_mode_rls.sql'),
    'utf8',
  ).toLowerCase()

  assert.match(sql, /\bbegin;/)
  assert.match(sql, /\brollback;/)
  assert.match(sql, /set_demo_mode\(true\)/)
  assert.match(sql, /set_demo_mode\(false\)/)
  assert.match(sql, /plan_limit_itineraries/)
})
