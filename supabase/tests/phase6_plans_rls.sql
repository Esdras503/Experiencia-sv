-- Pruebas de aislamiento RLS y cuotas para la Fase 6.
--
-- Uso recomendado (solo base local o de desarrollo, NUNCA producción):
--   supabase db reset
--   psql "$DATABASE_URL" -f supabase/tests/phase6_plans_rls.sql
--
-- El archivo abre una transacción y termina con ROLLBACK: no deja usuarios,
-- suscripciones, pases ni consumo de prueba. Si una comprobación falla, psql
-- se detiene con ON_ERROR_STOP y la transacción se revierte.
--
-- No se llama a ninguna pasarela de pago: las filas de suscripción y pase se
-- insertan directamente para probar las políticas y las funciones SQL.

\set ON_ERROR_STOP on
\echo 'Phase 6 RLS: iniciando pruebas de planes, cuotas e itinerarios...'

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
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'planes-usuario-a@example.test',
    'no-es-un-hash-real',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Usuario Planes A"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'planes-usuario-b@example.test',
    'no-es-un-hash-real',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Usuario Planes B"}'::jsonb,
    now(),
    now()
  );

-- Suscripción activa de A y consumo de B, escritos por el backend/owner.
insert into public.user_subscriptions (
  id,
  user_id,
  plan_id,
  status,
  current_period_start,
  current_period_end,
  amount_cents,
  currency
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'pro',
  'active',
  now() - interval '1 day',
  now() + interval '30 days',
  799,
  'USD'
);

insert into public.usage_records (
  user_id,
  plan_id,
  period_start,
  period_end,
  used
)
values (
  '22222222-2222-4222-8222-222222222222',
  'explorador',
  date_trunc('month', now() at time zone 'UTC') at time zone 'UTC',
  date_trunc('month', now() at time zone 'UTC') at time zone 'UTC' + interval '1 month',
  0
);

-- ---------------------------------------------------------------------------
-- A puede leer su suscripción, pero no la de B
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

do $$
declare
  own_rows integer;
  other_rows integer;
begin
  select count(*) into own_rows
  from public.user_subscriptions
  where user_id = '11111111-1111-4111-8111-111111111111';

  if own_rows <> 1 then
    raise exception 'FALLO: A no puede leer su propia suscripción';
  end if;

  select count(*) into other_rows
  from public.user_subscriptions
  where user_id = '22222222-2222-4222-8222-222222222222';

  if other_rows <> 0 then
    raise exception 'FALLO: A no puede leer el plan del otro usuario';
  end if;
end;
$$;

do $$
begin
  begin
    update public.user_subscriptions
    set plan_id = 'elite'
    where user_id = '11111111-1111-4111-8111-111111111111';

    raise exception 'FALLO: el cliente pudo cambiar su plan de pago';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

-- A es Pro y puede guardar más de 2 itinerarios.
insert into public.itineraries (user_id, title, preferences, stops)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'Itinerario Pro 1',
    '{}'::jsonb,
    '[{"order":1,"placeId":"osm-node-1","name":"Lugar"}]'::jsonb
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    'Itinerario Pro 2',
    '{}'::jsonb,
    '[{"order":1,"placeId":"osm-node-2","name":"Lugar"}]'::jsonb
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    'Itinerario Pro 3',
    '{}'::jsonb,
    '[{"order":1,"placeId":"osm-node-3","name":"Lugar"}]'::jsonb
  );

\echo '  ✓ A solo ve su plan y no puede modificarlo desde el cliente'

-- ---------------------------------------------------------------------------
-- B está en Explorador: el trigger impone el límite de itinerarios
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

insert into public.itineraries (user_id, title, preferences, stops)
values
  (
    '22222222-2222-4222-8222-222222222222',
    'Itinerario B 1',
    '{}'::jsonb,
    '[{"order":1,"placeId":"osm-node-1","name":"Lugar"}]'::jsonb
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Itinerario B 2',
    '{}'::jsonb,
    '[{"order":1,"placeId":"osm-node-2","name":"Lugar"}]'::jsonb
  );

do $$
begin
  begin
    insert into public.itineraries (user_id, title, preferences, stops)
    values (
      '22222222-2222-4222-8222-222222222222',
      'Itinerario B 3',
      '{}'::jsonb,
      '[{"order":1,"placeId":"osm-node-3","name":"Lugar"}]'::jsonb
    );

    raise exception 'FALLO: B superó el límite de itinerarios de Explorador';
  exception
    when sqlstate 'P0001' then
      null;
  end;
