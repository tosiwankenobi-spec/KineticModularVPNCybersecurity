import nacl from "tweetnacl";

// WireGuard uses Curve25519 (X25519) for its key exchange — the same curve
// tweetnacl's `box` API uses for its Diffie-Hellman keypairs. A raw
// nacl.box.keyPair() therefore produces bytes that are directly usable as a
// WireGuard private/public key once base64-encoded; no protocol-specific
// crypto library is needed. This runs entirely in the browser — the private
// key is generated locally and never sent anywhere, including to Supabase.
export type WgKeyPair = {
  publicKey: string;
  privateKey: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function generateWgKeyPair(): WgKeyPair {
  const pair = nacl.box.keyPair();
  return {
    publicKey: bytesToBase64(pair.publicKey),
    privateKey: bytesToBase64(pair.secretKey),
  };
}

export type WgClientConfigInput = {
  privateKey: string;
  clientAddress: string; // e.g. "10.8.0.4"
  serverPublicKey: string;
  endpoint: string; // e.g. "104.154.119.10:51820"
  dns?: string;
};

// Produces a standard WireGuard client `.conf` file. This is the same
// format the official WireGuard apps (iOS/Android/macOS/Windows/Linux)
// import directly — nothing proprietary about it.
export function buildWgClientConfig({
  privateKey,
  clientAddress,
  serverPublicKey,
  endpoint,
  dns = "1.1.1.1",
}: WgClientConfigInput): string {
  return `[Interface]
PrivateKey = ${privateKey}
Address = ${clientAddress}/32
DNS = ${dns}

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${endpoint}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
`;
}
