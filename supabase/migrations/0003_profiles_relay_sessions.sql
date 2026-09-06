-- 0001_init.sql defined profiles, relay_nodes, and sessions, but that
-- migration was never actually applied to the live project (module_settings
-- and alerts already existed from an earlier manual setup, so the gap went
-- unnoticed until the account page failed with "Could not find the table
-- 'public.profiles' in the schema cache").
--
-- This migration was already applied directly to the live database on
-- 2026-09-06 to unblock the account page. It's recorded here so the repo's
-- migration history matches reality and a future `supabase db push` doesn't
-- try to redo (or skip) this. Every statement is idempotent/safe to re-run.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill profile rows for any auth user created before this migration
-- (the trigger only fires on new inserts going forward).
insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1))
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

create table if not exists public.relay_nodes (
  code text primary key,
  city text not null,
  country text not null,
  ping_ms integer not null default 0,
  status text not null default 'offline' check (status in ('online', 'offline', 'maintenance'))
);

alter table public.relay_nodes enable row level security;

drop policy if exists "Anyone can view relay nodes" on public.relay_nodes;
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

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  region_code text not null references public.relay_nodes (code),
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz
);

alter table public.sessions enable row level security;

drop policy if exists "Users can view their own sessions" on public.sessions;
create policy "Users can view their own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own sessions" on public.sessions;
create policy "Users can insert their own sessions"
  on public.sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own sessions" on public.sessions;
create policy "Users can update their own sessions"
  on public.sessions for update
  using (auth.uid() = user_id);

create index if not exists sessions_user_id_connected_at_idx
  on public.sessions (user_id, connected_at desc);