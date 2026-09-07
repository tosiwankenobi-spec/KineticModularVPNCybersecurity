#!/usr/bin/env python3
"""Peer-registration API for a Kinetic WireGuard relay.

Runs on the relay VM itself (not in Supabase). Listens for authenticated
requests from the `wg-peers` Supabase Edge Function and adds/removes
WireGuard peers on the live `wg0` interface, persisting changes to
/etc/wireguard/wg0.conf so they survive a reboot.

Production posture (see infra/harden-relay-service.sh): this process is run
under gunicorn, bound to 127.0.0.1 only — it is never reachable from the
public internet directly. Caddy terminates TLS on the public-facing port and
reverse-proxies to this process locally. The `X-Peer-Secret` header is still
required on every request; that's real access control, TLS/localhost-binding
is defense in depth on top of it, not a replacement for it. (Earlier
versions of this file ran via `python3 relay_peer_service.py`, i.e. Flask's
own dev server bound to 0.0.0.0 with no TLS in front — that's what
harden-relay-service.sh replaces.)
"""

import os
import re
import subprocess
import time

from flask import Flask, jsonify, request

app = Flask(__name__)
SHARED_SECRET = os.environ["PEER_ADD_SECRET"]

# A peer is considered "connected" if it completed a WireGuard handshake
# within this many seconds. WireGuard re-handshakes at least every 120s
# (REKEY_AFTER_TIME) while active, and this app's generated client configs
# set PersistentKeepalive=25s, so an actively-connected client's handshake
# should always be well under this window; a stale one means the client
# disconnected, went offline, or was never actually connected.
CONNECTED_WITHIN_SECONDS = 180

# A WireGuard key is a 32-byte value, base64-encoded — always 44 characters,
# the last one padding ("="). The `wg-peers` Edge Function already validates
# this before calling us, but this service also runs `wg` as root off of
# these values, so it validates independently rather than trusting its only
# caller. Rejecting non-conforming input here means it never reaches the `wg`
# invocation at all, closing off argument-injection-style abuse (e.g. a
# value starting with "-" being parsed as a flag instead of a positional
# argument) even if something upstream of this service is ever misconfigured
# or compromised.
_WG_KEY_RE = re.compile(r"^[A-Za-z0-9+/]{43}=$")
# Mirrors the Edge Function's TUNNEL_SUBNET_PREFIX (10.8.0.0/24, client
# octets 2-254; .1 is the relay itself).
_ALLOWED_IP_RE = re.compile(r"^10\.8\.0\.(\d{1,3})$")


def _valid_public_key(value) -> bool:
    return isinstance(value, str) and bool(_WG_KEY_RE.match(value))


def _valid_allowed_ip(value) -> bool:
    if not isinstance(value, str):
        return False
    match = _ALLOWED_IP_RE.match(value)
    if not match:
        return False
    octet = int(match.group(1))
    return 2 <= octet <= 254


def _authorized() -> bool:
    return request.headers.get("X-Peer-Secret") == SHARED_SECRET


def _dump_peers() -> dict:
    """Parses `wg show wg0 dump` into {public_key: {...}}.

    Dump format (tab-separated): the first line is the interface itself
    (private-key, public-key, listen-port, fwmark) and is skipped; each
    following line is one peer (public-key, preshared-key, endpoint,
    allowed-ips, latest-handshake unix ts or 0, transfer-rx, transfer-tx,
    persistent-keepalive).
    """
    result = subprocess.run(
        ["wg", "show", "wg0", "dump"], capture_output=True, text=True, check=True
    )
    lines = result.stdout.strip().splitlines()
    peers = {}
    for line in lines[1:]:  # skip the interface line
        fields = line.split("\t")
        if len(fields) < 8:
            continue
        public_key, _preshared, _endpoint, _allowed_ips, latest_handshake, rx, tx, _keepalive = fields
        peers[public_key] = {
            "latest_handshake": int(latest_handshake),
            "transfer_rx": int(rx),
            "transfer_tx": int(tx),
        }
    return peers


@app.route("/add-peer", methods=["POST"])
def add_peer():
    if not _authorized():
        return jsonify({"error": "unauthorized"}), 401
    data = request.get_json(silent=True) or {}
    public_key = data.get("public_key")
    allowed_ip = data.get("allowed_ip")
    if not _valid_public_key(public_key):
        return jsonify({"error": "public_key must be a 44-character base64 WireGuard key"}), 400
    if not _valid_allowed_ip(allowed_ip):
        return jsonify({"error": "allowed_ip must be in the 10.8.0.2-254 range"}), 400
    try:
        subprocess.run(
            ["wg", "set", "wg0", "peer", public_key, "allowed-ips", f"{allowed_ip}/32"],
            check=True,
        )
        subprocess.run(["wg-quick", "save", "wg0"], check=True)
    except subprocess.CalledProcessError as exc:
        return jsonify({"error": str(exc)}), 500
    return jsonify({"ok": True})


@app.route("/remove-peer", methods=["POST"])
def remove_peer():
    if not _authorized():
        return jsonify({"error": "unauthorized"}), 401
    data = request.get_json(silent=True) or {}
    public_key = data.get("public_key")
    if not _valid_public_key(public_key):
        return jsonify({"error": "public_key must be a 44-character base64 WireGuard key"}), 400
    try:
        subprocess.run(["wg", "set", "wg0", "peer", public_key, "remove"], check=True)
        subprocess.run(["wg-quick", "save", "wg0"], check=True)
    except subprocess.CalledProcessError as exc:
        return jsonify({"error": str(exc)}), 500
    return jsonify({"ok": True})


@app.route("/peer-status", methods=["POST"])
def peer_status():
    if not _authorized():
        return jsonify({"error": "unauthorized"}), 401
    data = request.get_json(silent=True) or {}
    public_keys = data.get("public_keys")
    if not isinstance(public_keys, list) or not public_keys:
        return jsonify({"error": "public_keys (non-empty array) is required"}), 400
    # Silently drop anything malformed rather than 400ing the whole batch —
    # the caller only ever sends its own DB's tracked keys, so this is just
    # a safety net, not an expected path.
    valid_keys = [key for key in public_keys if _valid_public_key(key)]
    try:
        live_peers = _dump_peers()
    except subprocess.CalledProcessError as exc:
        return jsonify({"error": str(exc)}), 500

    now = int(time.time())
    statuses = {}
    for public_key in valid_keys:
        peer = live_peers.get(public_key)
        if peer is None:
            # Not on the interface at all — e.g. revoked, or the row
            # exists in Supabase but was never actually activated here.
            statuses[public_key] = {"registered": False}
            continue
        handshake = peer["latest_handshake"]
        statuses[public_key] = {
            "registered": True,
            "latest_handshake": handshake or None,
            "connected": bool(handshake) and (now - handshake) < CONNECTED_WITHIN_SECONDS,
            "transfer_rx": peer["transfer_rx"],
            "transfer_tx": peer["transfer_tx"],
        }
    return jsonify({"peers": statuses})


if __name__ == "__main__":
    # Local/manual testing only — production runs this under gunicorn
    # (see infra/harden-relay-service.sh), which never executes this block.
    app.run(host="127.0.0.1", port=8787)