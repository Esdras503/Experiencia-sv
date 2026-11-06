-- Experiencia SV — Fase 6
-- Planes, suscripciones, pase turístico, consumo de IA y preparación de
-- comisiones por reservas.
--
-- Esta migración está pensada para aplicarse con Supabase CLI:
--   supabase link --project-ref <ref>
--   supabase db push
--
-- No incluye credenciales, datos de prueba ni pagos simulados. Las tablas de
-- pago y consumo solo se escriben desde el backend con service_role; el
-- navegador únicamente puede leer la información del propio usuario.
--
-- La fuente de verdad de los límites es public.plans. Los precios visibles en
-- la interfaz están en shared/plans.js y deben coincidir con esta semilla.

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

-- public.set_updated_at() ya existe desde la Fase 5. Se conserva para que esta
-- migración pueda aplicarse de forma independiente en una base nueva.
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
-- Catálogo de planes
-- ---------------------------------------------------------------------------

create table if not exists public.plans (
  id text primary key,
  name text not null,
  description text,
  billing_type text not null,
  price_cents integer not null default 0,
  currency text not null default 'USD',
  duration_days integer,
  ai_query_limit integer not null,
  saved_itinerary_limit integer,
  features jsonb not null default '[]'::jsonb,
  recommended boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint plans_billing_type
    check (billing_type in ('free', 'monthly', 'pass')),
  constraint plans_price_nonnegative check (price_cents >= 0),
  constraint plans_currency_iso check (currency ~ '^[A-Z]{3}$'),
  constraint plans_ai_limit_positive check (ai_query_limit > 0),
  constraint plans_saved_limit_nonnegative
    check (saved_itinerary_limit is null or saved_itinerary_limit >= 0),
  constraint plans_duration_positive
    check (duration_days is null or duration_days > 0),
  constraint plans_pass_duration
    check (billing_type <> 'pass' or duration_days = 7),
  constraint plans_free_price
    check (billing_type <> 'free' or price_cents = 0),
  constraint plans_features_array
    check (jsonb_typeof(features) = 'array')
);

comment on table public.plans is
  'Catálogo comercial. Los límites se aplican en el backend y la semilla debe coincidir con shared/plans.js.';
comment on column public.plans.ai_query_limit is
  'Consultas de IA incluidas por período. No incluye llamadas internas a OpenStreetMap.';
comment on column public.plans.saved_itinerary_limit is
  'Máximo de itinerarios guardados. NULL significa que el plan no impone un límite propio.';
comment on column public.plans.duration_days is
  'Duración de un pase de un solo pago; NULL para planes gratuitos o mensuales.';

insert into public.plans (
  id,
  name,
  description,
  billing_type,
  price_cents,
  currency,
  duration_days,
  ai_query_limit,
  saved_itinerary_limit,
  features,
  recommended,
  is_active,
  sort_order
)
values
  (
    'explorador',
    'Explorador',
    'Descubre El Salvador y prueba el asistente sin pagar.',
    'free',
    0,
    'USD',
    null,
    10,
    2,
    jsonb_build_array(
      'Exploración de lugares turísticos',
      'Filtros de búsqueda y visualización en el mapa',
      'Hasta 2 itinerarios guardados',
      'Hasta 10 consultas de inteligencia artificial al mes',
      'Información turística básica'
    ),
    false,
    true,
    10
  ),
  (
    'pro',
    'Experiencia Pro',
    'Planificación personalizada para viajes de uno o varios días.',
    'monthly',
    799,
    'USD',
    null,
    200,
    null,
    jsonb_build_array(
      'Hasta 200 consultas de inteligencia artificial al mes',
      'Creación de itinerarios personalizados',
      'Guardado y organización de itinerarios',
      'Planificación según presupuesto',
      'Optimización de rutas',
      'Exportación de itinerarios a PDF',
      'Planificación de viajes de varios días',
      'Modificación de itinerarios mediante el chatbot'
    ),
    true,
    true,
    20
  ),
  (
    'elite',
    'Experiencia Élite',
    'Más capacidad para grupos, comparaciones y viajes largos.',
    'monthly',
    1499,
    'USD',
    null,
    600,
    null,
    jsonb_build_array(
      'Todas las funcionalidades de Experiencia Pro',
      'Hasta 600 consultas de inteligencia artificial al mes',
      'Planificación avanzada para grupos',
      'Comparación de itinerarios',
      'Alternativas de actividades y destinos según la información disponible',
      'Herramientas avanzadas para rutas',
      'Soporte prioritario cuando exista un canal de soporte disponible'
    ),
    false,
    true,
    30
  ),
  (
    'pase-7-dias',
    'Pase turístico de 7 días',
    'Acceso temporal para un viaje puntual a El Salvador.',
    'pass',
    399,
    'USD',
    7,
    50,
    null,
    jsonb_build_array(
      'Acceso durante 7 días desde la confirmación del pago',
      'Hasta 50 consultas de inteligencia artificial durante la vigencia',
      'Creación de itinerarios turísticos',
      'Guardado y modificación de itinerarios',
      'Acceso a mapas y herramientas de rutas disponibles',
      'Exportación de itinerarios'
    ),
    false,
    true,
    40
  )
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  billing_type = excluded.billing_type,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  duration_days = excluded.duration_days,
  ai_query_limit = excluded.ai_query_limit,
  saved_itinerary_limit = excluded.saved_itinerary_limit,
  features = excluded.features,
  recommended = excluded.recommended,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
