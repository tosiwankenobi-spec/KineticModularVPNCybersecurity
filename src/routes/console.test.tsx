import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MODULES } from "../lib/kinetic-data";

// --- Mock @tanstack/react-router -------------------------------------------------
// Console renders <Link> in its nav; real Link needs a router context we don't
// have in a unit test. createFileRoute's return value is only used here to read
// back the `component` option, so both are replaced with minimal stand-ins.
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

// --- Mock sonner -------------------------------------------------------------
vi.mock("sonner", () => {
  const fn = vi.fn();
  return { toast: Object.assign(fn, { success: vi.fn(), error: vi.fn(), warning: vi.fn() }) };
});

// --- Mock ../lib/auth ---------------------------------------------------------
// IMPORTANT: return a stable object reference. console.tsx's data-loading
// effects depend on `[user]`, so a fresh object literal on every render would
// break referential equality and re-trigger seeding/loading on every render.
const signOut = vi.fn();
const mockAuthUser = { id: "user-1", email: "jane@example.com" };
const mockAuthValue = {
  user: mockAuthUser,
  session: { user: mockAuthUser },
  loading: false,
  signOut,
};
vi.mock("../lib/auth", () => ({
  useAuth: () => mockAuthValue,
}));

// --- Mock ../lib/supabase ------------------------------------------------------
// A minimal chainable query-builder fake. Each `supabase.from(table)` call gets
// a fresh builder; the *last operation verb* (select/upsert/update/insert/delete)
// determines which canned response is returned when the builder is awaited, and
// every call is recorded for assertions.
type Call = { table: string; op: string; args: unknown[] };

const { calls, responses, fromMock, channel, removeChannel } = vi.hoisted(() => {
  const calls: Call[] = [];
  const responses: Record<string, { data: unknown; error: unknown }> = {};

  function makeBuilder(table: string) {
    let op = "select";
    const setOp =
      (name: string) =>
      (...args: unknown[]) => {
        op = name;
        calls.push({ table, op: name, args });
        return builder;
      };
    const chainOnly =
      (name: string) =>
      (...args: unknown[]) => {
        calls.push({ table, op: `${op}.${name}`, args });
        return builder;
      };
    const builder: Record<string, unknown> = {};
    builder.select = setOp("select");
    builder.upsert = setOp("upsert");
    builder.update = setOp("update");
    builder.insert = setOp("insert");
    builder.delete = setOp("delete");
    builder.eq = chainOnly("eq");
    builder.order = chainOnly("order");
    builder.limit = chainOnly("limit");
    builder.maybeSingle = chainOnly("maybeSingle");
    builder.then = (
      resolve: (v: { data: unknown; error: unknown }) => unknown,
      reject: (e: unknown) => unknown,
    ) => {
      const key = `${table}:${op}`;
      const result = responses[key] ?? { data: null, error: null };
      return Promise.resolve(result).then(resolve, reject);
    };
    return builder;
  }

  const fromMock = vi.fn((table: string) => makeBuilder(table));

  // Minimal chainable fake for the Realtime channel console.tsx subscribes
  // to (`.channel(...).on(...).subscribe()`) plus the `.removeChannel(...)`
  // cleanup call — neither is exercised by these tests, they just need to
  // exist so the subscription effect doesn't throw.
  const channelMock: Record<string, unknown> = {};
  channelMock.on = vi.fn(() => channelMock);
  channelMock.subscribe = vi.fn(() => channelMock);
  const channel = vi.fn(() => channelMock);
  const removeChannel = vi.fn();

  return { calls, responses, fromMock, channel, removeChannel };
});

vi.mock("../lib/supabase", () => ({
  supabase: { from: fromMock, channel, removeChannel },
}));

// Import Console's route *after* the mocks above are registered.
const { Route } = await import("./console");
const ConsoleRoute = (Route as unknown as { component: React.ComponentType }).component;

beforeEach(() => {
  calls.length = 0;
  Object.keys(responses).forEach((k) => delete responses[k]);
  signOut.mockClear();
  // Sensible defaults: no saved settings/alerts yet (first-login path).
  responses["module_settings:select"] = { data: [], error: null };
  responses["alerts:select"] = { data: [], error: null };
});

