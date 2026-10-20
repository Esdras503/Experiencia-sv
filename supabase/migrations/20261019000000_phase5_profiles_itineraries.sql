-- Experiencia SV — Fase 5
-- Perfiles, itinerarios guardados, triggers de mantenimiento y Row Level Security.
--
-- Esta migración está pensada para aplicarse con Supabase CLI:
--   supabase link --project-ref <ref>
--   supabase db push
--
-- No incluye datos de prueba ni credenciales. No desactiva RLS.

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Actualiza updated_at antes de cada modificación.';

-- ---------------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length
    check (display_name is null or char_length(btrim(display_name)) between 1 and 80)
);

comment on table public.profiles is
  'Perfil público mínimo de cada usuario. El correo se gestiona solo en auth.users.';
comment on column public.profiles.id is
  'Mismo UUID que auth.users.id.';
comment on column public.profiles.display_name is
  'Nombre visible elegido por la persona; no se duplica el correo.';

-- Crea el perfil al registrar un usuario. Si el perfil no se puede crear, el
-- registro no se bloquea: la aplicación puede reintentar la creación del perfil
-- con la política de inserción del propio usuario.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
  safe_name text;
begin
  requested_name := nullif(
    btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')),
    ''
  );
  safe_name := left(requested_name, 80);

  insert into public.profiles (id, display_name)
  values (new.id, safe_name)
  on conflict (id) do nothing;

  return new;
exception
  when others then
    -- No se registra el correo ni el identificador. El alta continúa y la
    -- interfaz puede crear el perfil más adelante.
    raise warning 'No se pudo crear automáticamente un perfil: %', sqlerrm;
    return new;
end;
$$;

comment on function public.handle_new_user() is
  'Crea el perfil después del alta en auth.users sin bloquear el registro si falla.';

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Itinerarios guardados
-- ---------------------------------------------------------------------------

create table if not exists public.itineraries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  title text not null,
  description text,
  start_date date,
  duration_days integer,
  party_size integer,
  budget_amount numeric(12, 2),
  budget_currency text,
  preferences jsonb not null default '{}'::jsonb,
  stops jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint itineraries_title_length
    check (char_length(btrim(title)) between 1 and 120),
  constraint itineraries_description_length
    check (description is null or char_length(btrim(description)) between 1 and 2000),
  constraint itineraries_start_date_range
    check (start_date is null or start_date between date '1900-01-01' and date '2100-12-31'),
  constraint itineraries_duration_days_range
    check (duration_days is null or duration_days between 1 and 60),
  constraint itineraries_party_size_range
    check (party_size is null or party_size between 1 and 50),
  constraint itineraries_budget_amount_range
    check (budget_amount is null or budget_amount between 0 and 100000000),
  constraint itineraries_budget_currency_iso
    check (budget_currency is null or budget_currency ~ '^[A-Z]{3}$'),
  constraint itineraries_budget_complete
    check (
      (budget_amount is null and budget_currency is null)
      or (budget_amount is not null and budget_currency is not null)
    ),
  constraint itineraries_preferences_object
    check (jsonb_typeof(preferences) = 'object'),
  constraint itineraries_stops_array
    check (
      jsonb_typeof(stops) = 'array'
      and jsonb_array_length(stops) between 1 and 20
    )
);

comment on table public.itineraries is
  'Itinerarios creados por una persona. RLS limita cada fila a su propietario.';
comment on column public.itineraries.user_id is
  'Propietario. La política INSERT exige auth.uid() = user_id.';
comment on column public.itineraries.budget_amount is
  'Importe declarado por la persona, no un precio verificado. El alcance (total o por persona) se guarda en preferences.budgetScope.';
comment on column public.itineraries.budget_currency is
  'Código ISO 4217 de tres letras mayúsculas. USD por defecto en la interfaz.';
comment on column public.itineraries.preferences is
  'Preferencias y metadatos no sensibles del plan: origen, alcance del presupuesto, notas, advertencias y fuente.';
comment on column public.itineraries.stops is
  'Paradas ordenadas con identificadores OSM y una instantánea de los campos permitidos. No se guardan fotos, reseñas ni calificaciones.';

create index if not exists itineraries_user_updated_idx
  on public.itineraries (user_id, updated_at desc);

create index if not exists itineraries_user_created_idx
  on public.itineraries (user_id, created_at desc);

drop trigger if exists itineraries_set_updated_at on public.itineraries;
create trigger itineraries_set_updated_at
before update on public.itineraries
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.itineraries enable row level security;

-- Perfiles: solo el propio. No hay lectura pública de perfiles.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Itinerarios: CRUD exclusivamente del propietario. La condición se aplica
-- tanto a la fila existente (USING) como a la fila resultante (WITH CHECK).
drop policy if exists itineraries_select_own on public.itineraries;
create policy itineraries_select_own
on public.itineraries
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists itineraries_insert_own on public.itineraries;
create policy itineraries_insert_own
on public.itineraries
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists itineraries_update_own on public.itineraries;
create policy itineraries_update_own
on public.itineraries
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists itineraries_delete_own on public.itineraries;
create policy itineraries_delete_own
on public.itineraries
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Privilegios mínimos
-- ---------------------------------------------------------------------------
-- RLS es la protección principal, pero además se retiran los privilegios de
-- tabla que no necesita cada rol. El rol service_role no se usa en la app.

revoke all on table public.profiles from anon;
revoke all on table public.itineraries from anon;

revoke all on table public.profiles from authenticated;
revoke all on table public.itineraries from authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.itineraries to authenticated;

revoke all on function public.handle_new_user() from public;
revoke all on function public.set_updated_at() from public;
