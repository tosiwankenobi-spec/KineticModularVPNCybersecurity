import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { AuthGate } from "../components/AuthGate";
import {
  MODULES,
  MODULE_CATEGORIES,
  REGIONS,
  type AlertLevel,
  type Module,
  type ModuleId,
} from "../lib/kinetic-data";
import { formatRelativeTime } from "../lib/format";

export const Route = createFileRoute("/console")({
  head: () => ({
    meta: [{ title: "Console — Kinetic" }],
  }),
  component: () => (
    <AuthGate>
      <Console />
    </AuthGate>
  ),
});

type Alert = {
  id: string;
  level: AlertLevel;
  moduleId?: ModuleId;
  title: string;
  detail: string;
  ts: number;
  read: boolean;
};

// The tunnel's on/off state used to be a user preference like every other
// module, but it's now derived from the relay's real WireGuard handshake
// status (see the `status` action on the wg-peers Edge Function) — so it's
// excluded from the toggleable set, from `module_settings` persistence, and
// from the modules grid's switches.
type ToggleModuleId = Exclude<ModuleId, "tunnel">;
const TOGGLE_MODULES = MODULES.filter((m) => m.id !== "tunnel") as Array<
  Module & { id: ToggleModuleId }
>;
const TUNNEL_MODULE = MODULES.find((m) => m.id === "tunnel")!;

type TunnelPeer = {
  public_key: string;
  allowed_ip: string;
  label: string | null;
  registered: boolean;
  connected: boolean;
  latest_handshake: number | null;
};

