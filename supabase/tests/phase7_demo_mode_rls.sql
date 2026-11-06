-- Pruebas del interruptor de demostración de la Fase 7.
--
-- Uso recomendado (solo base local o de desarrollo, NUNCA producción):
--   supabase db reset
--   psql "$DATABASE_URL" -f supabase/tests/phase7_demo_mode_rls.sql
--
-- El archivo abre una transacción y termina con ROLLBACK. No deja usuarios,
-- planes, itinerarios ni cambios en app_settings.

\set ON_ERROR_STOP on
\echo 'Phase 7: probando el modo demostración y el trigger de itinerarios...'

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
values (
  '00000000-0000-0000-0000-000000000000',
  '33333333-3333-4333-8333-333333333333',
  'authenticated',
  'authenticated',
  'demo-usuario@example.test',
  'no-es-un-hash-real',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Usuario Demo"}'::jsonb,
  now(),
  now()
);

insert into public.usage_records (
  user_id,
  plan_id,
  period_start,
  period_end,
  used
)
values (
  '33333333-3333-4333-8333-333333333333',
  'explorador',
  date_trunc('month', now() at time zone 'UTC') at time zone 'UTC',
  date_trunc('month', now() at time zone 'UTC') at time zone 'UTC' + interval '1 month',
  0
);

-- ---------------------------------------------------------------------------
-- Con demo=false el plan Explorador sigue limitando a 2 itinerarios
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

insert into public.itineraries (user_id, title, preferences, stops)
values
  (
    '33333333-3333-4333-8333-333333333333',
    'Itinerario comercial 1',
    '{}'::jsonb,
    '[{"order":1,"placeId":"osm-node-1","name":"Lugar"}]'::jsonb
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'Itinerario comercial 2',
    '{}'::jsonb,
    '[{"order":1,"placeId":"osm-node-2","name":"Lugar"}]'::jsonb
  );

do $$
begin
  begin
    insert into public.itineraries (user_id, title, preferences, stops)
    values (
      '33333333-3333-4333-8333-333333333333',
      'Itinerario comercial 3',
      '{}'::jsonb,
      '[{"order":1,"placeId":"osm-node-3","name":"Lugar"}]'::jsonb
    );
    raise exception 'El trigger no aplicó el límite comercial con demo=false';
  exception when others then
    if sqlerrm not like 'PLAN_LIMIT_ITINERARIES:%' then
      raise;
    end if;
  end;
end;
$$;

\echo '  ✓ demo=false conserva el límite comercial de 2 itinerarios'

-- ---------------------------------------------------------------------------
-- El cliente no puede leer app_settings ni activar la demostración
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    perform 1 from public.app_settings limit 1;
    raise exception 'Un usuario autenticado pudo leer app_settings';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.set_demo_mode(true);
    raise exception 'Un usuario autenticado pudo activar el modo demostración';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

\echo '  ✓ app_settings y set_demo_mode están reservados a service_role'

-- ---------------------------------------------------------------------------
-- Con demo=true el trigger deja guardar sin límite de plan
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;
select public.set_demo_mode(true);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

insert into public.itineraries (user_id, title, preferences, stops)
values (
  '33333333-3333-4333-8333-333333333333',
  'Itinerario durante la feria',
  '{}'::jsonb,
  '[{"order":1,"placeId":"osm-node-4","name":"Lugar"}]'::jsonb
);

\echo '  ✓ demo=true permite guardar un itinerario adicional'

-- ---------------------------------------------------------------------------
-- Al desactivar demo el límite comercial vuelve a aplicarse
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;
select public.set_demo_mode(false);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

do $$
begin
  begin
    insert into public.itineraries (user_id, title, preferences, stops)
    values (
      '33333333-3333-4333-8333-333333333333',
      'Itinerario después de la feria',
      '{}'::jsonb,
      '[{"order":1,"placeId":"osm-node-5","name":"Lugar"}]'::jsonb
    );
    raise exception 'El trigger no recuperó el límite comercial con demo=false';
  exception when others then
    if sqlerrm not like 'PLAN_LIMIT_ITINERARIES:%' then
      raise;
    end if;
  end;
end;
$$;

\echo '  ✓ demo=false recupera inmediatamente el límite comercial'

rollback;
\echo 'Phase 7: pruebas terminadas y revertidas.'
