-- Fase 7: indicador persistente del modo demostración.
--
-- El backend sincroniza este valor con service_role al arrancar el servicio de
-- facturación. El trigger de itinerarios lo consulta para no aplicar el límite
-- comercial mientras la demostración está activa. Al desactivar la
-- demostración, el backend vuelve a escribir false y el trigger recupera su
-- comportamiento normal.
--
-- Esta migración no relaja RLS ni permite que el navegador cambie el valor.

create table if not exists public.app_settings (
  id smallint primary key default 1,
  demo_mode boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint app_settings_single_row check (id = 1)
);

insert into public.app_settings (id, demo_mode, updated_at)
values (1, false, now())
on conflict (id) do nothing;

comment on table public.app_settings is
  'Configuración global controlada por el backend. app_settings.demo_mode lo consulta el trigger de itinerarios.';
comment on column public.app_settings.demo_mode is
  'true solo durante una demostración o feria; el backend lo sincroniza con VITE_DEMO_MODE.';

alter table public.app_settings enable row level security;

revoke all on table public.app_settings from public;
revoke all on table public.app_settings from anon;
revoke all on table public.app_settings from authenticated;
grant select, insert, update on table public.app_settings to service_role;

create or replace function public.demo_mode_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select demo_mode from public.app_settings where id = 1),
    false
  );
$$;

comment on function public.demo_mode_enabled() is
  'Devuelve el indicador global de demostración sin exponer app_settings al cliente.';

revoke all on function public.demo_mode_enabled() from public;
revoke all on function public.demo_mode_enabled() from anon;
revoke all on function public.demo_mode_enabled() from authenticated;
grant execute on function public.demo_mode_enabled() to service_role;

create or replace function public.set_demo_mode(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_settings (id, demo_mode, updated_at)
  values (1, coalesce(p_enabled, false), now())
  on conflict (id) do update
    set demo_mode = excluded.demo_mode,
        updated_at = excluded.updated_at;

  return coalesce(p_enabled, false);
end;
$$;

comment on function public.set_demo_mode(boolean) is
  'Activa o desactiva el modo demostración global. Solo el backend con service_role puede llamarla.';

revoke all on function public.set_demo_mode(boolean) from public;
revoke all on function public.set_demo_mode(boolean) from anon;
revoke all on function public.set_demo_mode(boolean) from authenticated;
grant execute on function public.set_demo_mode(boolean) to service_role;

-- Reemplaza el trigger de la Fase 6 conservando exactamente la validación de
-- propietario, el bloqueo por usuario y el límite comercial cuando demo=false.
create or replace function public.enforce_itinerary_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period record;
  v_count integer;
begin
  -- Las inserciones con service_role (por ejemplo, una migración) no llevan
  -- auth.uid(). Las inserciones del navegador siempre llevan el JWT del
  -- propietario y RLS exige que coincida con new.user_id.
  if new.user_id is null or (select auth.uid()) is distinct from new.user_id then
    return new;
  end if;

  -- Durante una feria no se aplican límites de itinerarios. El indicador solo
  -- puede cambiarlo el backend; RLS sigue protegiendo cada fila.
  if public.demo_mode_enabled() then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('itineraries:' || new.user_id::text, 0));

  select * into v_period
  from public.effective_billing_period(new.user_id, now());

  if v_period.saved_itinerary_limit is not null then
    select count(*)
    into v_count
    from public.itineraries
    where user_id = new.user_id;

    if v_count >= v_period.saved_itinerary_limit then
      raise exception using
        errcode = 'P0001',
        message = 'PLAN_LIMIT_ITINERARIES:' || v_period.saved_itinerary_limit;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_itinerary_plan_limit() is
  'Aplica el máximo de itinerarios del plan efectivo, salvo durante el modo demostración.';

revoke all on function public.enforce_itinerary_plan_limit() from public;
revoke all on function public.enforce_itinerary_plan_limit() from anon;
revoke all on function public.enforce_itinerary_plan_limit() from authenticated;

drop trigger if exists itineraries_enforce_plan_limit on public.itineraries;
create trigger itineraries_enforce_plan_limit
before insert on public.itineraries
for each row
execute function public.enforce_itinerary_plan_limit();
