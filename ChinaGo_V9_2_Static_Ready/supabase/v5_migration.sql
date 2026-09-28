-- ChinaGo V5 commercial operations migration
create extension if not exists pgcrypto;

create table if not exists public.booking_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  offer_id uuid references public.offers(id) on delete set null,
  category text not null,
  status text not null default 'new',
  customer_name text, customer_email text, customer_phone text,
  travel_date date, party_size integer, request_json jsonb not null default '{}'::jsonb,
  source text default 'chinago', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.provider_requests (
  id uuid primary key default gen_random_uuid(),
  provider text not null, category text not null, user_id uuid references auth.users(id) on delete set null,
  request_json jsonb not null default '{}'::jsonb, response_status integer, success boolean not null default false,
  latency_ms integer, created_at timestamptz not null default now()
);

create table if not exists public.admin_audit (
  id uuid primary key default gen_random_uuid(), admin_email text not null, action text not null,
  entity_type text, entity_id text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

alter table public.booking_leads enable row level security;
alter table public.provider_requests enable row level security;
alter table public.admin_audit enable row level security;

drop policy if exists "users read own booking leads" on public.booking_leads;
create policy "users read own booking leads" on public.booking_leads for select using (user_id=auth.uid());
drop policy if exists "users create booking leads" on public.booking_leads;
create policy "users create booking leads" on public.booking_leads for insert with check (user_id=auth.uid() or user_id is null);

create index if not exists booking_leads_status_idx on public.booking_leads(status,created_at desc);
create index if not exists booking_leads_user_idx on public.booking_leads(user_id,created_at desc);
create index if not exists provider_requests_idx on public.provider_requests(provider,created_at desc);

create or replace view public.admin_provider_summary as
select provider, category, count(*) as requests,
       count(*) filter (where success) as successful,
       round(avg(latency_ms)) as avg_latency_ms,
       max(created_at) as last_request
from public.provider_requests group by provider, category;
