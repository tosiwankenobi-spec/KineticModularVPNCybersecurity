import { createFileRoute, Link } from "@tanstack/react-router";
import { MODULES, MODULE_CATEGORIES, REGIONS } from "../lib/kinetic-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kinetic — Modular VPN & Cybersecurity" },
      {
        name: "description",
        content:
          "A modular VPN and cybersecurity system. Toggle only the protection you need — tunneling, malware shield, tracker blocker, firewall, DNS, and more.",
      },
      { property: "og:title", content: "Kinetic — Modular VPN & Cybersecurity" },
      {
        property: "og:description",
        content:
          "Turn protection on and off. Only run what you need. Tunneling, malware shield, tracker blocker, firewall, DNS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="relative size-5 rounded-sm bg-primary">
              <div className="absolute inset-1 rounded-[2px] bg-background" />
            </div>
            <span className="text-mono text-xs font-semibold uppercase">Kinetic</span>
          </div>
          <div className="hidden gap-6 text-xs text-muted-foreground sm:flex">
            <a href="#modules" className="hover:text-foreground">
              Modules
            </a>
            <a href="#nodes" className="hover:text-foreground">
              Nodes
            </a>
            <Link to="/pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <Link to="/spec" className="hover:text-foreground">
              Technical Spec
            </Link>
          </div>
          <Link
            to="/console"
            className="text-mono rounded-md border border-border bg-surface px-3 py-1.5 text-[10px] uppercase text-foreground hover:bg-surface-2"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[80%] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-5 py-10 sm:py-16">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1">
            <span className="size-1.5 rounded-full bg-primary" />
            <span className="text-mono text-[10px] uppercase text-primary">
              Modular protection stack
            </span>
          </div>

          <h1 className="max-w-2xl text-balance text-3xl font-semibold leading-tight sm:text-5xl">
            Modular defense. <span className="text-muted-foreground">Only run what you need.</span>
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-sm text-muted-foreground sm:text-base">
            Toggle protection modules independently — tunneling, malware, trackers, firewall, DNS.
            Every switch you leave off is memory, latency, and battery you keep.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Link
              to="/console"
              className="text-mono rounded-md bg-primary px-4 py-2.5 text-xs font-semibold uppercase text-primary-foreground glow-primary"
            >
              Start Free Trial
            </Link>
            <Link
              to="/spec"
              className="text-mono rounded-md border border-border bg-surface px-4 py-2.5 text-xs font-semibold uppercase text-foreground hover:bg-surface-2"
            >
              Technical Spec
            </Link>
          </div>
        </div>
      </section>

      {/* Modules preview */}
      <section id="modules" className="mx-auto max-w-6xl px-5 py-14">
        <div className="mb-8">
          <p className="text-mono text-[10px] uppercase text-muted-foreground">
            // Module registry
          </p>
          <h2 className="mt-1 text-2xl font-semibold sm:text-3xl">Protection modules</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Every module runs independently. Sign in to toggle them on and see live memory and
            latency cost.
          </p>
        </div>

        <div className="space-y-10">
          {MODULE_CATEGORIES.map((cat) => {
            const items = MODULES.filter((m) => m.category === cat);
            return (
              <div key={cat}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="text-mono text-[10px] uppercase text-muted-foreground">{cat}</div>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((m) => (
                    <div key={m.id} className="rounded-lg border border-border bg-surface/50 p-4">
                      <div className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                        <h3 className="text-base font-medium">{m.name}</h3>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground text-pretty">
                        {m.description}
                      </p>
                      <div className="text-mono mt-3 flex gap-4 text-[10px] uppercase text-muted-foreground">
                        <span>{m.loadMb}MB</span>
                        <span>+{m.latencyMs}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Nodes preview */}
      <section id="nodes" className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <p className="text-mono text-[10px] uppercase text-muted-foreground">
            // Relay selection
          </p>
          <h2 className="mt-1 text-2xl font-semibold sm:text-3xl">Choose an exit node</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Pick a relay region once you're signed in — the tunnel module routes through it.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {REGIONS.map((r) => (
              <div key={r.code} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <span className="text-mono text-[10px] uppercase text-muted-foreground">
                    {r.code}
                  </span>
                  <span className="text-mono text-[10px] text-muted-foreground">{r.ping}ms</span>
                </div>
                <div className="mt-3 text-base font-medium">{r.city}</div>
                <div className="text-xs text-muted-foreground">{r.country}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-14 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-semibold sm:text-2xl">Ship a footprint, not a suite.</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Start with the tunnel. Add modules as your threat model grows. Nothing runs unless you
              flip it on.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/console"
              className="text-mono rounded-md bg-primary px-4 py-2.5 text-xs font-semibold uppercase text-primary-foreground glow-primary"
            >
              Start Free Trial
            </Link>
            <Link
              to="/spec"
              className="text-mono rounded-md border border-border bg-surface px-4 py-2.5 text-xs font-semibold uppercase text-foreground hover:bg-surface-2"
            >
              Technical Spec
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 text-mono text-[10px] uppercase text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Kinetic Cybersecurity</span>
          <span>
            Protocol v4.2.0 ·{" "}
            <Link to="/privacy" className="underline hover:text-foreground">
              No logs · No telemetry
            </Link>
          </span>
        </div>
      </footer>
    </main>
  );
}
