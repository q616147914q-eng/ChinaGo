-- ChinaGo V6 transaction-readiness migration
create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  lead_id uuid references public.booking_leads(id) on delete set null,
  offer_id uuid references public.offers(id) on delete set null,
  category text not null, provider text, external_order_id text,
  status text not null default 'requested', currency text default 'CNY',
  amount numeric(12,2), commission_amount numeric(12,2),
  customer_email text, request_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.provider_quotes (
  id uuid primary key default gen_random_uuid(), provider text not null, category text not null,
  search_key text not null, currency text default 'CNY', response_json jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null, created_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(), provider text not null, event_type text not null,
  external_event_id text, payload jsonb not null default '{}'::jsonb, processed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;
alter table public.provider_quotes enable row level security;
alter table public.webhook_events enable row level security;

drop policy if exists "users read own orders" on public.orders;
create policy "users read own orders" on public.orders for select using (user_id=auth.uid());
drop policy if exists "users read own quotes" on public.provider_quotes;
create policy "users read own quotes" on public.provider_quotes for select using (false);

create index if not exists orders_user_idx on public.orders(user_id,created_at desc);
create index if not exists orders_status_idx on public.orders(status,created_at desc);
create index if not exists provider_quotes_key_idx on public.provider_quotes(provider,category,search_key,expires_at desc);
create unique index if not exists webhook_event_provider_external_idx on public.webhook_events(provider,external_event_id) where external_event_id is not null;

create or replace view public.v6_sales_summary as
select category, status, count(*) as orders, coalesce(sum(amount),0) as gross_amount, coalesce(sum(commission_amount),0) as commission_amount
from public.orders group by category,status;
