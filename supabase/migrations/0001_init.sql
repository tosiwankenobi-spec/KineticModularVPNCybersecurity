-- Secure Shield / Kinetic — Phase A schema
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run),
-- or via `supabase db push` if you're using the Supabase CLI locally.

-- ============================================================
-- profiles: one row per authenticated user, created automatically on signup
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Automatically create a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- module_settings: per-user toggle state for each protection module
-- ============================================================
create table if not exists public.module_settings (
  user_id uuid not null references auth.users (id) on delete cascade,
  module_id text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, module_id)
);

alter table public.module_settings enable row level security;

create policy "Users can view their own module settings"
  on public.module_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own module settings"
  on public.module_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own module settings"
  on public.module_settings for update
  using (auth.uid() = user_id);

-- ============================================================
-- alerts: notification / event history per user
-- ============================================================
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  module_id text,
  level text not null check (level in ('info', 'warn', 'danger', 'success')),
  title text not null,
  detail text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.alerts enable row level security;

create policy "Users can view their own alerts"
  on public.alerts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own alerts"
  on public.alerts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own alerts"
  on public.alerts for update
  using (auth.uid() = user_id);

create policy "Users can delete their own alerts"
  on public.alerts for delete
  using (auth.uid() = user_id);

create index if not exists alerts_user_id_created_at_idx
  on public.alerts (user_id, created_at desc);

-- ============================================================
-- relay_nodes: exit node registry (public read-only reference data).
-- Seeded with the same regions the demo UI currently hardcodes.
-- This table is the foundation for Phase B (wiring to real relay servers).
-- ============================================================
create table if not exists public.relay_nodes (
  code text primary key,
  city text not null,
  country text not null,
  ping_ms integer not null default 0,
  status text not null default 'offline' check (status in ('online', 'offline', 'maintenance'))
);

alter table public.relay_nodes enable row level security;

create policy "Anyone can view relay nodes"
  on public.relay_nodes for select
  using (true);

insert into public.relay_nodes (code, city, country, ping_ms, status)
values
  ('CH', 'Zurich', 'Switzerland', 12, 'offline'),
  ('IS', 'Reykjavík', 'Iceland', 24, 'offline'),
  ('SG', 'Singapore', 'Singapore', 68, 'offline'),
  ('US', 'New York', 'United States', 42, 'offline')
on conflict (code) do nothing;

-- ============================================================
-- sessions: real connection history (tunnel on/off events per region).
-- Network effects stay simulated in Phase A — this table just tracks
-- state honestly so Phase B can plug in a real relay without a schema change.
-- ============================================================
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  region_code text not null references public.relay_nodes (code),
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz
);

alter table public.sessions enable row level security;

create policy "Users can view their own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own sessions"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own sessions"
  on public.sessions for update
  using (auth.uid() = user_id);

create index if not exists sessions_user_id_connected_at_idx
  on public.sessions (user_id, connected_at desc);
