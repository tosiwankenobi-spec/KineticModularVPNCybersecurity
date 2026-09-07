#!/usr/bin/env bash
# Run this from Cloud Shell (or anywhere gcloud is authed to your project),
# from the repo root, for a *fresh* relay VM. Installs the peer-registration
# API behind gunicorn + Caddy (automatic HTTPS via a sslip.io hostname — no
# DNS setup needed) and opens only the ports that setup needs.
#
# Upgrading an existing install that's still on the old Flask-dev-server /
# plain-HTTP setup? Use harden-relay-service.sh instead — it preserves the
# already-configured shared secret instead of generating a new one.
set -euo pipefail

PROJECT=kineticmodularvpncybersecurity
ZONE=us-central1-a
VM_NAME=kinetic-relay-01
REGION=us-central1

gcloud config set project "$PROJECT"

# Generate a shared secret the Supabase Edge Function will use to
# authenticate to this service. SAVE THIS — you'll paste it into Supabase
# secrets in the next step.
SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
echo "Peer-add shared secret (save this): $SECRET"

RELAY_IP=$(gcloud compute instances describe "$VM_NAME" --zone="$ZONE" \
  --format="get(networkInterfaces[0].accessConfigs[0].natIP)")
RELAY_HOST="${RELAY_IP}.sslip.io"
echo "Relay will be reachable at: https://${RELAY_HOST}"

# Copy the service file up to the VM (note the underscore — gunicorn needs
# a valid Python module name to import, unlike the old hyphenated filename).
gcloud compute scp infra/relay_peer_service.py "${VM_NAME}:~/relay_peer_service.py" --zone="$ZONE"

# Install gunicorn + Caddy, install the systemd unit, start both services.
gcloud compute ssh "$VM_NAME" --zone="$ZONE" --command="
  set -euo pipefail
  sudo apt-get update -qq && sudo apt-get install -y -qq python3-pip debian-keyring debian-archive-keyring apt-transport-https curl
  sudo pip3 install --break-system-packages flask gunicorn

  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update -qq
  sudo apt-get install -y -qq caddy

  sudo mv ~/relay_peer_service.py /opt/relay_peer_service.py
  sudo tee /etc/systemd/system/relay-peer-service.service > /dev/null <<UNIT
[Unit]
Description=Kinetic relay peer-registration API
After=network.target wg-quick@wg0.service

[Service]
Environment=PEER_ADD_SECRET=${SECRET}
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
  sudo systemctl status relay-peer-service --no-pager
  sudo systemctl status caddy --no-pager
"

# Only 80 (ACME HTTP challenge) and 443 (the actual API, over HTTPS) are
# ever exposed publicly — gunicorn itself is bound to 127.0.0.1 and is not
# reachable from outside the VM at all.
gcloud compute firewall-rules create allow-relay-https \
  --allow=tcp:80,tcp:443 \
  --direction=INGRESS \
  --target-tags=kinetic-relay \
  || echo "Firewall rule may already exist — continuing."

echo "---"
echo "Done. Shared secret (save it, it will not be printed again):"
echo "$SECRET"
echo "Relay URL for the Supabase RELAY_URL secret: https://${RELAY_HOST}"