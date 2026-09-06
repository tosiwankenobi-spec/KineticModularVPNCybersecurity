# Kinetic — Secure Shield

A modular VPN and cybersecurity console. Toggle only the protection you need — encrypted tunneling, malware shield, tracker blocker, adaptive firewall, private DNS, and identity masking — and see live memory/latency cost per module.

This project was originally scaffolded with [Lovable](https://lovable.dev) and is connected to it — see `AGENTS.md` for notes on keeping the synced branch in a working state.

## Status

- **Auth & persistence**: real, backed by Supabase (email/password auth, per-user module settings and alert history).
- **Network layer**: simulated. Toggling a module updates real, persisted state, but no traffic is actually routed through a VPN tunnel yet — see `supabase/migrations/0001_init.sql` for the `relay_nodes` / `sessions` tables laid down as groundwork for wiring in real relay infrastructure.

## Development

You'll need Node.js and a Supabase project.

```sh
git clone <this-repository-url>
cd <repository-name>
npm install
cp .env.local.example .env.local   # fill in your Supabase project URL + anon key
npm run dev
```

Run `supabase/migrations/0001_init.sql` once in your Supabase project's SQL Editor (Dashboard → SQL Editor → New query) before first use — it creates the `profiles`, `module_settings`, `alerts`, `relay_nodes`, and `sessions` tables with row-level security.

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
- Supabase (auth + database)