function Console() {
  const { user, signOut } = useAuth();
  const [enabled, setEnabled] = useState<Record<ToggleModuleId, boolean>>(() =>
    TOGGLE_MODULES.reduce(
      (acc, m) => ({ ...acc, [m.id]: m.defaultOn }),
      {} as Record<ToggleModuleId, boolean>,
    ),
  );
  // null = status hasn't loaded yet; [] = loaded, no devices registered.
  const [tunnelPeers, setTunnelPeers] = useState<TunnelPeer[] | null>(null);
  const [region, setRegion] = useState(REGIONS[0]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [centerOpen, setCenterOpen] = useState(false);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  // Load this user's persisted module settings from Supabase, seeding
  // defaults on first login.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("module_settings")
        .select("module_id, enabled")
        .eq("user_id", user.id);
      if (error) {
        console.error(error);
        toast.error("Couldn't load your saved settings", {
          description: error.message,
        });
        return;
      }
      if (cancelled) return;
      if (data && data.length > 0) {
        setEnabled((prev) => {
          const next = { ...prev };
          for (const row of data) {
            if (row.module_id in next) {
              next[row.module_id as ToggleModuleId] = row.enabled;
            }
          }
          return next;
        });
      } else {
        const defaults = TOGGLE_MODULES.map((m) => ({
          user_id: user.id,
          module_id: m.id,
          enabled: m.defaultOn,
        }));
        const { error: seedError } = await supabase
          .from("module_settings")
          .upsert(defaults, { onConflict: "user_id,module_id" });
        if (seedError) console.error(seedError);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Poll the relay (via the wg-peers Edge Function) for this user's real
  // WireGuard connection status — registered peers and whether each has a
  // recent handshake. 15s balances freshness against load; a handshake is
  // required at least every 120s (WireGuard's REKEY_AFTER_TIME) while a
  // client is actually connected, so this polling interval comfortably
  // catches a state change.
  const fetchTunnelStatus = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("wg-peers", {
      body: { action: "status" },
    });
    if (error) {
      console.error(error);
      return;
    }
    setTunnelPeers((data as { peers: TunnelPeer[] } | null)?.peers ?? []);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchTunnelStatus();
    const interval = setInterval(fetchTunnelStatus, 15_000);
    return () => clearInterval(interval);
  }, [user, fetchTunnelStatus]);

  // Load this user's alert history from Supabase.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        console.error(error);
        return;
      }
      if (cancelled || !data) return;
      setAlerts(
        data.map((row) => ({
          id: row.id,
          level: row.level as AlertLevel,
          moduleId: (row.module_id as ModuleId) ?? undefined,
          title: row.title,
          detail: row.detail,
          ts: new Date(row.created_at).getTime(),
          read: row.read,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const pushAlert = useCallback((a: Omit<Alert, "id" | "ts" | "read">) => {
    const alert: Alert = {
      ...a,
      id: crypto.randomUUID(),
      ts: Date.now(),
      read: false,
    };
    setAlerts((prev) => [alert, ...prev].slice(0, 50));
    const opts = { description: a.detail };
    if (a.level === "danger") toast.error(a.title, opts);
    else if (a.level === "warn") toast.warning(a.title, opts);
    else if (a.level === "success") toast.success(a.title, opts);
    else toast(a.title, opts);

    const uid = userIdRef.current;
    if (uid) {
      supabase
        .from("alerts")
        .insert({
          id: alert.id,
          user_id: uid,
          module_id: a.moduleId ?? null,
          level: a.level,
          title: a.title,
          detail: a.detail,
        })
        .then(({ error }) => {
          if (error) console.error(error);
        });
    }
  }, []);

  // Real tunnel state, derived from the relay poll above rather than a
  // stored preference.
  const hasTunnelDevice = (tunnelPeers?.length ?? 0) > 0;
  const tunnelConnected = tunnelPeers?.some((p) => p.connected) ?? false;
  const latestTunnelHandshake = useMemo(() => {
    if (!tunnelPeers) return null;
    return tunnelPeers.reduce<number | null>((latest, p) => {
      if (p.latest_handshake == null) return latest;
      return latest == null || p.latest_handshake > latest ? p.latest_handshake : latest;
    }, null);
  }, [tunnelPeers]);

  const activeCount = useMemo(
    () => Object.values(enabled).filter(Boolean).length + (tunnelConnected ? 1 : 0),
    [enabled, tunnelConnected],
  );
  const load = useMemo(
    () =>
      TOGGLE_MODULES.reduce((sum, m) => (enabled[m.id] ? sum + m.loadMb : sum), 0) +
      (tunnelConnected ? TUNNEL_MODULE.loadMb : 0),
    [enabled, tunnelConnected],
  );
  const latency = useMemo(
    () =>
      TOGGLE_MODULES.reduce((sum, m) => (enabled[m.id] ? sum + m.latencyMs : sum), 0) +
      (tunnelConnected ? TUNNEL_MODULE.latencyMs : 0) +
      region.ping,
    [enabled, tunnelConnected, region],
  );
  const unread = alerts.filter((a) => !a.read).length;

  const persistModuleSetting = (id: ToggleModuleId, on: boolean) => {
    const uid = userIdRef.current;
    if (!uid) return;
    supabase
      .from("module_settings")
      .upsert(
        {
          user_id: uid,
          module_id: id,
          enabled: on,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,module_id" },
      )
      .then(({ error }) => {
        if (error) console.error(error);
      });
  };

  const toggle = (id: ToggleModuleId) => {
    setEnabled((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const mod = TOGGLE_MODULES.find((m) => m.id === id)!;
      const nowOn = next[id];
      persistModuleSetting(id, nowOn);
      if (nowOn) {
        pushAlert({
          level: "success",
          moduleId: id,
          title: `${mod.name} engaged`,
          detail: `Module running (+${mod.latencyMs}ms · ${mod.loadMb}MB)`,
        });
      } else {
        pushAlert({
          level: "warn",
          moduleId: id,
          title: `${mod.name} disabled`,
          detail: "Protection module was turned off.",
        });
      }
      return next;
    });
  };

  const setAll = (on: boolean) => {
    setEnabled(
      TOGGLE_MODULES.reduce(
        (acc, m) => ({ ...acc, [m.id]: on }),
        {} as Record<ToggleModuleId, boolean>,
      ),
    );
    TOGGLE_MODULES.forEach((m) => persistModuleSetting(m.id, on));
    pushAlert({
      level: on ? "success" : "warn",
      title: on ? "All modules engaged" : "All modules disabled",
      detail: on ? "Full protection stack is active." : "System is running unprotected.",
    });
  };

  const markAllRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    const uid = userIdRef.current;
    if (uid) {
      supabase
        .from("alerts")
        .update({ read: true })
        .eq("user_id", uid)
        .then(({ error }) => {
          if (error) console.error(error);
        });
    }
  };

  const clearAll = () => {
    setAlerts([]);
    const uid = userIdRef.current;
    if (uid) {
      supabase
        .from("alerts")
        .delete()
        .eq("user_id", uid)
        .then(({ error }) => {
          if (error) console.error(error);
        });
    }
  };

  // Subscribe to real alerts as they land in the database — either from
  // this device's own toggle actions (already added locally, filtered out
  // below to avoid a duplicate) or from the relay reporting a genuinely
  // blocked request from one of this user's connected devices.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`alerts-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alerts",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            level: AlertLevel;
            module_id: ModuleId | null;
            title: string;
            detail: string;
            created_at: string;
          };
          setAlerts((prev) => {
            if (prev.some((a) => a.id === row.id)) return prev;
            const alert: Alert = {
              id: row.id,
              level: row.level,
              moduleId: row.module_id ?? undefined,
              title: row.title,
              detail: row.detail,
              ts: new Date(row.created_at).getTime(),
              read: false,
            };
            const opts = { description: alert.detail };
            if (alert.level === "danger") toast.error(alert.title, opts);
            else if (alert.level === "warn") toast.warning(alert.title, opts);
            else if (alert.level === "success") toast.success(alert.title, opts);
            else toast(alert.title, opts);
            return [alert, ...prev].slice(0, 50);
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2">
            <div className="relative size-5 rounded-sm bg-primary">
              <div className="absolute inset-1 rounded-[2px] bg-background" />
            </div>
            <span className="text-mono text-xs font-semibold uppercase">Kinetic</span>
          </Link>
          <div className="hidden gap-6 text-xs text-muted-foreground sm:flex">
            <a href="#modules" className="hover:text-foreground">
              Modules
            </a>
            <a href="#status" className="hover:text-foreground">
              Status
            </a>
            <a href="#nodes" className="hover:text-foreground">
              Nodes
            </a>
          </div>
          <button
            onClick={() => setCenterOpen(true)}
            aria-label="Open notifications"
            className="relative rounded-md border border-border bg-surface p-2 text-muted-foreground hover:text-foreground"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {unread > 0 && (
              <span className="text-mono absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
          {user && (
            <div className="ml-2 flex items-center gap-2">
              <Link
                to="/account"
                className="text-mono hidden text-[10px] uppercase text-muted-foreground hover:text-foreground sm:inline"
              >
                {user.email}
              </Link>
              <button
                onClick={() => signOut()}
                className="text-mono rounded-md border border-border bg-surface px-2 py-1.5 text-[10px] uppercase text-muted-foreground hover:text-foreground"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero / status console */}
      <section id="status" className="relative overflow-hidden border-b border-border">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[80%] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-5 py-10 sm:py-16">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1">
            <span
              className={`size-1.5 rounded-full ${
                tunnelConnected ? "bg-primary animate-pulse" : "bg-muted-foreground"
              }`}
            />
            <span className="text-mono text-[10px] uppercase text-primary">
              {tunnelPeers === null
                ? "Checking Tunnel…"
                : !hasTunnelDevice
                  ? "No Device Registered"
                  : tunnelConnected
                    ? "Tunnel Active"
                    : "Tunnel Offline"}
            </span>
            {tunnelConnected && latestTunnelHandshake != null && (
              <span className="text-mono text-[10px] text-primary/70">
                · last handshake {formatRelativeTime(latestTunnelHandshake * 1000)}
              </span>
            )}
          </div>

          <h1 className="max-w-2xl text-balance text-3xl font-semibold leading-tight sm:text-5xl">
            Your protection console.
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-sm text-muted-foreground sm:text-base">
            Toggle protection modules independently — tunneling, malware, trackers, firewall, DNS.
            Every switch you leave off is memory, latency, and battery you keep.
          </p>

          {/* Live console */}
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <StatTile
              label="Modules Active"
              value={`${activeCount}`}
              hint={`of ${MODULES.length}`}
              tone="primary"
            />
            <StatTile label="Memory Load" value={`${load}`} hint="MB resident" tone="foreground" />
            <StatTile
              label="Route Latency"
              value={`${latency}`}
              hint="ms end-to-end"
              tone="accent"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              to="/account"
              className={`text-mono inline-block rounded-md px-4 py-2 text-xs font-semibold uppercase transition ${
                tunnelConnected
                  ? "bg-primary text-primary-foreground glow-primary"
                  : "border border-border bg-surface text-foreground hover:bg-surface-2"
              }`}
            >
              {!hasTunnelDevice
                ? "Register a Device"
                : tunnelConnected
                  ? "Tunnel Engaged"
                  : "Manage Devices"}
            </Link>
            <button
              onClick={() => setAll(true)}
              className="text-mono rounded-md border border-border bg-surface px-3 py-2 text-[10px] uppercase text-muted-foreground hover:text-foreground"
            >
              Enable All
            </button>
            <button
              onClick={() => setAll(false)}
              className="text-mono rounded-md border border-border bg-surface px-3 py-2 text-[10px] uppercase text-muted-foreground hover:text-foreground"
            >
              Disable All
            </button>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="mx-auto max-w-6xl px-5 py-14">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-mono text-[10px] uppercase text-muted-foreground">
              // Module registry
            </p>
            <h2 className="mt-1 text-2xl font-semibold sm:text-3xl">Protection modules</h2>
          </div>
          <div className="text-mono hidden text-[10px] uppercase text-muted-foreground sm:block">
            {activeCount} / {MODULES.length} running
          </div>
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
                  {items.map((m) =>
                    m.id === "tunnel" ? (
                      <TunnelStatusCard
                        key={m.id}
                        module={m}
                        loading={tunnelPeers === null}
                        hasDevice={hasTunnelDevice}
                        connected={tunnelConnected}
                        latestHandshake={latestTunnelHandshake}
                      />
                    ) : (
                      <ModuleCard
                        key={m.id}
                        module={m}
                        on={enabled[m.id as ToggleModuleId]}
                        onToggle={() => toggle(m.id as ToggleModuleId)}
                      />
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Nodes */}
      <section id="nodes" className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <p className="text-mono text-[10px] uppercase text-muted-foreground">
            // Relay selection
          </p>
          <h2 className="mt-1 text-2xl font-semibold sm:text-3xl">Choose an exit node</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            The tunnel module routes through the node you pick. Latency updates live in the status
            console.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {REGIONS.map((r) => {
              const active = r.code === region.code;
              return (
                <button
                  key={r.code}
                  onClick={() => setRegion(r)}
                  className={`text-left rounded-lg border p-4 transition ${
                    active
                      ? "border-primary bg-primary/5 glow-primary"
                      : "border-border bg-surface hover:bg-surface-2"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-mono text-[10px] uppercase text-muted-foreground">
                      {r.code}
                    </span>
                    <span
                      className={`text-mono text-[10px] ${
                        active ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {r.ping}ms
                    </span>
                  </div>
                  <div className="mt-3 text-base font-medium">{r.city}</div>
                  <div className="text-xs text-muted-foreground">{r.country}</div>
                </button>
              );
            })}
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

      <NotificationCenter
        open={centerOpen}
        onClose={() => setCenterOpen(false)}
        alerts={alerts}
        onMarkAllRead={markAllRead}
        onClear={clearAll}
      />
    </main>
  );
}

function NotificationCenter({
  open,
  onClose,
  alerts,
  onMarkAllRead,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  alerts: Alert[];
  onMarkAllRead: () => void;
  onClear: () => void;
}) {
  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-background/60 backdrop-blur-sm transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-mono text-[10px] uppercase text-muted-foreground">
              // Notification center
            </p>
            <h2 className="mt-0.5 text-lg font-semibold">Alerts</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-border p-2 text-muted-foreground hover:text-foreground"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex items-center justify-between border-b border-border px-5 py-2">
          <span className="text-mono text-[10px] uppercase text-muted-foreground">
            {alerts.length} event{alerts.length === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onMarkAllRead}
              className="text-mono text-[10px] uppercase text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              onClick={onClear}
              className="text-mono text-[10px] uppercase text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
              <div className="size-2 rounded-full bg-primary" />
              <p className="text-mono text-[10px] uppercase text-muted-foreground">All clear</p>
              <p className="text-sm text-muted-foreground">
                No active alerts. Modules will surface events here as they happen.
              </p>
            </div>
          ) : (
            <ul>
              {alerts.map((a) => (
                <AlertRow key={a.id} alert={a} />
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const tone =
    alert.level === "danger"
      ? "bg-danger"
      : alert.level === "warn"
        ? "bg-accent"
        : alert.level === "success"
          ? "bg-primary"
          : "bg-muted-foreground";
  return (
    <li className="flex gap-3 border-b border-border px-5 py-4">
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${tone}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{alert.title}</p>
          <span className="text-mono shrink-0 text-[10px] uppercase text-muted-foreground">
            {formatRelativeTime(alert.ts)}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground text-pretty">{alert.detail}</p>
      </div>
    </li>
  );
}

function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "primary" | "accent" | "foreground";
}) {
  const toneClass =
    tone === "primary" ? "text-primary" : tone === "accent" ? "text-accent" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-surface/60 p-4 backdrop-blur">
      <div className="text-mono text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-3xl font-semibold tabular-nums ${toneClass}`}>{value}</span>
        <span className="text-mono text-[10px] uppercase text-muted-foreground">{hint}</span>
      </div>
    </div>
  );
}

function TunnelStatusCard({
  module,
  loading,
  hasDevice,
  connected,
  latestHandshake,
}: {
  module: Module;
  loading: boolean;
  hasDevice: boolean;
  connected: boolean;
  latestHandshake: number | null;
}) {
  const statusLabel = loading
    ? "Checking…"
    : !hasDevice
      ? "No Device"
      : connected
        ? "Connected"
        : "Offline";
  return (
    <div
      className={`group relative rounded-lg border p-4 transition ${
        connected ? "border-primary/40 bg-surface" : "border-border bg-surface/50"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`size-1.5 rounded-full ${
                connected ? "bg-primary animate-pulse" : "bg-muted-foreground/60"
              }`}
            />
            <h3 className="text-base font-medium">{module.name}</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">{module.description}</p>
          <div className="text-mono mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase text-muted-foreground">
            <span>{module.loadMb}MB</span>
            <span>+{module.latencyMs}ms</span>
            <span className={connected ? "text-primary" : ""}>{statusLabel}</span>
            {connected && latestHandshake != null && (
              <span>handshake {formatRelativeTime(latestHandshake * 1000)}</span>
            )}
          </div>
        </div>
        <Link
          to="/account"
          className="text-mono shrink-0 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-[10px] uppercase text-muted-foreground hover:text-foreground"
        >
          {hasDevice ? "Manage" : "Connect"}
        </Link>
      </div>
    </div>
  );
}

function ModuleCard({
  module,
  on,
  onToggle,
}: {
  module: Module;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`group relative rounded-lg border p-4 transition ${
        on ? "border-primary/40 bg-surface" : "border-border bg-surface/50"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`size-1.5 rounded-full ${on ? "bg-primary" : "bg-muted-foreground/60"}`}
            />
            <h3 className="text-base font-medium">{module.name}</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">{module.description}</p>
          <div className="text-mono mt-3 flex gap-4 text-[10px] uppercase text-muted-foreground">
            <span>{module.loadMb}MB</span>
            <span>+{module.latencyMs}ms</span>
            <span className={on ? "text-primary" : ""}>{on ? "Running" : "Off"}</span>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={on}
          aria-label={`Toggle ${module.name}`}
          onClick={onToggle}
          className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
            on ? "border-primary bg-primary/20" : "border-border bg-surface-2"
          }`}
        >
          <span
            className={`absolute top-0.5 size-4 rounded-full transition-all ${
              on
                ? "left-[calc(100%-1.125rem)] bg-primary shadow-[0_0_8px_var(--primary)]"
                : "left-0.5 bg-muted-foreground"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
