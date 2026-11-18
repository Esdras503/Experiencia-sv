-- Fase 8: presupuestos estimados.
--
-- Este esquema separa tres conceptos:
--   1. Tarifas configurables (budget_settings) y catálogo de entradas.
--   2. Estimaciones calculadas por el backend (budget_estimates).
--   3. Desglose por categoría (budget_estimate_items).
--
-- Los importes se guardan en centavos enteros. El navegador nunca escribe
-- tarifas ni estimaciones: las escrituras usan service_role desde el API y la
-- autorización de administrador vive en variables de entorno del servidor.
--
-- Los valores iniciales de budget_settings deben coincidir con
-- shared/budget.js. Si se cambian allí, actualiza también esta migración.

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

-- ---------------------------------------------------------------------------
-- Configuración de tarifas
-- ---------------------------------------------------------------------------

create table if not exists public.budget_settings (
  id smallint primary key default 1,
  currency text not null default 'USD',
  fuel_price_per_liter_cents integer not null default 105,
  vehicle_consumption_liters_per_100km numeric(6, 2) not null default 8.50,
  fuel_safety_margin_percent numeric(5, 2) not null default 10.00,
  parking_per_day_cents integer not null default 300,
  tolls_per_day_cents integer not null default 0,
  public_transport_per_km_per_person_cents numeric(10, 2) not null default 4.00,
  public_transport_min_per_leg_cents integer not null default 30,
  average_speed_kmh numeric(5, 2) not null default 45.00,
  road_factor numeric(5, 2) not null default 1.25,
  meal_economico_breakfast_cents integer not null default 250,
  meal_economico_lunch_cents integer not null default 400,
  meal_economico_dinner_cents integer not null default 350,
  meal_economico_snack_cents integer not null default 150,
  meal_estandar_breakfast_cents integer not null default 400,
  meal_estandar_lunch_cents integer not null default 700,
  meal_estandar_dinner_cents integer not null default 600,
  meal_estandar_snack_cents integer not null default 200,
  meal_premium_breakfast_cents integer not null default 700,
  meal_premium_lunch_cents integer not null default 1400,
  meal_premium_dinner_cents integer not null default 1200,
  meal_premium_snack_cents integer not null default 300,
  lodging_economico_per_person_night_cents integer not null default 1800,
  lodging_estandar_per_person_night_cents integer not null default 3500,
  lodging_premium_per_person_night_cents integer not null default 7000,
  activity_allowance_per_person_per_day_cents integer not null default 500,
  unverified_entrance_min_per_person_cents integer not null default 0,
  unverified_entrance_max_per_person_cents integer not null default 1000,
  extras_percent numeric(5, 2) not null default 10.00,
  estimate_range_percent numeric(5, 2) not null default 10.00,
  updated_at timestamptz not null default now(),
  constraint budget_settings_single_row check (id = 1),
  constraint budget_settings_currency check (currency ~ '^[A-Z]{3}$'),
  constraint budget_settings_fuel_price check (fuel_price_per_liter_cents >= 0),
  constraint budget_settings_consumption check (
    vehicle_consumption_liters_per_100km between 1 and 50
  ),
  constraint budget_settings_fuel_margin check (
    fuel_safety_margin_percent between 0 and 100
  ),
  constraint budget_settings_parking check (parking_per_day_cents >= 0),
  constraint budget_settings_tolls check (tolls_per_day_cents >= 0),
  constraint budget_settings_public_rate check (
    public_transport_per_km_per_person_cents >= 0
  ),
  constraint budget_settings_public_min check (
    public_transport_min_per_leg_cents >= 0
  ),
  constraint budget_settings_speed check (average_speed_kmh between 5 and 120),
  constraint budget_settings_road_factor check (road_factor between 1 and 2),
  constraint budget_settings_meal_prices check (
    meal_economico_breakfast_cents >= 0
    and meal_economico_lunch_cents >= 0
    and meal_economico_dinner_cents >= 0
    and meal_economico_snack_cents >= 0
    and meal_estandar_breakfast_cents >= 0
    and meal_estandar_lunch_cents >= 0
    and meal_estandar_dinner_cents >= 0
    and meal_estandar_snack_cents >= 0
    and meal_premium_breakfast_cents >= 0
    and meal_premium_lunch_cents >= 0
    and meal_premium_dinner_cents >= 0
    and meal_premium_snack_cents >= 0
  ),
  constraint budget_settings_lodging_prices check (
    lodging_economico_per_person_night_cents >= 0
    and lodging_estandar_per_person_night_cents >= 0
    and lodging_premium_per_person_night_cents >= 0
  ),
  constraint budget_settings_activity_allowance check (
    activity_allowance_per_person_per_day_cents >= 0
  ),
  constraint budget_settings_unverified_entrance check (
    unverified_entrance_min_per_person_cents >= 0
    and unverified_entrance_max_per_person_cents >= 0
    and unverified_entrance_max_per_person_cents >= unverified_entrance_min_per_person_cents
  ),
  constraint budget_settings_extras check (extras_percent between 0 and 50),
  constraint budget_settings_range check (estimate_range_percent between 0 and 50)
);

