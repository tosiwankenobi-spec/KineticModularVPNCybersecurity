#!/usr/bin/env python3
"""Minimal peer-registration API for a Kinetic WireGuard relay.

Runs on the relay VM itself (not in Supabase). Listens for authenticated
requests from the `wg-peers` Supabase Edge Function and adds/removes
WireGuard peers on the live `wg0` interface, persisting changes to
/etc/wireguard/wg0.conf so they survive a reboot.

Security note (disclosed, not hidden): this listens on 0.0.0.0 because
Supabase Edge Functions don't publish a stable outbound IP range to
allowlist. Protection is a long random shared secret checked on every
request, not network-level restriction. If GCP IP allowlisting for your
Supabase project's egress becomes available, tighten the firewall rule
`allow-peer-service` to that range instead of 0.0.0.0/0.
"""

import os
import subprocess

from flask import Flask, jsonify, request

app = Flask(__name__)
SHARED_SECRET = os.environ["PEER_ADD_SECRET"]


def _authorized() -> bool:
    return request.headers.get("X-Peer-Secret") == SHARED_SECRET


@app.route("/add-peer", methods=["POST"])
def add_peer():
    if not _authorized():
        return jsonify({"error": "unauthorized"}), 401
    data = request.get_json(silent=True) or {}
    public_key = data.get("public_key")
    allowed_ip = data.get("allowed_ip")
    if not public_key or not allowed_ip:
        return jsonify({"error": "public_key and allowed_ip are required"}), 400
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
    if not public_key:
        return jsonify({"error": "public_key is required"}), 400
    try:
        subprocess.run(["wg", "set", "wg0", "peer", public_key, "remove"], check=True)
        subprocess.run(["wg-quick", "save", "wg0"], check=True)
    except subprocess.CalledProcessError as exc:
        return jsonify({"error": str(exc)}), 500
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8787)