before update on public.plans
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Suscripciones mensuales
-- ---------------------------------------------------------------------------

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null references public.plans (id) on delete restrict,
  status text not null default 'pending',
  provider text,
  provider_subscription_id text,
  provider_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  amount_cents integer,
  currency text not null default 'USD',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_subscriptions_plan
    check (plan_id in ('pro', 'elite')),
  constraint user_subscriptions_status
    check (status in ('pending', 'active', 'past_due', 'canceled', 'expired')),
  constraint user_subscriptions_amount_nonnegative
    check (amount_cents is null or amount_cents >= 0),
  constraint user_subscriptions_currency_iso
    check (currency ~ '^[A-Z]{3}$'),
  constraint user_subscriptions_dates
    check (
      current_period_start is null
      or current_period_end is null
      or current_period_end > current_period_start
    ),
  constraint user_subscriptions_active_dates
    check (
      status <> 'active'
      or (current_period_start is not null and current_period_end is not null)
    ),
  constraint user_subscriptions_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

comment on table public.user_subscriptions is
  'Suscripciones mensuales. Una fila activa por usuario; las altas y cambios se hacen solo desde el backend seguro.';

create index if not exists user_subscriptions_user_status_idx
  on public.user_subscriptions (user_id, status, current_period_end desc);

create unique index if not exists user_subscriptions_one_active_idx
  on public.user_subscriptions (user_id)
  where status = 'active';

create unique index if not exists user_subscriptions_provider_idx
  on public.user_subscriptions (provider, provider_subscription_id)
  where provider is not null and provider_subscription_id is not null;

drop trigger if exists user_subscriptions_set_updated_at on public.user_subscriptions;
create trigger user_subscriptions_set_updated_at
before update on public.user_subscriptions
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Pase turístico de 7 días
-- ---------------------------------------------------------------------------

create table if not exists public.trip_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null references public.plans (id) on delete restrict,
  status text not null default 'pending',
  starts_at timestamptz,
  expires_at timestamptz,
  confirmed_at timestamptz,
  provider text,
  provider_payment_id text,
  amount_cents integer,
  currency text not null default 'USD',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trip_passes_plan check (plan_id = 'pase-7-dias'),
  constraint trip_passes_status
    check (status in ('pending', 'active', 'expired', 'refunded', 'failed')),
  constraint trip_passes_amount_nonnegative
    check (amount_cents is null or amount_cents >= 0),
  constraint trip_passes_currency_iso
    check (currency ~ '^[A-Z]{3}$'),
  constraint trip_passes_dates
    check (
      starts_at is null
      or expires_at is null
      or expires_at > starts_at
    ),
  constraint trip_passes_seven_days
    check (
      starts_at is null
      or expires_at is null
      or expires_at = starts_at + interval '7 days'
    ),
  constraint trip_passes_active_dates
    check (
      status <> 'active'
      or (starts_at is not null and expires_at is not null and confirmed_at is not null)
    ),
  constraint trip_passes_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

