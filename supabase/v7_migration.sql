-- ChinaGo V7: real supplier integration metadata and attribution
create extension if not exists pgcrypto;

create table if not exists public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  category text not null,
  environment text not null default 'production',
  label text,
  affiliate_id text,
  config_json jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attribution_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  provider text not null,
  category text not null,
  item_id text,
  event_type text not null,
  affiliate_id text,
  external_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.provider_credentials enable row level security;
alter table public.attribution_events enable row level security;

-- Credentials are never readable by normal users; service-role only.
drop policy if exists "provider credentials private" on public.provider_credentials;
create policy "provider credentials private" on public.provider_credentials for all using (false) with check (false);

drop policy if exists "users read own attribution" on public.attribution_events;
create policy "users read own attribution" on public.attribution_events for select using (user_id=auth.uid());

create index if not exists attribution_provider_idx on public.attribution_events(provider,category,event_type,created_at desc);
create index if not exists attribution_user_idx on public.attribution_events(user_id,created_at desc);

create or replace view public.v7_attribution_summary as
select provider, category, event_type, count(*) as events
from public.attribution_events
group by provider, category, event_type;
