-- Pruebas de aislamiento RLS y permisos del historial de presupuestos.
--
-- Uso recomendado (solo base local o de desarrollo, NUNCA producción):
--   supabase db reset
--   psql "$DATABASE_URL" -f supabase/tests/phase8_budget_rls.sql
--
-- El archivo abre una transacción y termina con ROLLBACK. No deja usuarios,
-- presupuestos ni cambios de configuración. Las filas se insertan como
-- service_role, igual que lo hace el backend.

\set ON_ERROR_STOP on
\echo 'Phase 8 RLS: probando historial, elementos y configuración de presupuestos...'

begin;

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
    '44444444-4444-4444-8444-444444444444',
    'authenticated',
    'authenticated',
    'presupuesto-a@example.test',
    'no-es-un-hash-real',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Presupuesto A"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-4555-8555-555555555555',
    'authenticated',
    'authenticated',
    'presupuesto-b@example.test',
    'no-es-un-hash-real',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Presupuesto B"}'::jsonb,
    now(),
    now()
  );

-- ---------------------------------------------------------------------------
-- El backend inserta un presupuesto de cada usuario y su desglose
-- ---------------------------------------------------------------------------
set local role service_role;

insert into public.budget_estimates (
  id,
  user_id,
  itinerary_title,
  party_size,
  adults,
  children,
  duration_days,
  transport_mode,
  meal_tier,
  lodging_tier,
  include_lodging,
  nights,
  total_min_cents,
  total_max_cents,
  per_person_min_cents,
  per_person_max_cents,
  per_day_min_cents,
  per_day_max_cents,
  distance_meters,
  duration_seconds,
  distance_source
)
values
  (
    'aaaaaaaa-0000-4000-8000-000000000001',
    '44444444-4444-4444-8444-444444444444',
    'Presupuesto de A',
    2,
    2,
    0,
    1,
    'particular',
    'estandar',
    'estandar',
    false,
    0,
    5000,
    6000,
    2500,
    3000,
    2500,
    3000,
    12000,
    1800,
    'osrm'
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000002',
    '55555555-5555-4555-8555-555555555555',
    'Presupuesto de B',
    1,
    1,
    0,
    1,
    'publico',
    'economico',
    'economico',
    false,
    0,
    2000,
    2500,
    2000,
    2500,
    2000,
    2500,
    8000,
    1200,
    'haversine-estimate'
  );

insert into public.budget_estimate_items (
  estimate_id,
  category,
  label,
  min_cents,
  max_cents,
  verified,
  verification,
  source,
  notes,
  sort_order
)
values
  (
    'aaaaaaaa-0000-4000-8000-000000000001',
    'transport',
    'Transporte',
    1500,
    1800,
    false,
    'estimated',
    'Tarifas de referencia',
    '[]'::jsonb,
    0
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000002',
    'transport',
    'Transporte público',
    800,
    900,
    false,
    'estimated',
    'Tarifas de referencia',
    '[]'::jsonb,
    0
  );

reset role;

-- ---------------------------------------------------------------------------
-- Cada usuario autenticado solo ve su propio presupuesto y sus elementos
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '44444444-4444-4444-8444-444444444444',
  true
);

do $$
declare
  v_estimates integer;
  v_items integer;
begin
  select count(*) into v_estimates from public.budget_estimates;
  if v_estimates <> 1 then
    raise exception 'El usuario A vio % presupuestos en lugar de 1', v_estimates;
  end if;

  select count(*) into v_items from public.budget_estimate_items;
  if v_items <> 1 then
    raise exception 'El usuario A vio % elementos en lugar de 1', v_items;
  end if;

  if not exists (
    select 1
    from public.budget_estimates
    where id = 'aaaaaaaa-0000-4000-8000-000000000001'
      and user_id = '44444444-4444-4444-8444-444444444444'
  ) then
    raise exception 'El usuario A no pudo leer su propio presupuesto';
  end if;

  if exists (
    select 1
    from public.budget_estimates
    where user_id = '55555555-5555-4555-8555-555555555555'
  ) then
    raise exception 'El usuario A pudo leer el presupuesto de B';
  end if;
end;
$$;

\echo '  ✓ cada usuario solo lee sus propios presupuestos y elementos'

-- ---------------------------------------------------------------------------
-- El cliente no puede escribir presupuestos ni leer/escribir configuración
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    insert into public.budget_estimates (
      user_id,
      party_size,
      adults,
      children,
      duration_days,
      transport_mode,
      meal_tier,
      lodging_tier,
      include_lodging,
      nights,
      total_min_cents,
      total_max_cents,
      per_person_min_cents,
      per_person_max_cents,
      per_day_min_cents,
      per_day_max_cents
    )
    values (
      '44444444-4444-4444-8444-444444444444',
      1,
      1,
      0,
      1,
      'particular',
      'estandar',
      'estandar',
      false,
      0,
      100,
      200,
      100,
      200,
      100,
      200
    );
    raise exception 'Un usuario autenticado pudo insertar un presupuesto';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.budget_estimates
    set total_min_cents = total_min_cents + 1;
    raise exception 'Un usuario autenticado pudo modificar un presupuesto';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform 1 from public.budget_settings limit 1;
    raise exception 'Un usuario autenticado pudo leer budget_settings';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform 1 from public.budget_entrance_prices limit 1;
    raise exception 'Un usuario autenticado pudo leer budget_entrance_prices';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.budget_settings set fuel_price_per_liter_cents = 999;
    raise exception 'Un usuario autenticado pudo modificar budget_settings';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

\echo '  ✓ presupuestos de solo lectura y configuración privada del backend'

reset role;
rollback;
\echo 'Phase 8 RLS: pruebas terminadas y revertidas.'
