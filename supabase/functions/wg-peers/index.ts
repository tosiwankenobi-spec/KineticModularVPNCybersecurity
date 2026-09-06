// Supabase Edge Function: register or revoke a WireGuard peer.
//
// Why this exists as a server-side function rather than a direct client
// insert into `wg_peers`: IP assignment has to be single-writer (two users
// registering at once must not get the same 10.8.0.x address), and actually
// activating a peer means calling the relay's peer-add service with a
// shared secret that must never reach the browser. This function holds
// both of those responsibilities behind the user's verified JWT.
//
// Deploy with:
//   supabase functions deploy wg-peers
// Required secrets (supabase secrets set):
//   RELAY_URL          e.g. http://104.154.119.10:8787
//   RELAY_SHARED_SECRET  the secret printed by relay-setup.sh
//   RELAY_SERVER_PUBLIC_KEY  the relay's WireGuard public key
//   RELAY_ENDPOINT      e.g. 104.154.119.10:51820
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically to
// every Edge Function by the Supabase runtime — no need to set them.

import { createClient } from "jsr:@supabase/supabase-js@2";

const TUNNEL_SUBNET_PREFIX = "10.8.0.";
const FIRST_CLIENT_OCTET = 2; // .1 is the relay itself
const LAST_CLIENT_OCTET = 254;

// Browsers call this function directly (via supabase.functions.invoke), so
// it needs its own CORS headers — Supabase does not add these for you.
// Wide open (*) is fine here: the function is protected by JWT auth, not by
// origin restriction, same as any other public API endpoint.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...(init.headers ?? {}) },
  });
}

Deno.serve(async (req: Request) => {
  // Preflight request — browsers send this before the real POST.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Verify the caller's JWT using the anon client (does not bypass auth).
  const authedClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authError,
  } = await authedClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: "Not authenticated" }, { status: 401 });
  }

  // Service-role client for the writes RLS would otherwise block.
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const body = await req.json().catch(() => null);
  const action = body?.action as string | undefined;

  const relayUrl = Deno.env.get("RELAY_URL");
  const relaySecret = Deno.env.get("RELAY_SHARED_SECRET");
  if (!relayUrl || !relaySecret) {
    return jsonResponse(
      { error: "Relay is not configured yet" },
      {
        status: 503,
      },
    );
  }

  if (action === "register") {
    const publicKey = body?.public_key as string | undefined;
    const label = (body?.label as string | undefined) ?? null;
    if (!publicKey) {
      return jsonResponse({ error: "public_key is required" }, { status: 400 });
    }

    // Pick the next free address in the tunnel subnet.
    const { data: existing, error: listError } = await admin
      .from("wg_peers")
      .select("allowed_ip")
      .is("revoked_at", null);
    if (listError) {
      return jsonResponse({ error: listError.message }, { status: 500 });
    }
    const used = new Set(
      (existing ?? []).map((row: { allowed_ip: string }) => Number(row.allowed_ip.split(".")[3])),
    );
    let octet = FIRST_CLIENT_OCTET;
    while (used.has(octet) && octet <= LAST_CLIENT_OCTET) octet++;
    if (octet > LAST_CLIENT_OCTET) {
      return jsonResponse(
        { error: "Relay tunnel subnet is full" },
        {
          status: 503,
        },
      );
    }
    const allowedIp = `${TUNNEL_SUBNET_PREFIX}${octet}`;

    // Activate the peer on the actual relay before we commit the row.
    const relayResp = await fetch(`${relayUrl}/add-peer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Peer-Secret": relaySecret },
      body: JSON.stringify({ public_key: publicKey, allowed_ip: allowedIp }),
    });
    if (!relayResp.ok) {
      return jsonResponse(
        { error: "Relay rejected the new peer" },
        {
          status: 502,
        },
      );
    }

    const { error: insertError } = await admin.from("wg_peers").insert({
      user_id: user.id,
      public_key: publicKey,
      allowed_ip: allowedIp,
      label,
    });
    if (insertError) {
      return jsonResponse({ error: insertError.message }, { status: 500 });
    }

    return jsonResponse({
      allowed_ip: allowedIp,
      server_public_key: Deno.env.get("RELAY_SERVER_PUBLIC_KEY"),
      endpoint: Deno.env.get("RELAY_ENDPOINT"),
    });
  }

  if (action === "revoke") {
    const publicKey = body?.public_key as string | undefined;
    if (!publicKey) {
      return jsonResponse({ error: "public_key is required" }, { status: 400 });
    }

    // Only allow revoking a peer that actually belongs to the caller.
    const { data: peer, error: peerError } = await admin
      .from("wg_peers")
      .select("id, user_id")
      .eq("public_key", publicKey)
      .maybeSingle();
    if (peerError || !peer || peer.user_id !== user.id) {
      return jsonResponse({ error: "Peer not found" }, { status: 404 });
    }

    await fetch(`${relayUrl}/remove-peer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Peer-Secret": relaySecret },
      body: JSON.stringify({ public_key: publicKey }),
    }).catch(() => null); // best-effort; still mark revoked below

    const { error: updateError } = await admin
      .from("wg_peers")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", peer.id);
    if (updateError) {
      return jsonResponse({ error: updateError.message }, { status: 500 });
    }

    return jsonResponse({ ok: true }, { status: 200 });
  }

  return jsonResponse({ error: "Unknown action" }, { status: 400 });
});
