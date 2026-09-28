-- ChinaGo V9: destination resolution, hotel details, hotel favorites
create table if not exists public.hotel_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  accommodation_id text not null,
  title text,
  city_name text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, accommodation_id)
);
alter table public.hotel_favorites enable row level security;
drop policy if exists "users read own hotel favorites" on public.hotel_favorites;
create policy "users read own hotel favorites" on public.hotel_favorites for select using (user_id=auth.uid());
drop policy if exists "users insert own hotel favorites" on public.hotel_favorites;
create policy "users insert own hotel favorites" on public.hotel_favorites for insert with check (user_id=auth.uid());
drop policy if exists "users delete own hotel favorites" on public.hotel_favorites;
create policy "users delete own hotel favorites" on public.hotel_favorites for delete using (user_id=auth.uid());
create index if not exists hotel_favorites_user_idx on public.hotel_favorites(user_id,created_at desc);
