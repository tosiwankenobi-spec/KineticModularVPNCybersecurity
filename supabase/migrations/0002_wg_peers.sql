-- Real WireGuard peer registry.
--
-- One row per device a user has generated a config for. `allowed_ip` is the
-- address assigned to that device inside the relay's 10.8.0.0/24 tunnel
-- subnet. Rows are written by the `wg-peers` Edge Function using the
-- service_role key (which bypasses RLS) so that IP assignment stays
-- centralized and collision-free — clients only ever get read access to
-- their own rows.

create table if not exists public.wg_peers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  public_key text not null unique,
  allowed_ip inet not null unique,
  label text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.wg_peers enable row level security;

create policy "wg_peers select own" on public.wg_peers
  for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies for the anon/authenticated roles on
-- purpose: peer creation and revocation only happen via the `wg-peers`
-- Edge Function running with the service_role key, which bypasses RLS.
-- This keeps IP allocation single-writer instead of racy client writes.

create index if not exists wg_peers_user_id_idx on public.wg_peers (user_id);
