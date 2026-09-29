create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  home_country text,
  preferred_language text default 'en',
  created_at timestamptz default now()
);

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_en text not null,
  name_zh text not null,
  province_en text,
  hero_image text,
  tagline text,
  description text,
  best_months text[],
  tags text[],
  created_at timestamptz default now()
);

create table if not exists public.pois (
  id uuid primary key default gen_random_uuid(),
  city_id uuid references public.cities(id) on delete cascade,
  type text not null,
  name_en text not null,
  name_zh text,
  description text,
  address text,
  lat double precision,
  lng double precision,
  price_range text,
  foreigner_friendly boolean default false,
  english_menu boolean default false,
  accepts_alipay boolean default true,
  accepts_wechat_pay boolean default true,
  accepts_international_card boolean default false,
  english_support boolean default false,
  reservation_required boolean default false,
  official_url text,
  booking_url text,
  image_url text,
  tags text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.saved_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  payload jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  poi_id uuid references public.pois(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, poi_id)
);

create table if not exists public.experiences (
  id uuid primary key default gen_random_uuid(),
  city_id uuid references public.cities(id) on delete cascade,
  title text not null,
  summary text,
  duration text,
  price_from numeric,
  currency text default 'CNY',
  language text default 'English',
  provider_name text,
  booking_url text,
  image_url text,
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.cities enable row level security;
alter table public.pois enable row level security;
alter table public.saved_trips enable row level security;
alter table public.favorites enable row level security;
alter table public.experiences enable row level security;

drop policy if exists "public read cities" on public.cities;
create policy "public read cities" on public.cities for select using (true);

drop policy if exists "public read pois" on public.pois;
create policy "public read pois" on public.pois for select using (true);

drop policy if exists "public read experiences" on public.experiences;
create policy "public read experiences" on public.experiences for select using (active = true);

drop policy if exists "users own trips" on public.saved_trips;
create policy "users own trips" on public.saved_trips for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users own favorites" on public.favorites;
create policy "users own favorites" on public.favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users own profile" on public.profiles;
create policy "users own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);


create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  city_id uuid references public.cities(id) on delete set null,
  provider_name text,
  provider_url text,
  booking_url text,
  price_from numeric,
  currency text default 'CNY',
  commission_rate numeric,
  verified_at timestamptz,
  active boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  poi_id uuid references public.pois(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  field_name text,
  report text not null,
  status text default 'open',
  created_at timestamptz default now()
);

alter table public.offers enable row level security;
alter table public.content_reports enable row level security;

drop policy if exists "public read active offers" on public.offers;
create policy "public read active offers" on public.offers for select using (active = true);

drop policy if exists "users create reports" on public.content_reports;
create policy "users create reports" on public.content_reports for insert to authenticated with check (auth.uid() = user_id);

create index if not exists pois_city_idx on public.pois(city_id);
create index if not exists pois_type_idx on public.pois(type);
create index if not exists offers_category_idx on public.offers(category);
create index if not exists offers_city_idx on public.offers(city_id);
create index if not exists saved_trips_user_idx on public.saved_trips(user_id);
create index if not exists favorites_user_idx on public.favorites(user_id);


create table if not exists public.trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.saved_trips(id) on delete cascade,
  day_number integer not null,
  item_type text not null,
  title text not null,
  subtitle text,
  start_time text,
  end_time text,
  location text,
  notes text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.booking_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  offer_id uuid references public.offers(id) on delete set null,
  category text not null,
  external_url text,
  event_type text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.search_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  query text not null,
  location text,
  created_at timestamptz default now()
);

alter table public.trip_items enable row level security;
alter table public.booking_events enable row level security;
alter table public.search_events enable row level security;

drop policy if exists "users own trip items" on public.trip_items;
create policy "users own trip items" on public.trip_items
for all to authenticated
using (exists (select 1 from public.saved_trips t where t.id=trip_items.trip_id and t.user_id=auth.uid()))
with check (exists (select 1 from public.saved_trips t where t.id=trip_items.trip_id and t.user_id=auth.uid()));

drop policy if exists "users own booking events" on public.booking_events;
create policy "users own booking events" on public.booking_events
for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists "users own search events" on public.search_events;
create policy "users own search events" on public.search_events
for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

create index if not exists trip_items_trip_idx on public.trip_items(trip_id,day_number,sort_order);
create index if not exists booking_events_user_idx on public.booking_events(user_id,created_at desc);
create index if not exists search_events_created_idx on public.search_events(created_at desc);
