import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync(
  join(import.meta.dirname, 'migrations', '20261019000000_phase5_profiles_itineraries.sql'),
  'utf8',
).toLowerCase()

const rlsTest = readFileSync(
  join(import.meta.dirname, 'tests', 'phase5_rls.sql'),
  'utf8',
).toLowerCase()

test('la migración activa RLS en perfiles e itinerarios', () => {
  assert.match(migration, /alter table public\.profiles enable row level security;/)
  assert.match(migration, /alter table public\.itineraries enable row level security;/)
  assert.doesNotMatch(migration, /disable row level security/)
})

test('cada operación de itinerarios tiene una política del propietario', () => {
  for (const operation of ['select', 'insert', 'update', 'delete']) {
    assert.match(
      migration,
      new RegExp(
        `create policy itineraries_${operation}_own[\\s\\S]*?for ${operation}[\\s\\S]*?to authenticated[\\s\\S]*?user_id`,
      ),
    )
  }
  assert.match(migration, /with check \(\(select auth\.uid\(\)\) = user_id\)/)
  assert.match(migration, /using \(\(select auth\.uid\(\)\) = user_id\)/)
})

test('los perfiles solo se leen y editan por su propio usuario', () => {
  for (const operation of ['select', 'insert', 'update']) {
    assert.match(
      migration,
      new RegExp(
        `create policy profiles_${operation}_own[\\s\\S]*?for ${operation}[\\s\\S]*?to authenticated`,
      ),
    )
  }
  assert.match(migration, /using \(\(select auth\.uid\(\)\) = id\)/)
  assert.match(migration, /with check \(\(select auth\.uid\(\)\) = id\)/)
})

test('la migración no deja permisos para anon', () => {
  assert.match(migration, /revoke all on table public\.profiles from anon;/)
  assert.match(migration, /revoke all on table public\.itineraries from anon;/)
  assert.match(migration, /grant select, insert, update, delete on table public\.itineraries to authenticated;/)
})

test('el perfil se crea desde auth.users sin bloquear el alta', () => {
  assert.match(migration, /after insert on auth\.users/)
  assert.match(migration, /security definer/)
  assert.match(migration, /on conflict \(id\) do nothing/)
  assert.match(migration, /exception[\s\S]*?return new;/)
})

test('la tabla incluye límites numéricos, relaciones e índices', () => {
  assert.match(migration, /references auth\.users \(id\) on delete cascade/)
  assert.match(migration, /duration_days between 1 and 60/)
  assert.match(migration, /party_size between 1 and 50/)
  assert.match(migration, /budget_amount between 0 and 100000000/)
  assert.match(migration, /budget_currency ~ '\^\[a-z\]\{3\}\$'/)
  assert.match(migration, /jsonb_array_length\(stops\) between 1 and 20/)
  assert.match(migration, /itineraries_user_updated_idx/)
})

test('la prueba SQL usa dos usuarios y revierte todo al terminar', () => {
  assert.match(rlsTest, /11111111-1111-4111-8111-111111111111/)
  assert.match(rlsTest, /22222222-2222-4222-8222-222222222222/)
  assert.match(rlsTest, /rollback;/)
  assert.match(rlsTest, /set local role authenticated/)
  assert.match(rlsTest, /no puede leer el itinerario privado de a|b puede leer el itinerario privado de a/)
  assert.match(rlsTest, /suplantación de a/)
})
