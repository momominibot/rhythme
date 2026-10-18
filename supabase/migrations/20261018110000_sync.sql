-- Ovumind sync schema (jev-1.13.0 chose Supabase Postgres + RLS, 0.94).
-- Applied 18 Oct 2026 to project ovaria-app (ap-southeast-1). Not yet wired to
-- the app: the room stays local-first. When accounts land, each user reads and
-- writes only her own rows.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.entries (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('sleep','period','symptom','food','reflection','mindfulness')),
  date date not null,
  data jsonb not null default '{}'::jsonb,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);
create index if not exists entries_user_date on public.entries (user_id, date);
create index if not exists entries_user_updated on public.entries (user_id, updated_at);
alter table public.profiles enable row level security;
alter table public.entries enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own entries" on public.entries;
create policy "own entries" on public.entries for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before update on public.entries for each row execute function public.touch_updated_at();
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
