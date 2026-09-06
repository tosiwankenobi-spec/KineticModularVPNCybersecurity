import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Kinetic" },
      {
        name: "description",
        content: "Kinetic pricing — what's available today and what's planned.",
      },
    ],
  }),
  component: Pricing,
});

type Tier = {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  available: boolean;
  cta: string;
};

const TIERS: Tier[] = [
  {
    name: "Free",
    price: "$0",
    description: "Every protection module, no card required.",
    features: [
      "All 8 protection modules",
      "1 device",
      "Alert history & saved settings",
      "Community support",
    ],
    available: true,
    cta: "Start free",
  },
  {
    name: "Pro",
    price: "$9",
    period: "/mo",
    description: "For people who need more than one device covered.",
    features: [
      "Everything in Free",
      "Unlimited devices",
      "Priority relay routing",
      "Priority support",
    ],
    available: false,
    cta: "Coming soon",
  },
  {
    name: "Team",
    price: "Custom",
    description: "Centralized admin for a whole team.",
    features: [
      "Everything in Pro",
      "Team seat management",
      "Centralized policy controls",
      "Dedicated support",
    ],
    available: false,
    cta: "Coming soon",
  },
];

function Pricing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
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
            Sign in
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-5 py-14">
        <p className="text-mono text-[10px] uppercase text-muted-foreground">// Pricing</p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">Simple, modular pricing</h1>
        <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
          Kinetic is free today — every module, no billing connected. Pro and Team tiers below are
          planned, not yet purchasable.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`flex flex-col rounded-lg border p-6 ${
                tier.available ? "border-primary/40 bg-surface" : "border-border bg-surface/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{tier.name}</h2>
                {!tier.available && (
                  <span className="text-mono rounded-full border border-border px-2 py-0.5 text-[9px] uppercase text-muted-foreground">
                    Planned
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-semibold">{tier.price}</span>
                {tier.period && (
                  <span className="text-sm text-muted-foreground">{tier.period}</span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-1 size-1 shrink-0 rounded-full bg-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {tier.available ? (
                <Link
                  to="/console"
                  className="text-mono mt-6 rounded-md bg-primary px-4 py-2 text-center text-xs font-semibold uppercase text-primary-foreground"
                >
                  {tier.cta}
                </Link>
              ) : (
                <button
                  disabled
                  className="text-mono mt-6 cursor-not-allowed rounded-md border border-border bg-surface px-4 py-2 text-xs font-semibold uppercase text-muted-foreground"
                >
                  {tier.cta}
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          No billing provider is connected yet, so Pro and Team can't be purchased today — this page
          shows the planned structure, not live checkout. See the{" "}
          <Link to="/spec" className="underline hover:text-foreground">
            technical spec
          </Link>{" "}
          for what's actually implemented.
        </p>
      </div>
    </main>
  );
}
