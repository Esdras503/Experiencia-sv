-- Pruebas de aislamiento RLS para la Fase 5.
--
-- Uso recomendado (solo base local o de desarrollo, NUNCA producción):
--   supabase db reset
--   psql "$(supabase status -o env | Select-String 'DB_URL' ...)" -f supabase/tests/phase5_rls.sql
--
-- El archivo abre una transacción y termina con ROLLBACK: no deja usuarios ni
-- itinerarios de prueba. Si alguna comprobación falla, psql se detiene con
-- ON_ERROR_STOP y la transacción se revierte al cerrar la conexión.
--
-- Comprueba con dos usuarios reales de auth.users que PostgreSQL (no la UI)
-- deniega la lectura, actualización, eliminación y suplantación de propietario.

\set ON_ERROR_STOP on
\echo 'Phase 5 RLS: iniciando pruebas de aislamiento entre dos usuarios...'

begin;

-- Usuarios de prueba. El trigger on_auth_user_created crea sus perfiles.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'rls-usuario-a@example.test',
    'no-es-un-hash-real',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Usuario RLS A"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'rls-usuario-b@example.test',
    'no-es-un-hash-real',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Usuario RLS B"}'::jsonb,
    now(),
    now()
  );

do $$
declare
  profile_count integer;
begin
  select count(*) into profile_count
  from public.profiles
  where id in (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  );

  if profile_count <> 2 then
    raise exception 'FALLO: el trigger no creó los dos perfiles esperados (encontrados: %)', profile_count;
  end if;
end;
$$;

\echo '  ✓ Los perfiles se crean automáticamente'

-- ---------------------------------------------------------------------------
-- Usuario A
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

do $$
declare
  visible_profiles integer;
  own_profile_updates integer;
begin
  select count(*) into visible_profiles
  from public.profiles
  where id = '22222222-2222-4222-8222-222222222222';

  if visible_profiles <> 0 then
    raise exception 'FALLO: A puede leer el perfil de B';
  end if;

  update public.profiles
  set display_name = 'Intento de cambio ajeno'
  where id = '22222222-2222-4222-8222-222222222222';
  get diagnostics own_profile_updates = row_count;

  if own_profile_updates <> 0 then
    raise exception 'FALLO: A puede actualizar el perfil de B';
  end if;
end;
$$;

insert into public.itineraries (
  id,
  user_id,
  title,
  description,
  start_date,
  duration_days,
  party_size,
  budget_amount,
  budget_currency,
  preferences,
  stops
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'Plan privado de A',
  'Itinerario de prueba de RLS',
  '2026-11-01',
  2,
  2,
  100.00,
  'USD',
  '{"budgetScope":"total"}'::jsonb,
  '[{"order":1,"placeId":"osm-node-9357298883","name":"Lugar real de prueba"}]'::jsonb
);

do $$
declare
  own_rows integer;
begin
  select count(*) into own_rows
  from public.itineraries
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  if own_rows <> 1 then
    raise exception 'FALLO: A no puede leer su propio itinerario';
  end if;
end;
$$;

update public.itineraries
set title = 'Plan privado de A (editado)'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

\echo '  ✓ A puede crear, leer y actualizar su itinerario'

-- ---------------------------------------------------------------------------
-- Usuario B
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

do $$
declare
  visible_rows integer;
  updated_rows integer;
  deleted_rows integer;
begin
  select count(*) into visible_rows
  from public.itineraries
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  if visible_rows <> 0 then
    raise exception 'FALLO: B puede leer el itinerario privado de A';
  end if;

  update public.itineraries
  set title = 'Intento de B'
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics updated_rows = row_count;

  if updated_rows <> 0 then
    raise exception 'FALLO: B puede actualizar el itinerario de A';
  end if;

  delete from public.itineraries
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics deleted_rows = row_count;

  if deleted_rows <> 0 then
    raise exception 'FALLO: B puede eliminar el itinerario de A';
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.itineraries (
      id,
      user_id,
      title,
      preferences,
      stops
    )
    values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '11111111-1111-4111-8111-111111111111',
      'Suplantación de A',
      '{}'::jsonb,
      '[{"order":1,"placeId":"osm-node-9357298883","name":"Lugar real de prueba"}]'::jsonb
    );

    raise exception 'FALLO: B pudo crear un itinerario a nombre de A';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

\echo '  ✓ B no puede leer, actualizar, eliminar ni suplantar a A'

reset role;
rollback;

\echo 'Phase 5 RLS: todas las comprobaciones pasaron (transacción revertida).'
