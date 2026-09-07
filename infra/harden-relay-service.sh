#!/usr/bin/env bash
# Upgrades an already-running kinetic-relay-01 peer-service install from
# Flask's dev server on plain HTTP:8787 (world-open) to gunicorn bound to
# 127.0.0.1 only, fronted by Caddy for automatic HTTPS on a sslip.io
# hostname (no DNS setup needed — sslip.io resolves <ip>.sslip.io to <ip>).
#
# Run this from Cloud Shell, in the repo root, after relay_peer_service.py
# has been committed (this script scp's the file from the local checkout).
#
# Safe to re-run: each step is idempotent (installs, file overwrite,
# `systemctl restart`, `firewall-rules create` with an existing-rule check).
# The old firewall rule is only deleted after Caddy is confirmed listening.
set -euo pipefail

PROJECT=kineticmodularvpncybersecurity
ZONE=us-central1-a
VM_NAME=kinetic-relay-01

gcloud config set project "$PROJECT"

RELAY_IP=$(gcloud compute instances describe "$VM_NAME" --zone="$ZONE" \
  --format="get(networkInterfaces[0].accessConfigs[0].natIP)")
RELAY_HOST="${RELAY_IP}.sslip.io"
echo "Relay will be reachable at: https://${RELAY_HOST}"

# 1. Ship the renamed service file (gunicorn needs a valid Python module
#    name — the old relay-peer-service.py with a hyphen can't be imported).
gcloud compute scp infra/relay_peer_service.py "${VM_NAME}:~/relay_peer_service.py" --zone="$ZONE"

# 2. Install gunicorn + Caddy, move the file into place, rewrite the
#    systemd unit to run it under gunicorn bound to localhost only, and
#    configure Caddy to reverse-proxy HTTPS on $RELAY_HOST to it.
gcloud compute ssh "$VM_NAME" --zone="$ZONE" --command="
  set -euo pipefail
  sudo apt-get update -qq
  sudo pip3 install --break-system-packages gunicorn

  # Caddy's official apt repo.
  sudo apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update -qq
  sudo apt-get install -y -qq caddy

  sudo mv ~/relay_peer_service.py /opt/relay_peer_service.py
  sudo rm -f /opt/relay-peer-service.py

  # Preserve the existing secret from the running unit rather than asking
  # for it again — it's already correct in Supabase and must not change.
  EXISTING_SECRET=\$(sudo systemctl show relay-peer-service -p Environment | grep -oP 'PEER_ADD_SECRET=\K[^ ]+')

  sudo tee /etc/systemd/system/relay-peer-service.service > /dev/null <<UNIT
[Unit]
Description=Kinetic relay peer-registration API
After=network.target wg-quick@wg0.service

[Service]
Environment=PEER_ADD_SECRET=\${EXISTING_SECRET}
WorkingDirectory=/opt
ExecStart=/usr/local/bin/gunicorn --bind 127.0.0.1:8787 --workers 2 --timeout 30 relay_peer_service:app
Restart=on-failure
User=root

[Install]
WantedBy=multi-user.target
UNIT

  sudo tee /etc/caddy/Caddyfile > /dev/null <<CADDYFILE
${RELAY_HOST} {
    reverse_proxy 127.0.0.1:8787
}
CADDYFILE

  sudo systemctl daemon-reload
  sudo systemctl enable relay-peer-service
  sudo systemctl restart relay-peer-service
  sudo systemctl restart caddy
  sleep 2
  sudo systemctl status relay-peer-service --no-pager
  sudo systemctl status caddy --no-pager
"

# 3. Open 80/443 for Caddy (80 is needed briefly for the ACME HTTP
#    challenge even though everything ends up served on 443).
gcloud compute firewall-rules create allow-relay-https \
  --allow=tcp:80,tcp:443 \
  --direction=INGRESS \
  --target-tags=kinetic-relay \
  || echo "Firewall rule may already exist — continuing."

echo "---"
echo "Caddy is provisioning a TLS cert for ${RELAY_HOST} — this can take up to a minute."
echo "Test it once ready (replace YOUR_SECRET with the relay's actual shared secret —"
echo "do NOT paste the real secret value back into chat, just the pass/fail result):"
echo ""
echo "  curl -s -o /dev/null -w '%{http_code}\n' https://${RELAY_HOST}/peer-status \\"
echo "    -X POST -H 'X-Peer-Secret: YOUR_SECRET' -H 'Content-Type: application/json' \\"
echo "    -d '{\"public_keys\":[\"nonexistent\"]}'"
echo ""
echo "Expect 200. Once confirmed:"
echo "  1. Set the Supabase secret RELAY_URL to: https://${RELAY_HOST}"
echo "     (Dashboard: Project Settings > Edge Functions > Secrets, or"
echo "      'supabase secrets set RELAY_URL=https://${RELAY_HOST}' if the CLI is linked)"
echo "  2. Only after that works end-to-end from the live app, remove the old"
echo "     wide-open rule:  gcloud compute firewall-rules delete allow-peer-service"