describe("Console", () => {
  it("seeds default module settings in Supabase on first login", async () => {
    render(<ConsoleRoute />);

    await waitFor(() => {
      const seedCall = calls.find((c) => c.table === "module_settings" && c.op === "upsert");
      expect(seedCall).toBeDefined();
    });

    const seedCall = calls.find((c) => c.table === "module_settings" && c.op === "upsert")!;
    const seeded = seedCall.args[0] as Array<{ module_id: string; enabled: boolean }>;
    expect(seeded).toHaveLength(MODULES.length);
    for (const m of MODULES) {
      expect(seeded).toContainEqual(
        expect.objectContaining({ module_id: m.id, enabled: m.defaultOn }),
      );
    }
  });

  it("loads existing saved settings instead of re-seeding, and reflects them in the UI", async () => {
    // Malware Shield defaults to "on" — override it to "off" via a saved setting.
    responses["module_settings:select"] = {
      data: [{ module_id: "malware", enabled: false }],
      error: null,
    };

    render(<ConsoleRoute />);

    const toggle = await screen.findByRole("switch", { name: /toggle malware shield/i });
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "false"));

    // Since settings already exist, the seeding upsert must not run.
    expect(calls.some((c) => c.table === "module_settings" && c.op === "upsert")).toBe(false);
  });

  it("persists a toggle to module_settings and logs an alert", async () => {
    const user = userEvent.setup();
    render(<ConsoleRoute />);

    // Adaptive Firewall defaults to off; wait for initial load to settle first.
    const toggle = await screen.findByRole("switch", { name: /toggle adaptive firewall/i });
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "false"));

    await user.click(toggle);

    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));

    const persistCall = calls.find(
      (c) =>
        c.table === "module_settings" &&
        c.op === "upsert" &&
        (c.args[0] as { module_id: string }).module_id === "firewall",
    );
    expect(persistCall).toBeDefined();
    expect((persistCall!.args[0] as { enabled: boolean }).enabled).toBe(true);

    const alertInsert = calls.find((c) => c.table === "alerts" && c.op === "insert");
    expect(alertInsert).toBeDefined();
    expect((alertInsert!.args[0] as { module_id: string }).module_id).toBe("firewall");
  });

  it("clears alert history via a real delete, not just local state", async () => {
    responses["alerts:select"] = {
      data: [
        {
          id: "a1",
          level: "info",
          module_id: "dns",
          title: "DNS query masked",
          detail: "Resolved example.com",
          read: false,
          created_at: new Date().toISOString(),
        },
      ],
      error: null,
    };

    const user = userEvent.setup();
    render(<ConsoleRoute />);

    const bell = await screen.findByRole("button", { name: /open notifications/i });
    await user.click(bell);

    const clearButton = await screen.findByRole("button", { name: /^clear$/i });
    await user.click(clearButton);

    await waitFor(() => {
      expect(calls.some((c) => c.table === "alerts" && c.op === "delete")).toBe(true);
    });
  });

  it("calls signOut when the sign-out button is clicked", async () => {
    const user = userEvent.setup();
    render(<ConsoleRoute />);

    const signOutButton = await screen.findByRole("button", { name: /sign out/i });
    await user.click(signOutButton);

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("Enable All persists every module as enabled and updates every switch", async () => {
    const user = userEvent.setup();
    render(<ConsoleRoute />);

    // Wait for initial seed to complete so we're not racing it.
    await waitFor(() => {
      expect(calls.some((c) => c.table === "module_settings" && c.op === "upsert")).toBe(true);
    });
    calls.length = 0;

    await user.click(screen.getByRole("button", { name: /^enable all$/i }));

    await waitFor(() => {
      const switches = screen.getAllByRole("switch");
      expect(switches).toHaveLength(MODULES.length);
      for (const s of switches) {
        expect(s).toHaveAttribute("aria-checked", "true");
      }
    });

    const upserts = calls.filter((c) => c.table === "module_settings" && c.op === "upsert");
    expect(upserts).toHaveLength(MODULES.length);
    for (const c of upserts) {
      expect((c.args[0] as { enabled: boolean }).enabled).toBe(true);
    }
  });
});
