import { createFileRoute, Link } from "@tanstack/react-router";
import { MODULES, MODULE_CATEGORIES, REGIONS } from "../lib/kinetic-data";

export const Route = createFileRoute("/spec")({
  head: () => ({
    meta: [
      { title: "Technical Spec — Kinetic" },
      {
        name: "description",
        content:
          "Architecture and current implementation status of the Kinetic protection console.",
      },
    ],
  }),
  component: Spec,
});

function Spec() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2">
            <div className="relative size-5 rounded-sm bg-primary">
              <div className="absolute inset-1 rounded-[2px] bg-background" />
            </div>
            <span className="text-mono text-xs font-semibold uppercase">Kinetic</span>
          </Link>
          <Link
            to="/console"
            className="text-mono rounded-md border border-border bg-surface px-3 py-1.5 text-[10px] uppercase text-foreground hover:bg-surface-2"
          >
            Open console
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-5 py-14">
        <p className="text-mono text-[10px] uppercase text-muted-foreground">// Technical spec</p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">Kinetic architecture</h1>
        <p className="mt-4 text-sm text-muted-foreground sm:text-base">
          This page describes what's actually implemented today, not aspirational claims. We'd
          rather you know exactly what you're getting.
        </p>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">What's real</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Accounts, authentication, and every piece of module/settings state are backed by a real
            Postgres database (Supabase) with row-level security, so your configuration and alert
            history persist across devices and sessions and are only ever readable by you.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            There is also one real WireGuard relay node running on Google Cloud (
            <code className="text-mono">us-central1</code>, a single{" "}
            <code className="text-mono">e2-micro</code> instance). From{" "}
            <Link to="/account" className="underline hover:text-foreground">
              your account page
            </Link>
            , "Generate new device config" creates a real Curve25519 keypair in your browser (the
            private key never leaves it), registers the public key with the relay through a Supabase
            Edge Function, and downloads a standard <code className="text-mono">.conf</code> file.
            Import that into the official WireGuard app and it opens a genuine encrypted tunnel to
            that relay — actual traffic, actually routed through it. A browser tab can't open a VPN
            tunnel on its own, which is why this is a download-and-import step rather than a button
            inside the console itself.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            The "Encrypted Tunnel" card in the console is also real, not simulated: it polls a{" "}
            <code className="text-mono">wg-peers</code> "status" action every 15 seconds, which asks
            the relay to run <code className="text-mono">wg show wg0 dump</code> and reports back
            each of your registered peers' actual handshake state. "Connected" means the relay saw a
            WireGuard handshake from your device within the last 3 minutes — not a stored
            preference, and not a value the console can fake.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">What's simulated (for now)</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Everything else inside the console — the other module toggles (malware shield, tracker
            blocker, adaptive firewall, etc.), the live threat-event feed, and the region picker —
            is still simulated. Toggling one of those modules updates real, persisted state and
            generates realistic sample events, but none of it inspects or routes real traffic yet,
            and it's entirely separate from the one real relay described above. There is currently
            one relay node, not the four regions listed below — those remain illustrative until more
            relays are provisioned and the module logic is actually wired to run against real
            traffic through them.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Module registry</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Modules are grouped into four categories and can be toggled independently. Each has an
            approximate memory and latency cost when active.
          </p>
          <div className="mt-4 space-y-6">
            {MODULE_CATEGORIES.map((cat) => (
              <div key={cat}>
                <h3 className="text-mono text-[10px] uppercase text-muted-foreground">{cat}</h3>
                <ul className="mt-2 space-y-2">
                  {MODULES.filter((m) => m.category === cat).map((m) => (
                    <li
                      key={m.id}
                      className="rounded-md border border-border bg-surface/50 p-3 text-sm"
                    >
                      <span className="font-medium">{m.name}</span>
                      <span className="text-muted-foreground"> — {m.description}</span>
                      <span className="text-mono ml-2 text-[10px] text-muted-foreground">
                        ({m.loadMb}MB, +{m.latencyMs}ms)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Relay regions</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Four exit-node regions are defined today. Ping figures are illustrative placeholders
            until real relays are provisioned.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {REGIONS.map((r) => (
              <li
                key={r.code}
                className="flex items-center justify-between rounded-md border border-border bg-surface/50 p-3 text-sm"
              >
                <span>
                  {r.city}, {r.country}
                </span>
                <span className="text-mono text-[10px] text-muted-foreground">
                  {r.code} · {r.ping}ms
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Data model</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            <code className="text-mono">profiles</code>,{" "}
            <code className="text-mono">module_settings</code>,{" "}
            <code className="text-mono">alerts</code>,{" "}
            <code className="text-mono">relay_nodes</code>,{" "}
            <code className="text-mono">sessions</code>, and{" "}
            <code className="text-mono">wg_peers</code> tables, all with row-level security scoping
            every row to its owning user. <code className="text-mono">relay_nodes</code> and{" "}
            <code className="text-mono">sessions</code> remain groundwork for a multi-region future.{" "}
            <code className="text-mono">wg_peers</code> backs the real relay: it records each
            device's public key and assigned tunnel IP, written only by a service-role Edge Function
            so IP assignment can't race across concurrent requests.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Relay peer registration</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The relay VM runs a small internal service (Flask, under gunicorn, systemd-managed) that
            adds, removes, and reports the live status of WireGuard peers on its interface. It's
            bound to localhost only —{" "}
            
              href="https://caddyserver.com/"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              Caddy
            </a>{" "}
            terminates HTTPS on the public side and reverse-proxies in, so the process that actually
            runs <code className="text-mono">wg</code> as root is never directly reachable from the
            internet. The Supabase Edge Function <code className="text-mono">wg-peers</code> is the
            only caller, authenticated with a shared secret set as a Supabase secret — never exposed
            to the browser — and both sides independently reject anything that isn't a well-formed
            WireGuard key before it's used.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Known tradeoff, disclosed rather than hidden: the shared secret is still the actual
            access control, not an IP allowlist, since Supabase Edge Functions don't publish a
            stable outbound IP range to restrict ingress to. TLS and the localhost bind are defense
            in depth on top of that, not a replacement for it.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Stack</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            TanStack Start, React, TypeScript, Tailwind CSS, and Supabase for auth and Postgres.
            Relay: Google Cloud Compute Engine (e2-micro), WireGuard, a Supabase Edge Function
            (Deno) for peer registration.
          </p>
        </section>
      </div>
    </main>
  );
}