comment on table public.trip_passes is
  'Compras del pase de 7 días. starts_at y expires_at solo se completan cuando el pago está confirmado.';
comment on column public.trip_passes.starts_at is
  'Inicio de la vigencia. Nunca se rellena al abrir la página o seleccionar el pase.';

create index if not exists trip_passes_user_expiry_idx
  on public.trip_passes (user_id, expires_at desc);

create unique index if not exists trip_passes_provider_payment_idx
  on public.trip_passes (provider, provider_payment_id)
  where provider is not null and provider_payment_id is not null;

drop trigger if exists trip_passes_set_updated_at on public.trip_passes;
create trigger trip_passes_set_updated_at
before update on public.trip_passes
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Consumo de IA
-- ---------------------------------------------------------------------------

create table if not exists public.usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  anonymous_key text,
  plan_id text not null references public.plans (id) on delete restrict,
  period_start timestamptz not null,
  period_end timestamptz not null,
  used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint usage_records_subject_exactly_one
    check (
      (case when user_id is not null then 1 else 0 end)
      + (case when anonymous_key is not null then 1 else 0 end)
      = 1
    ),
  constraint usage_records_anonymous_key_format
    check (anonymous_key is null or anonymous_key ~ '^[a-f0-9]{64}$'),
  constraint usage_records_period
    check (period_end > period_start),
  constraint usage_records_used_nonnegative check (used >= 0)
);

comment on table public.usage_records is
  'Contador agregado por sujeto, plan y período. Las filas anónimas usan un hash de cookie firmada, no la IP.';

create unique index if not exists usage_records_user_period_idx
  on public.usage_records (user_id, plan_id, period_start, period_end)
  where user_id is not null;

create unique index if not exists usage_records_anonymous_period_idx
  on public.usage_records (anonymous_key, plan_id, period_start, period_end)
  where anonymous_key is not null;

create index if not exists usage_records_user_updated_idx
  on public.usage_records (user_id, updated_at desc);

drop trigger if exists usage_records_set_updated_at on public.usage_records;
create trigger usage_records_set_updated_at
before update on public.usage_records
for each row
execute function public.set_updated_at();

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  user_id uuid references auth.users (id) on delete cascade,
  anonymous_key text,
  plan_id text not null references public.plans (id) on delete restrict,
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'reserved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint usage_events_subject_exactly_one
    check (
      (case when user_id is not null then 1 else 0 end)
      + (case when anonymous_key is not null then 1 else 0 end)
      = 1
    ),
  constraint usage_events_anonymous_key_format
    check (anonymous_key is null or anonymous_key ~ '^[a-f0-9]{64}$'),
  constraint usage_events_status
    check (status in ('reserved', 'consumed', 'refunded')),
  constraint usage_events_period
    check (period_end > period_start)
);

comment on table public.usage_events is
  'Eventos idempotentes de consulta de IA. request_id evita contar dos veces el mismo turno.';

create index if not exists usage_events_user_created_idx
  on public.usage_events (user_id, created_at desc);

create index if not exists usage_events_anonymous_created_idx
  on public.usage_events (anonymous_key, created_at desc);

drop trigger if exists usage_events_set_updated_at on public.usage_events;
create trigger usage_events_set_updated_at
before update on public.usage_events
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Preparación para pagos y comisiones por reservas
-- ---------------------------------------------------------------------------

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text,
  status text not null default 'received',
  user_id uuid references auth.users (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,

  constraint payment_events_status
    check (status in ('received', 'processed', 'ignored', 'failed')),
  constraint payment_events_payload_object
    check (jsonb_typeof(payload) = 'object'),
  constraint payment_events_unique_provider_event
    unique (provider, provider_event_id)
);

