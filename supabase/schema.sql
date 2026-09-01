-- ===========================================================================
--  DealGuard — database schema
--  Run this once against a fresh Supabase project:
--    Supabase Dashboard -> SQL Editor -> paste -> Run
--  or:  psql "$SUPABASE_DB_URL" -f supabase/schema.sql
--
--  Every table is protected by row-level security. A row is visible to its
--  owner, and to the members of the organisation it belongs to (Business plan).
-- ===========================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
--  Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.plan_id as enum ('free', 'pro', 'business');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.plan_status as enum ('active', 'trialing', 'past_due', 'canceled', 'incomplete');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.offer_status as enum ('analyzed', 'needs_review', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.verdict as enum ('good', 'review', 'bad');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.source_type as enum ('pdf', 'csv', 'xlsx', 'text', 'manual', 'api');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.org_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
--  updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
--  Organisations (Business plan: 5 seats sharing one supplier history)
-- ---------------------------------------------------------------------------

create table if not exists public.organizations (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null check (char_length(name) between 1 and 120),
  owner_id                uuid not null references auth.users (id) on delete cascade,
  plan                    public.plan_id not null default 'business',
  plan_status             public.plan_status not null default 'incomplete',
  seats                   integer not null default 5 check (seats between 1 and 100),
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  current_period_end      timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table if not exists public.organization_members (
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.org_role not null default 'member',
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists organization_members_user_idx on public.organization_members (user_id);

-- Membership lookups run inside RLS policies, so they must not themselves be
-- filtered by RLS or the policies would recurse.
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.org_id = target_org
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.org_id = target_org
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

-- Seats are a hard limit, enforced where it cannot be bypassed by the client.
create or replace function public.enforce_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seat_limit integer;
  seats_used integer;
begin
  select seats into seat_limit from public.organizations where id = new.org_id;
  select count(*) into seats_used from public.organization_members where org_id = new.org_id;
  if seats_used >= coalesce(seat_limit, 0) then
    raise exception 'Organisation is at its seat limit of % seats', seat_limit
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_seat_limit on public.organization_members;
create trigger enforce_seat_limit
  before insert on public.organization_members
  for each row execute function public.enforce_seat_limit();

-- ---------------------------------------------------------------------------
--  Profiles — one row per auth user, created automatically on sign-up
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  email                   text,
  full_name               text,
  company_name            text,
  org_id                  uuid references public.organizations (id) on delete set null,
  plan                    public.plan_id not null default 'free',
  plan_status             public.plan_status not null default 'active',
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  current_period_end      timestamptz,
  -- Buyer settings that drive the analysis.
  cost_of_capital_pct     numeric(5,2) not null default 12 check (cost_of_capital_pct between 0 and 100),
  target_margin_pct       numeric(5,2) not null default 25 check (target_margin_pct between 0 and 100),
  default_currency        text not null default 'USD' check (char_length(default_currency) = 3),
  onboarded_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, company_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'company_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The plan that actually applies: an organisation's plan beats a personal one.
create or replace function public.effective_plan(uid uuid)
returns public.plan_id
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select o.plan
      from public.organization_members m
      join public.organizations o on o.id = m.org_id
      where m.user_id = uid
        and o.plan_status in ('active', 'trialing')
      order by o.created_at
      limit 1
    ),
    (
      select case when p.plan_status in ('active', 'trialing') then p.plan else 'free'::public.plan_id end
      from public.profiles p
      where p.id = uid
    ),
    'free'::public.plan_id
  );
$$;

-- ---------------------------------------------------------------------------
--  Suppliers
-- ---------------------------------------------------------------------------

create table if not exists public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  org_id       uuid references public.organizations (id) on delete set null,
  name         text not null check (char_length(name) between 1 and 160),
  -- Lower-cased name, used to keep one supplier per buyer.
  slug         text not null,
  contact_name  text,
  contact_email text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists suppliers_owner_slug_key on public.suppliers (owner_id, slug);
create index if not exists suppliers_org_idx on public.suppliers (org_id);

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
--  Offers
-- ---------------------------------------------------------------------------

create table if not exists public.offers (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references auth.users (id) on delete cascade,
  org_id                uuid references public.organizations (id) on delete set null,
  supplier_id           uuid references public.suppliers (id) on delete set null,
  supplier_name         text not null,
  reference             text,
  source_type           public.source_type not null default 'manual',
  file_name             text,
  raw_text              text,
  currency              text not null default 'USD',
  status                public.offer_status not null default 'analyzed',
  verdict               public.verdict,
  score                 integer check (score between 0 and 100),
  confidence            numeric(4,3) not null default 1,

  -- Totals, denormalised so the dashboard does not have to open the JSON.
  gross_total           numeric(14,2) not null default 0,
  discount_total        numeric(14,2) not null default 0,
  invoice_subtotal      numeric(14,2) not null default 0,
  freight_total         numeric(14,2) not null default 0,
  fees_total            numeric(14,2) not null default 0,
  invoice_total         numeric(14,2) not null default 0,
  early_payment_saving  numeric(14,2) not null default 0,
  financing_benefit     numeric(14,2) not null default 0,
  rebate_total          numeric(14,2) not null default 0,
  net_total             numeric(14,2) not null default 0,
  margin_total          numeric(14,2),
  savings_identified    numeric(14,2) not null default 0,

  payment_net_days      integer not null default 30,
  payment_discount_pct  numeric(6,3) not null default 0,
  payment_discount_days integer not null default 0,
  freight_flat          numeric(12,2) not null default 0,
  freight_per_unit      numeric(12,4) not null default 0,
  freight_free_above    numeric(14,2),
  fees                  jsonb not null default '[]'::jsonb,
  rebate                jsonb,

  headline              text,
  summary               text,
  -- The complete OfferAnalysis, so a result page can be rebuilt exactly.
  analysis              jsonb not null default '{}'::jsonb,
  warnings              jsonb not null default '[]'::jsonb,

  quoted_at             timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists offers_owner_created_idx on public.offers (owner_id, created_at desc);
create index if not exists offers_org_created_idx on public.offers (org_id, created_at desc);
create index if not exists offers_supplier_idx on public.offers (supplier_id, quoted_at desc);
create index if not exists offers_status_idx on public.offers (owner_id, status);

drop trigger if exists offers_set_updated_at on public.offers;
create trigger offers_set_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
--  Offer line items
-- ---------------------------------------------------------------------------

create table if not exists public.offer_items (
  id                    uuid primary key default gen_random_uuid(),
  offer_id              uuid not null references public.offers (id) on delete cascade,
  owner_id              uuid not null references auth.users (id) on delete cascade,
  org_id                uuid references public.organizations (id) on delete set null,
  line_index            integer not null default 0,

  description           text not null,
  sku                   text,
  product_key           text not null,
  uom                   text not null default 'unit',
  quantity              numeric(14,4) not null default 0,
  pack_size             numeric(14,4) not null default 1,
  units_total           numeric(16,4) not null default 0,

  quoted_unit_price     numeric(14,4) not null default 0,
  list_unit_cost        numeric(14,4) not null default 0,
  invoice_unit_cost     numeric(14,4) not null default 0,
  true_net_unit_cost    numeric(14,4) not null default 0,

  gross_total           numeric(14,2) not null default 0,
  invoice_subtotal      numeric(14,2) not null default 0,
  freight_allocated     numeric(14,2) not null default 0,
  fees_allocated        numeric(14,2) not null default 0,
  invoice_total         numeric(14,2) not null default 0,
  rebate_amount         numeric(14,2) not null default 0,
  net_line_cost         numeric(14,2) not null default 0,

  headline_discount_pct numeric(7,2) not null default 0,
  effective_discount_pct numeric(7,2) not null default 0,
  sell_unit_price       numeric(14,4),
  true_margin_pct       numeric(7,2),
  margin_total          numeric(14,2),

  benchmark_unit_cost   numeric(14,4),
  benchmark_delta_pct   numeric(7,2),
  benchmark_source      text,
  confidence            numeric(4,3) not null default 1,
  score                 integer,
  detail                jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);

create index if not exists offer_items_offer_idx on public.offer_items (offer_id, line_index);
create index if not exists offer_items_product_idx on public.offer_items (owner_id, product_key);
create index if not exists offer_items_org_product_idx on public.offer_items (org_id, product_key);

-- ---------------------------------------------------------------------------
--  Flags
-- ---------------------------------------------------------------------------

create table if not exists public.offer_flags (
  id            uuid primary key default gen_random_uuid(),
  offer_id      uuid not null references public.offers (id) on delete cascade,
  owner_id      uuid not null references auth.users (id) on delete cascade,
  org_id        uuid references public.organizations (id) on delete set null,
  line_index    integer,
  code          text not null,
  severity      text not null check (severity in ('critical', 'warning', 'info', 'positive')),
  title         text not null,
  detail        text not null default '',
  impact_amount numeric(14,2),
  created_at    timestamptz not null default now()
);

create index if not exists offer_flags_offer_idx on public.offer_flags (offer_id);
create index if not exists offer_flags_owner_code_idx on public.offer_flags (owner_id, code);

-- ---------------------------------------------------------------------------
--  Generated counter-offer emails
-- ---------------------------------------------------------------------------

create table if not exists public.counter_offers (
  id          uuid primary key default gen_random_uuid(),
  offer_id    uuid not null references public.offers (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  org_id      uuid references public.organizations (id) on delete set null,
  tone        text not null default 'collaborative' check (tone in ('collaborative', 'firm')),
  subject     text not null,
  body        text not null,
  value       numeric(14,2) not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists counter_offers_offer_idx on public.counter_offers (offer_id, created_at desc);

-- ---------------------------------------------------------------------------
--  Usage metering (Free plan: 3 analyses per calendar month)
-- ---------------------------------------------------------------------------

create table if not exists public.usage_events (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  org_id      uuid references public.organizations (id) on delete set null,
  kind        text not null default 'analysis',
  offer_id    uuid references public.offers (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists usage_events_owner_month_idx on public.usage_events (owner_id, created_at desc);

create or replace function public.analyses_this_month(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.usage_events
  where owner_id = uid
    and kind = 'analysis'
    and created_at >= date_trunc('month', now());
$$;

-- ---------------------------------------------------------------------------
--  API keys (Business plan)
-- ---------------------------------------------------------------------------

create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  org_id       uuid references public.organizations (id) on delete set null,
  name         text not null default 'Default key',
  -- Only a SHA-256 hash is stored; the secret is shown once at creation.
  key_hash     text not null unique,
  key_prefix   text not null,
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists api_keys_owner_idx on public.api_keys (owner_id);
create index if not exists api_keys_hash_idx on public.api_keys (key_hash) where revoked_at is null;

-- ---------------------------------------------------------------------------
--  Price history view — powers the supplier charts and the benchmarks
-- ---------------------------------------------------------------------------

drop view if exists public.price_history;
create view public.price_history
with (security_invoker = on) as
select
  oi.id,
  oi.offer_id,
  o.owner_id,
  o.org_id,
  o.supplier_id,
  o.supplier_name,
  oi.product_key,
  oi.description,
  oi.sku,
  oi.uom,
  oi.pack_size,
  oi.list_unit_cost,
  oi.true_net_unit_cost,
  oi.true_margin_pct,
  o.currency,
  o.payment_net_days as net_days,
  o.quoted_at as occurred_at
from public.offer_items oi
join public.offers o on o.id = oi.offer_id
where o.status = 'analyzed';

-- ===========================================================================
--  Row-level security
-- ===========================================================================

alter table public.profiles             enable row level security;
alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;
alter table public.suppliers            enable row level security;
alter table public.offers               enable row level security;
alter table public.offer_items          enable row level security;
alter table public.offer_flags          enable row level security;
alter table public.counter_offers       enable row level security;
alter table public.usage_events         enable row level security;
alter table public.api_keys             enable row level security;

-- profiles ------------------------------------------------------------------
drop policy if exists "profiles are readable by their owner" on public.profiles;
create policy "profiles are readable by their owner"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles are editable by their owner" on public.profiles;
create policy "profiles are editable by their owner"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles are inserted by their owner" on public.profiles;
create policy "profiles are inserted by their owner"
  on public.profiles for insert
  with check (id = auth.uid());

-- organizations -------------------------------------------------------------
drop policy if exists "organizations are readable by members" on public.organizations;
create policy "organizations are readable by members"
  on public.organizations for select
  using (owner_id = auth.uid() or public.is_org_member(id));

drop policy if exists "organizations are created by their owner" on public.organizations;
create policy "organizations are created by their owner"
  on public.organizations for insert
  with check (owner_id = auth.uid());

drop policy if exists "organizations are updated by admins" on public.organizations;
create policy "organizations are updated by admins"
  on public.organizations for update
  using (owner_id = auth.uid() or public.is_org_admin(id))
  with check (owner_id = auth.uid() or public.is_org_admin(id));

drop policy if exists "organizations are deleted by their owner" on public.organizations;
create policy "organizations are deleted by their owner"
  on public.organizations for delete
  using (owner_id = auth.uid());

-- organization_members ------------------------------------------------------
drop policy if exists "members are readable within the organisation" on public.organization_members;
create policy "members are readable within the organisation"
  on public.organization_members for select
  using (user_id = auth.uid() or public.is_org_member(org_id));

drop policy if exists "members are added by admins" on public.organization_members;
create policy "members are added by admins"
  on public.organization_members for insert
  with check (
    public.is_org_admin(org_id)
    or exists (select 1 from public.organizations o where o.id = org_id and o.owner_id = auth.uid())
  );

drop policy if exists "members are removed by admins or themselves" on public.organization_members;
create policy "members are removed by admins or themselves"
  on public.organization_members for delete
  using (user_id = auth.uid() or public.is_org_admin(org_id));

drop policy if exists "member roles are updated by admins" on public.organization_members;
create policy "member roles are updated by admins"
  on public.organization_members for update
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

-- Owner-or-organisation access, applied identically to every data table.
-- suppliers -----------------------------------------------------------------
drop policy if exists "suppliers are readable by owner or org" on public.suppliers;
create policy "suppliers are readable by owner or org"
  on public.suppliers for select
  using (owner_id = auth.uid() or (org_id is not null and public.is_org_member(org_id)));

drop policy if exists "suppliers are written by owner or org" on public.suppliers;
create policy "suppliers are written by owner or org"
  on public.suppliers for insert
  with check (owner_id = auth.uid());

drop policy if exists "suppliers are updated by owner or org" on public.suppliers;
create policy "suppliers are updated by owner or org"
  on public.suppliers for update
  using (owner_id = auth.uid() or (org_id is not null and public.is_org_member(org_id)))
  with check (owner_id = auth.uid() or (org_id is not null and public.is_org_member(org_id)));

drop policy if exists "suppliers are deleted by their owner" on public.suppliers;
create policy "suppliers are deleted by their owner"
  on public.suppliers for delete
  using (owner_id = auth.uid());

-- offers --------------------------------------------------------------------
drop policy if exists "offers are readable by owner or org" on public.offers;
create policy "offers are readable by owner or org"
  on public.offers for select
  using (owner_id = auth.uid() or (org_id is not null and public.is_org_member(org_id)));

drop policy if exists "offers are inserted by their owner" on public.offers;
create policy "offers are inserted by their owner"
  on public.offers for insert
  with check (owner_id = auth.uid());

drop policy if exists "offers are updated by owner or org" on public.offers;
create policy "offers are updated by owner or org"
  on public.offers for update
  using (owner_id = auth.uid() or (org_id is not null and public.is_org_member(org_id)))
  with check (owner_id = auth.uid() or (org_id is not null and public.is_org_member(org_id)));

drop policy if exists "offers are deleted by their owner" on public.offers;
create policy "offers are deleted by their owner"
  on public.offers for delete
  using (owner_id = auth.uid());

-- offer_items ---------------------------------------------------------------
drop policy if exists "offer items are readable by owner or org" on public.offer_items;
create policy "offer items are readable by owner or org"
  on public.offer_items for select
  using (owner_id = auth.uid() or (org_id is not null and public.is_org_member(org_id)));

drop policy if exists "offer items are inserted by their owner" on public.offer_items;
create policy "offer items are inserted by their owner"
  on public.offer_items for insert
  with check (owner_id = auth.uid());

drop policy if exists "offer items are updated by owner or org" on public.offer_items;
create policy "offer items are updated by owner or org"
  on public.offer_items for update
  using (owner_id = auth.uid() or (org_id is not null and public.is_org_member(org_id)))
  with check (owner_id = auth.uid() or (org_id is not null and public.is_org_member(org_id)));

drop policy if exists "offer items are deleted by their owner" on public.offer_items;
create policy "offer items are deleted by their owner"
  on public.offer_items for delete
  using (owner_id = auth.uid());

-- offer_flags ---------------------------------------------------------------
drop policy if exists "flags are readable by owner or org" on public.offer_flags;
create policy "flags are readable by owner or org"
  on public.offer_flags for select
  using (owner_id = auth.uid() or (org_id is not null and public.is_org_member(org_id)));

drop policy if exists "flags are inserted by their owner" on public.offer_flags;
create policy "flags are inserted by their owner"
  on public.offer_flags for insert
  with check (owner_id = auth.uid());

drop policy if exists "flags are deleted by their owner" on public.offer_flags;
create policy "flags are deleted by their owner"
  on public.offer_flags for delete
  using (owner_id = auth.uid());

-- counter_offers ------------------------------------------------------------
drop policy if exists "counter offers are readable by owner or org" on public.counter_offers;
create policy "counter offers are readable by owner or org"
  on public.counter_offers for select
  using (owner_id = auth.uid() or (org_id is not null and public.is_org_member(org_id)));

drop policy if exists "counter offers are inserted by their owner" on public.counter_offers;
create policy "counter offers are inserted by their owner"
  on public.counter_offers for insert
  with check (owner_id = auth.uid());

drop policy if exists "counter offers are deleted by their owner" on public.counter_offers;
create policy "counter offers are deleted by their owner"
  on public.counter_offers for delete
  using (owner_id = auth.uid());

-- usage_events --------------------------------------------------------------
-- Readable by the user so the dashboard can show the quota; only the service
-- role writes to it, so there is deliberately no insert policy.
drop policy if exists "usage events are readable by their owner" on public.usage_events;
create policy "usage events are readable by their owner"
  on public.usage_events for select
  using (owner_id = auth.uid());

-- api_keys ------------------------------------------------------------------
-- Hashes are never exposed to the browser: the client reads metadata only via
-- the API routes, which run with the service role.
drop policy if exists "api keys are readable by their owner" on public.api_keys;
create policy "api keys are readable by their owner"
  on public.api_keys for select
  using (owner_id = auth.uid() or (org_id is not null and public.is_org_member(org_id)));

drop policy if exists "api keys are revoked by their owner" on public.api_keys;
create policy "api keys are revoked by their owner"
  on public.api_keys for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "api keys are deleted by their owner" on public.api_keys;
create policy "api keys are deleted by their owner"
  on public.api_keys for delete
  using (owner_id = auth.uid());

-- ===========================================================================
--  Grants — anon/authenticated reach tables only through RLS
-- ===========================================================================

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.price_history to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.effective_plan(uuid) to authenticated;
grant execute on function public.analyses_this_month(uuid) to authenticated;