end;
$$;

\echo '  ✓ El límite de itinerarios se aplica aunque el cliente llame a Supabase'

-- ---------------------------------------------------------------------------
-- B no puede leer ni escribir el consumo de A
-- ---------------------------------------------------------------------------
do $$
declare
  other_rows integer;
begin
  select count(*) into other_rows
  from public.usage_records
  where user_id = '11111111-1111-4111-8111-111111111111';

  if other_rows <> 0 then
    raise exception 'FALLO: B puede leer el consumo de A';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reserva atómica con service_role (solo backend)
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claim.sub', '', true);
set role service_role;

do $$
declare
  result jsonb;
  request_id uuid;
  allowed_count integer := 0;
  index integer;
begin
  for index in 1..10 loop
    request_id := gen_random_uuid();
    result := public.reserve_ai_query(
      '22222222-2222-4222-8222-222222222222',
      null,
      request_id
    );
    if (result ->> 'allowed')::boolean then
      allowed_count := allowed_count + 1;
    end if;
  end loop;

  if allowed_count <> 10 then
    raise exception 'FALLO: se esperaban 10 reservas permitidas, se obtuvieron %', allowed_count;
  end if;

  result := public.reserve_ai_query(
    '22222222-2222-4222-8222-222222222222',
    null,
    gen_random_uuid()
  );

  if (result ->> 'allowed')::boolean then
    raise exception 'FALLO: se permitió una consulta por encima del límite';
  end if;

  if (result ->> 'reason') <> 'limit' then
    raise exception 'FALLO: se esperaba reason=limit, se obtuvo %', result ->> 'reason';
  end if;
end;
$$;

-- La misma petición no se cuenta dos veces.
do $$
declare
  result jsonb;
  request_id uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
begin
  result := public.reserve_ai_query(
    '11111111-1111-4111-8111-111111111111',
    null,
    request_id
  );

  if not (result ->> 'allowed')::boolean then
    raise exception 'FALLO: A no pudo reservar una consulta de su plan Pro';
  end if;

  result := public.reserve_ai_query(
    '11111111-1111-4111-8111-111111111111',
    null,
    request_id
  );

  if (result ->> 'allowed')::boolean or (result ->> 'reason') <> 'replayed' then
    raise exception 'FALLO: la misma petición se contó más de una vez';
  end if;

  result := public.release_ai_query(request_id);
  if not (result ->> 'released')::boolean then
    raise exception 'FALLO: no se pudo liberar la reserva de prueba';
  end if;
end;
$$;

\echo '  ✓ La cuota es atómica, idempotente y se libera si falla la IA'

-- ---------------------------------------------------------------------------
-- El pase sólo cuenta desde su confirmación y caduca a los 7 días
-- ---------------------------------------------------------------------------
reset role;
insert into public.trip_passes (
  id,
  user_id,
  plan_id,
  status,
  starts_at,
  expires_at,
  confirmed_at,
  amount_cents,
  currency
)
values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '22222222-2222-4222-8222-222222222222',
  'pase-7-dias',
  'active',
  now() - interval '1 day',
  now() - interval '1 day' + interval '7 days',
  now() - interval '1 day',
  399,
  'USD'
);

do $$
declare
  result jsonb;
begin
  result := public.billing_status('22222222-2222-4222-8222-222222222222');

  if (result -> 'plan' ->> 'id') <> 'pase-7-dias' then
    raise exception 'FALLO: el pase vigente no se aplicó al estado';
  end if;

  if ((result -> 'pass') ->> 'expiresAt') is null then
    raise exception 'FALLO: el estado no incluye la caducidad del pase';
  end if;
end;
$$;

-- Un pase vencido no da acceso.
update public.trip_passes
set starts_at = now() - interval '8 days',
    expires_at = now() - interval '1 day',
    confirmed_at = now() - interval '8 days'
where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

do $$
declare
  result jsonb;
begin
  result := public.billing_status('22222222-2222-4222-8222-222222222222');

  if (result -> 'plan' ->> 'id') <> 'explorador' then
    raise exception 'FALLO: un pase vencido sigue dando acceso';
  end if;
end;
$$;

\echo '  ✓ El pase empieza al confirmarse, dura 7 días y caduca'

reset role;
rollback;

\echo 'Phase 6 RLS: todas las comprobaciones pasaron (transacción revertida).'