comment on table public.payment_events is
  'Registro de webhooks para verificar firmas y evitar procesar dos veces el mismo evento. Aún no hay pasarela conectada.';

-- Estas dos tablas dejan preparada la monetización por reservas sin mezclarla
-- con suscripciones ni con el pase. No hay integración de reservas activa.
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  partner_name text,
  status text not null default 'pending',
  total_amount_cents integer,
  currency text not null default 'USD',
  provider text,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bookings_status
    check (status in ('pending', 'confirmed', 'completed', 'canceled', 'refunded')),
  constraint bookings_total_nonnegative
    check (total_amount_cents is null or total_amount_cents >= 0),
  constraint bookings_currency_iso check (currency ~ '^[A-Z]{3}$'),
  constraint bookings_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists bookings_provider_reference_idx
  on public.bookings (provider, external_reference)
  where provider is not null and external_reference is not null;

create index if not exists bookings_user_created_idx
  on public.bookings (user_id, created_at desc);

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
before update on public.bookings
for each row
execute function public.set_updated_at();

create table if not exists public.booking_commissions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  rate_basis_points integer not null default 0,
  amount_cents integer not null default 0,
  currency text not null default 'USD',
  status text not null default 'pending',
  provider_fee_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint booking_commissions_rate
    check (rate_basis_points between 0 and 10000),
  constraint booking_commissions_amount_nonnegative check (amount_cents >= 0),
  constraint booking_commissions_currency_iso check (currency ~ '^[A-Z]{3}$'),
  constraint booking_commissions_status
    check (status in ('pending', 'earned', 'paid', 'reversed')),
  constraint booking_commissions_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

comment on table public.booking_commissions is
  'Comisión asociada a una reserva identificable. No se muestran ingresos ni comisiones reales mientras no exista una integración.';

drop trigger if exists booking_commissions_set_updated_at on public.booking_commissions;
create trigger booking_commissions_set_updated_at
before update on public.booking_commissions
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Derecho al plan y período vigente
-- ---------------------------------------------------------------------------

