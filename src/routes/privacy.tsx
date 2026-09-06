import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy & Security — Kinetic" },
      {
        name: "description",
        content: "What Kinetic actually collects, stores, and doesn't — in plain language.",
      },
    ],
  }),
  component: Privacy,
});

function Privacy() {
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
            to="/spec"
            className="text-mono rounded-md border border-border bg-surface px-3 py-1.5 text-[10px] uppercase text-foreground hover:bg-surface-2"
          >
            Technical spec
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-5 py-14">
        <p className="text-mono text-[10px] uppercase text-muted-foreground">
          // Privacy & security
        </p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">
          What we actually do with your data
        </h1>
        <p className="mt-4 text-sm text-muted-foreground sm:text-base">
          The footer of this site says "No logs · No telemetry." Here's exactly what that means and
          doesn't mean, in plain language, so you're not taking our word for it on faith.
        </p>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">What we collect</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your email address (for login), an optional display name, which protection modules you
            have toggled on, and your alert/notification history. That's it. It's stored in a
            Postgres database (Supabase) with row-level security enforced at the database level —
            every row is scoped to your account, so no other user, and no application code path, can
            read your data without your session's credentials.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">What "no telemetry" means today</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            There is no analytics or ad-tracking script anywhere in this app — no Google Analytics,
            no Meta Pixel, no product-analytics tool. We don't know how you use this site beyond
            what you explicitly save (your module settings and alert history). The codebase does
            contain an error-reporting hook left over from development in the Lovable editor; it
            only activates inside that editor's own preview environment and is inert — it does
            nothing — for anyone using the deployed app.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">What "no logs" means today — and its limit</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This is no longer purely hypothetical: there is one real WireGuard relay node (see the{" "}
            <Link to="/spec" className="underline hover:text-foreground">
              technical spec
            </Link>
            ), and traffic actually routed through it isn't inspected or written to any
            application-level log by this codebase — no request logging, no destination tracking.
            Treat that as an early, unaudited claim rather than a guarantee, though: the relay is a
            single stock Debian VM, standard OS/kernel-level logging (auth attempts, the systemd
            journal, etc.) is still on by default, and there hasn't been a hardening pass to disable
            or rotate that out yet. Everything else in the console — the module toggles, the
            simulated threat feed — still doesn't touch real traffic at all, so "no logs" is
            trivially true there. Any real no-logs claim should eventually be independently
            verifiable (a third-party audit, a warrant canary, etc.), not just asserted on this page
            — that hasn't happened yet, and we're not claiming it has.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Sessions & cookies</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We don't set tracking cookies. Your login session is a token stored in your browser's
            local storage by Supabase's auth client, used only to keep you signed in.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Third parties</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Supabase hosts our database and handles authentication — they're our infrastructure
            provider, not a party we share your data with for any other purpose.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Deleting your data</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You can clear your alert history at any time from the notification center — that's a
            real, permanent delete from the database, not a soft hide. Full self-service account
            deletion isn't built yet; we're noting that as a known gap rather than pretending it
            exists.
          </p>
        </section>

        <p className="mt-10 text-xs text-muted-foreground">
          This page describes current behavior, not a legal privacy policy — it will need one before
          any real user data or paid product ships. Treat it as an honest engineering account of
          what the code actually does today.
        </p>
      </div>
    </main>
  );
}
