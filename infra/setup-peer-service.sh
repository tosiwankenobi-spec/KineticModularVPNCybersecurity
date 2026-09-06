#!/usr/bin/env bash
# Run this from Cloud Shell (or anywhere gcloud is authed to your project).
# Installs the peer-registration API on the relay VM and opens the port it
# needs. Paste relay-peer-service.py's contents into place first, or scp it
# up — see the two commands below.
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

# Copy the service file up to the VM.
gcloud compute scp relay-peer-service.py "${VM_NAME}:~/relay-peer-service.py" --zone="$ZONE"

# Install Flask, install the systemd unit, start the service.
gcloud compute ssh "$VM_NAME" --zone="$ZONE" --command="
  sudo apt-get update -qq && sudo apt-get install -y -qq python3-pip
  sudo pip3 install --break-system-packages flask
  sudo mv ~/relay-peer-service.py /opt/relay-peer-service.py
  sudo tee /etc/systemd/system/relay-peer-service.service > /dev/null <<'UNIT'
[Unit]
Description=Kinetic relay peer-registration API
After=network.target wg-quick@wg0.service

[Service]
Environment=PEER_ADD_SECRET=${SECRET}
ExecStart=/usr/bin/python3 /opt/relay-peer-service.py
Restart=on-failure
User=root

[Install]
WantedBy=multi-user.target
UNIT
  sudo systemctl daemon-reload
  sudo systemctl enable relay-peer-service
  sudo systemctl restart relay-peer-service
  sudo systemctl status relay-peer-service --no-pager
"

# Open the firewall for the peer-add API. See the security note in
# relay-peer-service.py's docstring about why this is 0.0.0.0/0.
gcloud compute firewall-rules create allow-peer-service \
  --allow=tcp:8787 \
  --direction=INGRESS \
  --target-tags=kinetic-relay \
  || echo "Firewall rule may already exist — continuing."

echo "---"
echo "Done. Shared secret (save it, it will not be printed again):"
echo "$SECRET"