create or replace function public.effective_billing_period(
  p_user_id uuid,
  p_at timestamptz default now()
)
returns table (
  plan_id text,
  period_start timestamptz,
  period_end timestamptz,
  ai_query_limit integer,
  saved_itinerary_limit integer
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_subscription record;
  v_pass record;
  v_plan public.plans%rowtype;
  v_month_start timestamptz;
begin
  if p_user_id is not null then
    select
      s.plan_id,
      s.current_period_start,
      s.current_period_end
    into v_subscription
    from public.user_subscriptions s
    where s.user_id = p_user_id
      and s.status = 'active'
      and s.current_period_start <= p_at
      and s.current_period_end > p_at
      and s.plan_id in ('pro', 'elite')
    order by
      case s.plan_id when 'elite' then 2 else 1 end desc,
      s.current_period_end desc
    limit 1;

    if found then
      select * into v_plan
      from public.plans
      where id = v_subscription.plan_id and is_active;

      if found then
        return query
        select
          v_plan.id,
          v_subscription.current_period_start,
          v_subscription.current_period_end,
          v_plan.ai_query_limit,
          v_plan.saved_itinerary_limit;
        return;
      end if;
    end if;

    select
      p.plan_id,
      p.starts_at,
      p.expires_at
    into v_pass
    from public.trip_passes p
    where p.user_id = p_user_id
      and p.status = 'active'
      and p.starts_at <= p_at
      and p.expires_at > p_at
      and p.plan_id = 'pase-7-dias'
    order by p.expires_at desc
    limit 1;

    if found then
      select * into v_plan
      from public.plans
      where id = v_pass.plan_id and is_active;

      if found then
        return query
        select
          v_plan.id,
          v_pass.starts_at,
          v_pass.expires_at,
          v_plan.ai_query_limit,
          v_plan.saved_itinerary_limit;
        return;
      end if;
    end if;
  end if;

  select * into v_plan
  from public.plans
  where id = 'explorador' and is_active;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'PLAN_NOT_CONFIGURED';
  end if;

  -- Período mensual calendario en UTC. Un nuevo período crea una fila nueva
  -- de consumo; no se necesita un cron para reiniciar contadores.
  v_month_start := date_trunc('month', p_at at time zone 'UTC') at time zone 'UTC';

  return query
  select
    v_plan.id,
    v_month_start,
    v_month_start + interval '1 month',
    v_plan.ai_query_limit,
    v_plan.saved_itinerary_limit;
end;
$$;

comment on function public.effective_billing_period(uuid, timestamptz) is
  'Devuelve el plan y período aplicables. Prioriza una suscripción activa, luego un pase vigente y, por último, Explorador.';

revoke all on function public.effective_billing_period(uuid, timestamptz) from public;
revoke all on function public.effective_billing_period(uuid, timestamptz) from anon;
revoke all on function public.effective_billing_period(uuid, timestamptz) from authenticated;
grant execute on function public.effective_billing_period(uuid, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Estado de facturación para el backend
-- ---------------------------------------------------------------------------

create or replace function public.billing_status(
  p_user_id uuid,
  p_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_period record;
  v_plan public.plans%rowtype;
  v_used integer := 0;
  v_saved integer := 0;
  v_subscription jsonb;
  v_pass jsonb;
begin
  if p_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'USER_REQUIRED';
  end if;

  select * into v_period
  from public.effective_billing_period(p_user_id, p_at);

  select * into v_plan
  from public.plans
  where id = v_period.plan_id;

  select coalesce(r.used, 0)
  into v_used
  from public.usage_records r
  where r.user_id = p_user_id
    and r.plan_id = v_period.plan_id
    and r.period_start = v_period.period_start
    and r.period_end = v_period.period_end;

  select count(*)
  into v_saved
  from public.itineraries
  where user_id = p_user_id;

  select jsonb_build_object(
    'planId', s.plan_id,
    'status', s.status,
    'currentPeriodEnd', s.current_period_end,
    'cancelAtPeriodEnd', s.cancel_at_period_end
  )
  into v_subscription
  from public.user_subscriptions s
  where s.user_id = p_user_id
    and s.status = 'active'
    and s.current_period_end > p_at
  order by
    case s.plan_id when 'elite' then 2 else 1 end desc,
    s.current_period_end desc
  limit 1;

  select jsonb_build_object(
    'planId', p.plan_id,
    'status', p.status,
    'startsAt', p.starts_at,
    'expiresAt', p.expires_at
  )
  into v_pass
  from public.trip_passes p
  where p.user_id = p_user_id
    and p.status = 'active'
    and p.starts_at <= p_at
    and p.expires_at > p_at
  order by p.expires_at desc
  limit 1;

  return jsonb_build_object(
    'plan', jsonb_build_object(
      'id', v_plan.id,
      'name', v_plan.name,
      'billingType', v_plan.billing_type,
      'priceCents', v_plan.price_cents,
      'currency', v_plan.currency,
      'durationDays', v_plan.duration_days,
      'aiQueryLimit', v_plan.ai_query_limit,
      'savedItineraryLimit', v_plan.saved_itinerary_limit,
      'recommended', v_plan.recommended
    ),
    'period', jsonb_build_object(
      'start', v_period.period_start,
      'end', v_period.period_end
    ),
    'usage', jsonb_build_object(
      'used', v_used,
      'limit', v_period.ai_query_limit,
      'remaining', greatest(v_period.ai_query_limit - v_used, 0),
      'periodStart', v_period.period_start,
      'periodEnd', v_period.period_end
    ),
    'savedItineraries', v_saved,
    'canSaveItineraries',
      v_period.saved_itinerary_limit is null or v_saved < v_period.saved_itinerary_limit,
    'subscription', v_subscription,
    'pass', v_pass
  );
end;
$$;

comment on function public.billing_status(uuid, timestamptz) is
  'Estado de plan, consumo e itinerarios para el propietario. Solo se llama desde el backend con service_role.';

revoke all on function public.billing_status(uuid, timestamptz) from public;
revoke all on function public.billing_status(uuid, timestamptz) from anon;
revoke all on function public.billing_status(uuid, timestamptz) from authenticated;
grant execute on function public.billing_status(uuid, timestamptz) to service_role;

create or replace function public.anonymous_billing_status(
  p_anonymous_key text,
  p_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_period record;
  v_plan public.plans%rowtype;
  v_used integer := 0;
begin
  if p_anonymous_key is null or p_anonymous_key !~ '^[a-f0-9]{64}$' then
    raise exception using
      errcode = 'P0001',
      message = 'ANONYMOUS_KEY_INVALID';
  end if;

  select * into v_period
  from public.effective_billing_period(null, p_at);

  select * into v_plan
  from public.plans
  where id = v_period.plan_id;

  select coalesce(r.used, 0)
  into v_used
  from public.usage_records r
  where r.anonymous_key = p_anonymous_key
    and r.plan_id = v_period.plan_id
    and r.period_start = v_period.period_start
    and r.period_end = v_period.period_end;

  return jsonb_build_object(
    'plan', jsonb_build_object(
      'id', v_plan.id,
      'name', v_plan.name,
      'billingType', v_plan.billing_type,
      'priceCents', v_plan.price_cents,
      'currency', v_plan.currency,
      'durationDays', v_plan.duration_days,
      'aiQueryLimit', v_plan.ai_query_limit,
      'savedItineraryLimit', v_plan.saved_itinerary_limit,
      'recommended', v_plan.recommended
    ),
    'period', jsonb_build_object(
      'start', v_period.period_start,
      'end', v_period.period_end
    ),
    'usage', jsonb_build_object(
      'used', v_used,
      'limit', v_period.ai_query_limit,
      'remaining', greatest(v_period.ai_query_limit - v_used, 0),
      'periodStart', v_period.period_start,
      'periodEnd', v_period.period_end
    ),
    'savedItineraries', 0,
    'canSaveItineraries', false,
    'subscription', null,
    'pass', null
  );
end;
$$;

revoke all on function public.anonymous_billing_status(text, timestamptz) from public;
revoke all on function public.anonymous_billing_status(text, timestamptz) from anon;
revoke all on function public.anonymous_billing_status(text, timestamptz) from authenticated;
grant execute on function public.anonymous_billing_status(text, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Reserva atómica e idempotente de una consulta de IA
-- ---------------------------------------------------------------------------

create or replace function public.reserve_ai_query(
  p_user_id uuid,
  p_anonymous_key text,
  p_request_id uuid,
  p_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period record;
  v_plan public.plans%rowtype;
  v_event public.usage_events%rowtype;
  v_used integer := 0;
  v_subject_lock text;
begin
  if p_request_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'REQUEST_ID_REQUIRED';
  end if;

  if (case when p_user_id is not null then 1 else 0 end)
     + (case when p_anonymous_key is not null then 1 else 0 end) <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'USAGE_SUBJECT_INVALID';
  end if;

  if p_anonymous_key is not null and p_anonymous_key !~ '^[a-f0-9]{64}$' then
    raise exception using
      errcode = 'P0001',
      message = 'ANONYMOUS_KEY_INVALID';
  end if;

  v_subject_lock := case
    when p_user_id is not null then 'user:' || p_user_id::text
    else 'anon:' || p_anonymous_key
  end;

  perform pg_advisory_xact_lock(hashtextextended(v_subject_lock, 0));

  select * into v_event
  from public.usage_events
  where request_id = p_request_id
  for update;

  if found then
    if v_event.user_id is distinct from p_user_id
       or v_event.anonymous_key is distinct from p_anonymous_key then
      return jsonb_build_object(
        'allowed', false,
        'reason', 'invalid_request',
        'usage', null
      );
    end if;

    if v_event.status = 'consumed' then
      return jsonb_build_object(
        'allowed', false,
        'reason', 'replayed',
        'usage', null
      );
    end if;

    if v_event.status = 'reserved' then
      return jsonb_build_object(
        'allowed', false,
        'reason', 'in_progress',
        'usage', null
      );
    end if;

    -- Un evento liberado puede reintentarse con el mismo request_id. Se borra
    -- y se vuelve a reservar contra el período vigente.
    delete from public.usage_events where id = v_event.id;
  end if;

  select * into v_period
  from public.effective_billing_period(p_user_id, p_at);

  select * into v_plan
  from public.plans
  where id = v_period.plan_id;

  insert into public.usage_records (
    user_id,
    anonymous_key,
    plan_id,
    period_start,
    period_end,
    used
  )
  values (
    p_user_id,
    p_anonymous_key,
    v_period.plan_id,
    v_period.period_start,
    v_period.period_end,
    0
  )
  on conflict do nothing;

  select r.used
  into v_used
  from public.usage_records r
  where r.plan_id = v_period.plan_id
    and r.period_start = v_period.period_start
    and r.period_end = v_period.period_end
    and (
      (p_user_id is not null and r.user_id = p_user_id)
      or (p_user_id is null and r.anonymous_key = p_anonymous_key)
    )
  for update;

  if v_used >= v_period.ai_query_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'limit',
      'plan', jsonb_build_object(
        'id', v_plan.id,
        'name', v_plan.name,
        'aiQueryLimit', v_plan.ai_query_limit
      ),
      'usage', jsonb_build_object(
        'used', v_used,
        'limit', v_period.ai_query_limit,
        'remaining', 0,
        'periodStart', v_period.period_start,
        'periodEnd', v_period.period_end
      )
    );
  end if;

  update public.usage_records
  set used = used + 1
  where plan_id = v_period.plan_id
    and period_start = v_period.period_start
    and period_end = v_period.period_end
    and (
      (p_user_id is not null and user_id = p_user_id)
      or (p_user_id is null and anonymous_key = p_anonymous_key)
    );

  insert into public.usage_events (
    request_id,
    user_id,
    anonymous_key,
    plan_id,
    period_start,
    period_end,
    status
  )
  values (
    p_request_id,
    p_user_id,
    p_anonymous_key,
    v_period.plan_id,
    v_period.period_start,
    v_period.period_end,
    'reserved'
  );

  return jsonb_build_object(
    'allowed', true,
    'reason', null,
    'plan', jsonb_build_object(
      'id', v_plan.id,
      'name', v_plan.name,
      'aiQueryLimit', v_plan.ai_query_limit
    ),
    'usage', jsonb_build_object(
      'used', v_used + 1,
      'limit', v_period.ai_query_limit,
      'remaining', greatest(v_period.ai_query_limit - (v_used + 1), 0),
      'periodStart', v_period.period_start,
      'periodEnd', v_period.period_end
    )
  );
end;
$$;

comment on function public.reserve_ai_query(uuid, text, uuid, timestamptz) is
  'Reserva una consulta de IA de forma atómica. Si el backend no llega a usar la IA, debe llamar a release_ai_query.';

revoke all on function public.reserve_ai_query(uuid, text, uuid, timestamptz) from public;
revoke all on function public.reserve_ai_query(uuid, text, uuid, timestamptz) from anon;
revoke all on function public.reserve_ai_query(uuid, text, uuid, timestamptz) from authenticated;
grant execute on function public.reserve_ai_query(uuid, text, uuid, timestamptz) to service_role;

create or replace function public.commit_ai_query(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.usage_events
  set status = 'consumed'
  where request_id = p_request_id
    and status = 'reserved';

  return jsonb_build_object('committed', found);
end;
$$;

revoke all on function public.commit_ai_query(uuid) from public;
revoke all on function public.commit_ai_query(uuid) from anon;
revoke all on function public.commit_ai_query(uuid) from authenticated;
grant execute on function public.commit_ai_query(uuid) to service_role;

create or replace function public.release_ai_query(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.usage_events%rowtype;
begin
  select * into v_event
  from public.usage_events
  where request_id = p_request_id
  for update;

  if not found or v_event.status <> 'reserved' then
    return jsonb_build_object('released', false);
  end if;

  update public.usage_records
  set used = greatest(used - 1, 0)
  where plan_id = v_event.plan_id
    and period_start = v_event.period_start
    and period_end = v_event.period_end
    and (
      (v_event.user_id is not null and user_id = v_event.user_id)
      or (v_event.user_id is null and anonymous_key = v_event.anonymous_key)
    );

  update public.usage_events
  set status = 'refunded'
  where id = v_event.id;

  return jsonb_build_object('released', true);
end;
$$;

revoke all on function public.release_ai_query(uuid) from public;
revoke all on function public.release_ai_query(uuid) from anon;
revoke all on function public.release_ai_query(uuid) from authenticated;
grant execute on function public.release_ai_query(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Límite de itinerarios del plan Explorador
-- ---------------------------------------------------------------------------

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
  'Aplica el máximo de itinerarios del plan efectivo, incluso si el cliente llama directamente a Supabase.';

revoke all on function public.enforce_itinerary_plan_limit() from public;
revoke all on function public.enforce_itinerary_plan_limit() from anon;
revoke all on function public.enforce_itinerary_plan_limit() from authenticated;

drop trigger if exists itineraries_enforce_plan_limit on public.itineraries;
create trigger itineraries_enforce_plan_limit
before insert on public.itineraries
for each row
execute function public.enforce_itinerary_plan_limit();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.plans enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.trip_passes enable row level security;
alter table public.usage_records enable row level security;
alter table public.usage_events enable row level security;
alter table public.payment_events enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_commissions enable row level security;

-- Catálogo público solo de planes activos.
drop policy if exists plans_select_active on public.plans;
create policy plans_select_active
on public.plans
for select
to anon, authenticated
using (is_active = true);

-- Suscripciones y pases: cada persona solo ve los suyos. No hay políticas de
-- escritura para el cliente; las altas y activaciones son del backend.
drop policy if exists user_subscriptions_select_own on public.user_subscriptions;
create policy user_subscriptions_select_own
on public.user_subscriptions
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists trip_passes_select_own on public.trip_passes;
create policy trip_passes_select_own
on public.trip_passes
for select
to authenticated
using ((select auth.uid()) = user_id);

-- Consumo autenticado. Las filas anónimas no se exponen al cliente.
drop policy if exists usage_records_select_own on public.usage_records;
create policy usage_records_select_own
on public.usage_records
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists bookings_select_own on public.bookings;
create policy bookings_select_own
on public.bookings
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists booking_commissions_select_own on public.booking_commissions;
create policy booking_commissions_select_own
on public.booking_commissions
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = booking_id
      and b.user_id = (select auth.uid())
  )
);

-- usage_events y payment_events no se exponen al cliente. Se habilitó RLS y
-- no se crean políticas para anon/authenticated.
revoke all on table public.plans from anon, authenticated;
revoke all on table public.user_subscriptions from anon, authenticated;
revoke all on table public.trip_passes from anon, authenticated;
revoke all on table public.usage_records from anon, authenticated;
revoke all on table public.usage_events from anon, authenticated;
revoke all on table public.payment_events from anon, authenticated;
revoke all on table public.bookings from anon, authenticated;
revoke all on table public.booking_commissions from anon, authenticated;

grant select on table public.plans to anon, authenticated;
grant select on table public.user_subscriptions to authenticated;
grant select on table public.trip_passes to authenticated;
grant select on table public.usage_records to authenticated;
grant select on table public.bookings to authenticated;
grant select on table public.booking_commissions to authenticated;

-- El backend es el único que escribe planes, pagos, consumo y reservas. Esta
-- clave nunca se incluye en el frontend ni en una variable VITE_*.
grant select, insert, update, delete on table public.plans to service_role;
grant select, insert, update, delete on table public.user_subscriptions to service_role;
grant select, insert, update, delete on table public.trip_passes to service_role;
grant select, insert, update, delete on table public.usage_records to service_role;
grant select, insert, update, delete on table public.usage_events to service_role;
grant select, insert, update, delete on table public.payment_events to service_role;
grant select, insert, update, delete on table public.bookings to service_role;
grant select, insert, update, delete on table public.booking_commissions to service_role;