insert into public.budget_settings (id)
values (1)
on conflict (id) do nothing;

comment on table public.budget_settings is
  'Tarifas editables para el cálculo de presupuestos. Solo el backend con service_role las modifica.';
comment on column public.budget_settings.fuel_price_per_liter_cents is
  'Precio de referencia del combustible en centavos por litro.';
comment on column public.budget_settings.vehicle_consumption_liters_per_100km is
  'Consumo de referencia en litros por 100 km.';
comment on column public.budget_settings.estimate_range_percent is
  'Margen aplicado a los costos estimados para formar el rango mínimo/máximo.';

drop trigger if exists budget_settings_set_updated_at on public.budget_settings;
create trigger budget_settings_set_updated_at
before update on public.budget_settings
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Catálogo de entradas y actividades
-- ---------------------------------------------------------------------------

create table if not exists public.budget_entrance_prices (
  id uuid primary key default gen_random_uuid(),
  place_id text,
  name text not null,
  category text,
  adult_cents integer,
  child_cents integer,
  group_cents integer,
  group_min_people integer,
  activity_cents integer,
  currency text not null default 'USD',
  source text,
  verified_at date,
  verification_status text not null default 'unverified',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_entrance_prices_name_length check (
    char_length(btrim(name)) between 1 and 160
  ),
  constraint budget_entrance_prices_place_id check (
    place_id is null or place_id ~ '^osm-(node|way|relation)-[0-9]{1,15}$'
  ),
  constraint budget_entrance_prices_category_length check (
    category is null or char_length(btrim(category)) between 1 and 80
  ),
  constraint budget_entrance_prices_currency check (currency ~ '^[A-Z]{3}$'),
  constraint budget_entrance_prices_status check (
    verification_status in ('verified', 'estimated', 'unverified')
  ),
  constraint budget_entrance_prices_prices check (
    (adult_cents is null or adult_cents >= 0)
    and (child_cents is null or child_cents >= 0)
    and (group_cents is null or group_cents >= 0)
    and (activity_cents is null or activity_cents >= 0)
  ),
  constraint budget_entrance_prices_group_min check (
    group_min_people is null or group_min_people between 1 and 50
  ),
  constraint budget_entrance_prices_source_length check (
    source is null or char_length(btrim(source)) between 1 and 300
  ),
  constraint budget_entrance_prices_notes_length check (
    notes is null or char_length(notes) <= 500
  ),
  constraint budget_entrance_prices_verified_data check (
    verification_status <> 'verified'
    or (source is not null and verified_at is not null)
  )
);

create unique index if not exists budget_entrance_prices_place_id_idx
on public.budget_entrance_prices (place_id)
where place_id is not null;

create index if not exists budget_entrance_prices_name_idx
on public.budget_entrance_prices (lower(name));

comment on table public.budget_entrance_prices is
  'Precios de entrada y actividades por lugar. Un precio no verificado se muestra como estimado o pendiente, nunca como confirmado.';
comment on column public.budget_entrance_prices.verification_status is
  'verified requiere fuente y fecha; estimated usa un precio base no confirmado; unverified no tiene precio.';

drop trigger if exists budget_entrance_prices_set_updated_at
on public.budget_entrance_prices;
create trigger budget_entrance_prices_set_updated_at
before update on public.budget_entrance_prices
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Estimaciones e historial
-- ---------------------------------------------------------------------------

