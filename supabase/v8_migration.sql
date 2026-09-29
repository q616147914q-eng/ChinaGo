-- ChinaGo V8: hotel funnel, quote views and supplier conversion telemetry
create extension if not exists pgcrypto;

create table if not exists public.quote_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  provider text not null,
  category text not null,
  item_id text,
  event_type text not null,
  request_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.hotel_search_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  provider text not null default 'booking_com',
  query_json jsonb not null default '{}'::jsonb,
  result_count integer not null default 0,
  currency text,
  created_at timestamptz not null default now()
);

alter table public.quote_events enable row level security;
alter table public.hotel_search_sessions enable row level security;
drop policy if exists "users read own quote events" on public.quote_events;
create policy "users read own quote events" on public.quote_events for select using (user_id=auth.uid());
drop policy if exists "users read own hotel sessions" on public.hotel_search_sessions;
create policy "users read own hotel sessions" on public.hotel_search_sessions for select using (user_id=auth.uid());
create index if not exists quote_events_lookup_idx on public.quote_events(provider,category,event_type,created_at desc);
create index if not exists hotel_search_sessions_idx on public.hotel_search_sessions(provider,created_at desc);
create or replace view public.v8_hotel_funnel as
select event_type, count(*) as events from public.quote_events where category='hotel' group by event_type;
