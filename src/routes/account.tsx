import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase, type ProfileRow, type WgPeerRow } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { AuthGate } from "../components/AuthGate";
import { generateWgKeyPair, buildWgClientConfig } from "../lib/wireguard";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [{ title: "Account — Kinetic" }],
  }),
  component: () => (
    <AuthGate>
      <Account />
    </AuthGate>
  ),
});

function Account() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [peers, setPeers] = useState<WgPeerRow[]>([]);
  const [loadingPeers, setLoadingPeers] = useState(true);
  const [generatingPeer, setGeneratingPeer] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadPeers = async (uid: string) => {
    const { data, error } = await supabase
      .from("wg_peers")
      .select("id, user_id, public_key, allowed_ip, label, created_at, revoked_at")
      .eq("user_id", uid)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Couldn't load your devices", { description: error.message });
    } else {
      setPeers(data ?? []);
    }
    setLoadingPeers(false);
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, created_at")
        .eq("id", user.id)
        .maybeSingle();
      if (error) {
        console.error(error);
        toast.error("Couldn't load your profile", { description: error.message });
      } else if (!cancelled && data) {
        setProfile(data);
        setDisplayName(data.display_name ?? "");
      }
      if (!cancelled) setLoadingProfile(false);
    })();
    loadPeers(user.id);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const generateDeviceConfig = async () => {
    if (!user) return;
    setGeneratingPeer(true);
    try {
      const { publicKey, privateKey } = generateWgKeyPair();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You're signed out — sign in again and retry.");
        return;
      }
      const { data, error } = await supabase.functions.invoke("wg-peers", {
        body: { action: "register", public_key: publicKey },
      });
      if (error) {
        toast.error("Couldn't register this device with the relay", {
          description: error.message,
        });
        return;
      }
      const { allowed_ip, server_public_key, endpoint } = data as {
        allowed_ip: string;
        server_public_key: string;
        endpoint: string;
      };
      const config = buildWgClientConfig({
        privateKey,
        clientAddress: allowed_ip,
        serverPublicKey: server_public_key,
        endpoint,
        dns: "10.8.0.1",
      });
      const blob = new Blob([config], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kinetic-relay.conf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Config downloaded", {
        description: "Import kinetic-relay.conf into the WireGuard app to connect for real.",
      });
      loadPeers(user.id);
    } catch (err) {
      toast.error("Couldn't generate a config", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setGeneratingPeer(false);
    }
  };

  const revokePeer = async (peer: WgPeerRow) => {
    setRevokingId(peer.id);
    try {
      const { error } = await supabase.functions.invoke("wg-peers", {
        body: { action: "revoke", public_key: peer.public_key },
      });
      if (error) {
        toast.error("Couldn't revoke this device", { description: error.message });
        return;
      }
      toast.success("Device revoked");
      setPeers((prev) => prev.filter((p) => p.id !== peer.id));
    } finally {
      setRevokingId(null);
    }
  };

  const saveDisplayName = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingName(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() || null })
        .eq("id", user.id);
      if (error) {
        toast.error("Couldn't save your name", { description: error.message });
      } else {
        toast.success("Display name updated");
        setProfile((p) => (p ? { ...p, display_name: displayName.trim() || null } : p));
      }
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordError(error.message);
      } else {
        toast.success("Password updated");
        setNewPassword("");
        setConfirmPassword("");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <Link to="/console" className="flex items-center gap-2">
            <div className="relative size-5 rounded-sm bg-primary">
              <div className="absolute inset-1 rounded-[2px] bg-background" />
            </div>
            <span className="text-mono text-xs font-semibold uppercase">Kinetic</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/console"
              className="text-mono rounded-md border border-border bg-surface px-3 py-1.5 text-[10px] uppercase text-foreground hover:bg-surface-2"
            >
              Console
            </Link>
            <button
              onClick={() => signOut()}
              className="text-mono rounded-md border border-border bg-surface px-3 py-1.5 text-[10px] uppercase text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-5 py-14">
        <p className="text-mono text-[10px] uppercase text-muted-foreground">// Account</p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">Your account</h1>

        <section className="mt-10 rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Profile</h2>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{user?.email}</dd>
            </div>
            {profile && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Member since</dt>
                <dd className="font-medium">
                  {new Date(profile.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </dd>
              </div>
            )}
          </dl>

          <form onSubmit={saveDisplayName} className="mt-6 space-y-3">
            <div>
              <label
                htmlFor="account-display-name"
                className="text-mono mb-1 block text-[10px] uppercase text-muted-foreground"
              >
                Display name
              </label>
              <input
                id="account-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loadingProfile}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
                placeholder="Your name"
              />
            </div>
            <button
              type="submit"
              disabled={savingName || loadingProfile}
              className="text-mono rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase text-primary-foreground disabled:opacity-60"
            >
              {savingName ? "Saving…" : "Save name"}
            </button>
          </form>
        </section>

        <section className="mt-6 rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Change password</h2>
          <form onSubmit={changePassword} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="account-new-password"
                className="text-mono mb-1 block text-[10px] uppercase text-muted-foreground"
              >
                New password
              </label>
              <input
                id="account-new-password"
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label
                htmlFor="account-confirm-password"
                className="text-mono mb-1 block text-[10px] uppercase text-muted-foreground"
              >
                Confirm new password
              </label>
              <input
                id="account-confirm-password"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                placeholder="••••••••"
              />
            </div>
            {passwordError && (
              <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                {passwordError}
              </p>
            )}
            <button
              type="submit"
              disabled={savingPassword}
              className="text-mono rounded-md border border-border bg-surface px-4 py-2 text-xs font-semibold uppercase text-foreground hover:bg-surface-2 disabled:opacity-60"
            >
              {savingPassword ? "Updating…" : "Update password"}
            </button>
          </form>
        </section>

        <section className="mt-6 rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">VPN connection</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This generates a real WireGuard device config against a live relay node — a browser
            can't open a VPN tunnel by itself, so you'll import the downloaded file into the{" "}
            <a
              href="https://www.wireguard.com/install/"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              official WireGuard app
            </a>{" "}
            (desktop or mobile) to actually connect. See the{" "}
            <Link to="/spec" className="underline hover:text-foreground">
              technical spec
            </Link>{" "}
            for what's real about this versus the rest of the console.
          </p>

          <button
            onClick={generateDeviceConfig}
            disabled={generatingPeer}
            className="text-mono mt-4 rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase text-primary-foreground disabled:opacity-60"
          >
            {generatingPeer ? "Registering with relay…" : "Generate new device config"}
          </button>

          <div className="mt-5">
            <h3 className="text-mono text-[10px] uppercase text-muted-foreground">
              Registered devices
            </h3>
            {loadingPeers ? (
              <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
            ) : peers.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No devices yet — generate a config above to connect one.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {peers.map((peer) => (
                  <li
                    key={peer.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{peer.allowed_ip}</p>
                      <p className="text-mono text-[10px] text-muted-foreground">
                        added {new Date(peer.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => revokePeer(peer)}
                      disabled={revokingId === peer.id}
                      className="text-mono rounded-md border border-border bg-surface px-3 py-1.5 text-[10px] uppercase text-muted-foreground hover:text-danger disabled:opacity-60"
                    >
                      {revokingId === peer.id ? "Revoking…" : "Revoke"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Plan</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You're on the free tier — every module is available, no billing connected yet.
          </p>
        </section>
      </div>
    </main>
  );
}