create table if not exists public.budget_estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  itinerary_id uuid references public.itineraries (id) on delete set null,
  itinerary_title text,
  party_size integer not null,
  adults integer not null,
  children integer not null default 0,
  duration_days integer not null,
  transport_mode text not null,
  meal_tier text not null,
  lodging_tier text not null,
  include_lodging boolean not null default false,
  nights integer not null default 0,
  currency text not null default 'USD',
  total_min_cents bigint not null,
  total_max_cents bigint not null,
  per_person_min_cents bigint not null,
  per_person_max_cents bigint not null,
  per_day_min_cents bigint not null,
  per_day_max_cents bigint not null,
  distance_meters bigint,
  duration_seconds bigint,
  distance_source text,
  options jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  pricing_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint budget_estimates_party check (
    party_size between 1 and 50
    and adults between 0 and 50
    and children between 0 and 50
    and adults + children = party_size
  ),
  constraint budget_estimates_duration check (duration_days between 1 and 60),
  constraint budget_estimates_nights check (
    nights between 0 and 60
    and (
      (include_lodging = true and nights between 1 and 60)
      or (include_lodging = false and nights = 0)
    )
  ),
  constraint budget_estimates_transport check (
    transport_mode in ('particular', 'publico')
  ),
  constraint budget_estimates_meal check (
    meal_tier in ('economico', 'estandar', 'premium')
  ),
  constraint budget_estimates_lodging check (
    lodging_tier in ('economico', 'estandar', 'premium')
  ),
  constraint budget_estimates_currency check (currency ~ '^[A-Z]{3}$'),
  constraint budget_estimates_totals check (
    total_min_cents >= 0
    and total_max_cents >= total_min_cents
    and per_person_min_cents >= 0
    and per_person_max_cents >= per_person_min_cents
    and per_day_min_cents >= 0
    and per_day_max_cents >= per_day_min_cents
  ),
  constraint budget_estimates_distance check (
    (distance_meters is null or distance_meters >= 0)
    and (duration_seconds is null or duration_seconds >= 0)
  )
);

create index if not exists budget_estimates_user_created_idx
on public.budget_estimates (user_id, created_at desc);

create index if not exists budget_estimates_itinerary_idx
on public.budget_estimates (itinerary_id);

comment on table public.budget_estimates is
  'Historial de presupuestos calculados por el backend. Cada usuario solo puede leer sus filas.';
comment on column public.budget_estimates.pricing_snapshot is
  'Copia de las tarifas usadas para poder auditar un cálculo histórico.';

create table if not exists public.budget_estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.budget_estimates (id) on delete cascade,
  category text not null,
  label text not null,
  min_cents bigint not null,
  max_cents bigint not null,
  verified boolean not null default false,
  verification text not null default 'estimated',
  source text,
  notes jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint budget_estimate_items_category check (
    category in ('transport', 'meals', 'admissions', 'activities', 'lodging', 'extras')
  ),
  constraint budget_estimate_items_label check (
    char_length(btrim(label)) between 1 and 120
  ),
  constraint budget_estimate_items_totals check (
    min_cents >= 0 and max_cents >= min_cents
  ),
  constraint budget_estimate_items_verification check (
    verification in ('verified', 'estimated', 'unverified', 'mixed')
  ),
  constraint budget_estimate_items_sort check (sort_order >= 0)
);

create index if not exists budget_estimate_items_estimate_idx
on public.budget_estimate_items (estimate_id, sort_order);

comment on table public.budget_estimate_items is
  'Desglose por categoría de cada presupuesto. Se lee junto con budget_estimates.';

-- ---------------------------------------------------------------------------
-- Row Level Security y privilegios
-- ---------------------------------------------------------------------------

alter table public.budget_settings enable row level security;
alter table public.budget_entrance_prices enable row level security;
alter table public.budget_estimates enable row level security;
alter table public.budget_estimate_items enable row level security;

-- La configuración y el catálogo no se leen ni escriben desde el navegador.
revoke all on table public.budget_settings from anon;
revoke all on table public.budget_settings from authenticated;
revoke all on table public.budget_entrance_prices from anon;
revoke all on table public.budget_entrance_prices from authenticated;

-- Los presupuestos históricos sí se leen, pero solo los propios.
revoke all on table public.budget_estimates from anon;
revoke all on table public.budget_estimates from authenticated;
grant select on table public.budget_estimates to authenticated;

revoke all on table public.budget_estimate_items from anon;
revoke all on table public.budget_estimate_items from authenticated;
grant select on table public.budget_estimate_items to authenticated;

grant select, insert, update, delete on table public.budget_settings to service_role;
grant select, insert, update, delete on table public.budget_entrance_prices to service_role;
grant select, insert, update, delete on table public.budget_estimates to service_role;
grant select, insert, update, delete on table public.budget_estimate_items to service_role;

drop policy if exists budget_estimates_select_own on public.budget_estimates;
create policy budget_estimates_select_own
on public.budget_estimates
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists budget_estimate_items_select_own on public.budget_estimate_items;
create policy budget_estimate_items_select_own
on public.budget_estimate_items
for select
to authenticated
using (
  exists (
    select 1
    from public.budget_estimates e
    where e.id = estimate_id
      and e.user_id = (select auth.uid())
  )
);

-- No hay políticas de inserción, actualización o borrado para clientes:
-- service_role es el único rol que escribe estimaciones y configuración.
