# Kinetic — Secure Shield

A modular VPN and cybersecurity console. Toggle only the protection you need — encrypted tunneling, malware shield, tracker blocker, adaptive firewall, private DNS, and identity masking — and see live memory/latency cost per module.

This project was originally scaffolded with [Lovable](https://lovable.dev) and is connected to it — see `AGENTS.md` for notes on keeping the synced branch in a working state.

## Status

The in-app **[`/spec`](src/routes/spec.tsx)** page is the source of truth for what's real versus simulated — it's read by end users, so it's kept accurate as the app evolves; this section is a shorter summary of the same thing.

- **Auth & persistence**: real, backed by Supabase (email/password auth, per-user module settings and alert history), with row-level security scoping every row to its owner.
- **The encrypted tunnel**: real, not simulated. One live WireGuard relay node runs on Google Cloud. The account page generates a real Curve25519 keypair client-side (the private key never leaves the browser), registers it with the relay through a Supabase Edge Function, and hands back a `.conf` file and a scannable QR code — importing either into the official WireGuard app opens a genuine encrypted tunnel with actual routed traffic. The console's tunnel status card polls the relay's real WireGuard handshake state (`wg show wg0 dump`), not a stored on/off preference.
- **Everything else in the console**: simulated. The other module toggles (malware shield, tracker blocker, adaptive firewall, private DNS, identity masking, kill switch, split tunneling) persist a real per-user setting and generate realistic sample alerts, but don't inspect or route any real traffic. The region picker only has one real relay behind it — the other three regions are illustrative until more relays exist.

## Development

You'll need Node.js and a Supabase project.

```sh
git clone <this-repository-url>
cd <repository-name>
npm install
cp .env.local.example .env.local   # fill in your Supabase project URL + anon key
npm run dev
```

Apply the migrations in `supabase/migrations/` (`0001_init.sql`, then `0002_wg_peers.sql`, then `0003_profiles_relay_sessions.sql`) once in your Supabase project's SQL Editor before first use — together they create `profiles`, `module_settings`, `alerts`, `relay_nodes`, `sessions`, and `wg_peers`, all with row-level security. `supabase/functions/wg-peers` is the Edge Function that actually talks to the relay; deploy it with the Supabase CLI or `supabase functions deploy wg-peers`, and see its header comment for the secrets it needs set.

### Relay infrastructure

`infra/` has the scripts and service that run on the WireGuard relay VM itself (not in Supabase):

- `infra/setup-peer-service.sh` — provisions a fresh relay VM: installs the peer-registration API (`infra/relay_peer_service.py`) under gunicorn, fronted by Caddy for automatic HTTPS on a free `<ip>.sslip.io` hostname.
- `infra/harden-relay-service.sh` — upgrades an already-running relay from the old plain-HTTP setup to the gunicorn + Caddy one above, preserving its existing shared secret.
- `infra/relay_peer_service.py` — the API itself: adds/removes WireGuard peers on the live interface and reports real handshake status, authenticated by a shared secret header, never reachable directly from the internet (bound to localhost, Caddy terminates TLS in front of it).

### Deploying

The app deploys to Cloudflare Workers via Nitro:

```sh
npm run build
npx nitro deploy --prebuilt
```

This does **not** happen automatically on push — every change needs an explicit redeploy.

## Testing & CI

```sh
npm run test        # run the test suite once
npm run test:watch  # watch mode
npm run lint
npx tsc --noEmit -p tsconfig.json
```

`.github/workflows/ci.yml` runs typecheck, lint, tests, and a production build on every push and pull request. The CI build uses placeholder Supabase env vars (see the workflow file) so it doesn't need real secrets just to verify the app compiles — swap in real repository secrets if you want CI to exercise live Supabase calls.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- Supabase (auth + database + Edge Functions)
- WireGuard, Flask/gunicorn, and Caddy (the relay)