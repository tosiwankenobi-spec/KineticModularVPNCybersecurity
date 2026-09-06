// Supabase Edge Function: receives a real blocked-DNS-query event from the
// relay VM and records it as an alert for whichever user owns that tunnel
// IP address. Called only by the relay's own blocked-query watcher script
// (see /opt/blocked-query-reporter.py on the relay) — never by the browser.
//
// Deploy with:
//   supabase functions deploy log-blocked-query
// Required secret (already set for wg-peers, reused here):
//   RELAY_SHARED_SECRET

import { createClient } from "jsr:@supabase/supabase-js@2";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  const relaySecret = Deno.env.get("RELAY_SHARED_SECRET");
  const providedSecret = req.headers.get("X-Peer-Secret");
  if (!relaySecret || providedSecret !== relaySecret) {
    return jsonResponse({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const clientIp = body?.client_ip as string | undefined;
  const domain = body?.domain as string | undefined;
  const category = body?.category as string | undefined;
  if (!clientIp || !domain || !category) {
    return jsonResponse(
      { error: "client_ip, domain, and category are required" },
      { status: 400 },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Find which signed-up user currently owns this tunnel IP address.
  const { data: peer, error: peerError } = await admin
    .from("wg_peers")
    .select("user_id")
    .eq("allowed_ip", clientIp)
    .is("revoked_at", null)
    .maybeSingle();
  if (peerError) {
    return jsonResponse({ error: peerError.message }, { status: 500 });
  }
  if (!peer) {
    // Not a currently-registered device (e.g. relay's own traffic) — nothing
    // to attach this alert to. Not an error condition.
    return jsonResponse({ ok: true, skipped: "no matching peer" });
  }

  const isMalware = category === "malware";
  const { error: insertError } = await admin.from("alerts").insert({
    user_id: peer.user_id,
    module_id: category,
    level: isMalware ? "danger" : "warn",
    title: isMalware ? "Malware domain blocked" : "Tracker blocked",
    detail: `Blocked connection to ${domain}`,
  });
  if (insertError) {
    return jsonResponse({ error: insertError.message }, { status: 500 });
  }

  return jsonResponse({ ok: true });
});
