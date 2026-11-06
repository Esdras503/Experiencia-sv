import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync(
  join(import.meta.dirname, 'migrations', '20261026000000_phase6_plans_monetization.sql'),
  'utf8',
).toLowerCase()

test('la migración siembra los cuatro planes con precios y límites exactos', () => {
  assert.match(migration, /'explorador'[\s\S]*?10,[\s\S]*?2,/)
  assert.match(migration, /'pro'[\s\S]*?799,/)
  assert.match(migration, /'elite'[\s\S]*?1499,/)
  assert.match(migration, /'pase-7-dias'[\s\S]*?399,/)
  assert.match(migration, /'pase-7-dias'[\s\S]*?7,[\s\S]*?50,/)
  assert.match(migration, /constraint trip_passes_seven_days/)
  assert.match(migration, /interval '7 days'/)
})

test('RLS está activo y el cliente solo puede leer datos propios', () => {
  for (const table of [
    'plans',
    'user_subscriptions',
    'trip_passes',
    'usage_records',
    'usage_events',
    'payment_events',
    'bookings',
    'booking_commissions',
  ]) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security;`),
    )
  }
  assert.doesNotMatch(migration, /disable row level security/)

  assert.match(migration, /create policy user_subscriptions_select_own/)
  assert.match(migration, /create policy trip_passes_select_own/)
  assert.match(migration, /create policy usage_records_select_own/)
  assert.match(migration, /using \(\(select auth\.uid\(\)\) = user_id\)/)

  assert.doesNotMatch(migration, /create policy .*subscriptions.*for (insert|update|delete)/)
  assert.doesNotMatch(migration, /create policy .*trip_passes.*for (insert|update|delete)/)
  assert.doesNotMatch(migration, /create policy .*usage_records.*for (insert|update|delete)/)
  assert.doesNotMatch(migration, /create policy .*payment_events/)
})

test('las tablas sensibles no se exponen a anon y el backend escribe con service_role', () => {
  assert.match(migration, /revoke all on table public\.user_subscriptions from anon, authenticated;/)
  assert.match(migration, /revoke all on table public\.usage_events from anon, authenticated;/)
  assert.match(migration, /revoke all on table public\.payment_events from anon, authenticated;/)
  assert.match(migration, /grant select on table public\.plans to anon, authenticated;/)
  assert.match(migration, /grant select, insert, update, delete on table public\.user_subscriptions to service_role;/)
  assert.match(migration, /grant select, insert, update, delete on table public\.usage_events to service_role;/)
})

test('la cuota se reserva de forma atómica e idempotente', () => {
  assert.match(migration, /create or replace function public\.reserve_ai_query/)
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(migration, /request_id uuid not null unique/)
  assert.match(migration, /status in \('reserved', 'consumed', 'refunded'\)/)
  assert.match(migration, /create or replace function public\.release_ai_query/)
  assert.match(migration, /create or replace function public\.commit_ai_query/)
  assert.match(migration, /revoke all on function public\.reserve_ai_query[\s\S]*?from authenticated/)
  assert.match(migration, /grant execute on function public\.reserve_ai_query[\s\S]*?to service_role/)
})

test('el plan Explorador limita los itinerarios también fuera del navegador', () => {
  assert.match(migration, /create or replace function public\.enforce_itinerary_plan_limit/)
  assert.match(migration, /create trigger itineraries_enforce_plan_limit/)
  assert.match(migration, /before insert on public\.itineraries/)
  assert.match(migration, /plan_limit_itineraries:/)
  assert.match(migration, /effective_billing_period\(new\.user_id, now\(\)\)/)
})

test('pagos y comisiones por reservas están separados de las suscripciones', () => {
  assert.match(migration, /create table if not exists public\.payment_events/)
  assert.match(migration, /create table if not exists public\.bookings/)
  assert.match(migration, /create table if not exists public\.booking_commissions/)
  assert.match(migration, /unique \(provider, provider_event_id\)/)
  assert.match(migration, /booking_id uuid not null unique references public\.bookings/)
  assert.match(migration, /no hay integración de reservas activa/i)
})

test('la prueba SQL de la fase 6 usa dos usuarios y revierte los cambios', () => {
  const rlsTest = readFileSync(
    join(import.meta.dirname, 'tests', 'phase6_plans_rls.sql'),
    'utf8',
  ).toLowerCase()
  assert.match(rlsTest, /11111111-1111-4111-8111-111111111111/)
  assert.match(rlsTest, /22222222-2222-4222-8222-222222222222/)
  assert.match(rlsTest, /begin;/)
  assert.match(rlsTest, /rollback;/)
  assert.match(rlsTest, /set local role authenticated/)
  assert.match(rlsTest, /no puede leer el plan del otro usuario/)
  assert.match(rlsTest, /límite de itinerarios/)
  assert.match(rlsTest, /reserve_ai_query/)
})
