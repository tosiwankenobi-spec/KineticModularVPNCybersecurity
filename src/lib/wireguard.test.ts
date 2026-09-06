import { describe, expect, it } from "vitest";
import { generateWgKeyPair, buildWgClientConfig } from "./wireguard";

describe("generateWgKeyPair", () => {
  it("produces distinct base64-encoded 32-byte keys", () => {
    const { publicKey, privateKey } = generateWgKeyPair();
    expect(publicKey).not.toEqual(privateKey);
    // WireGuard keys are 32 raw bytes, base64-encoded to 44 chars (43 + '=' padding).
    for (const key of [publicKey, privateKey]) {
      expect(key).toMatch(/^[A-Za-z0-9+/]{42,44}=?$/);
      const decoded = atob(key);
      expect(decoded.length).toBe(32);
    }
  });

  it("generates a fresh keypair every call", () => {
    const a = generateWgKeyPair();
    const b = generateWgKeyPair();
    expect(a.privateKey).not.toEqual(b.privateKey);
    expect(a.publicKey).not.toEqual(b.publicKey);
  });
});

describe("buildWgClientConfig", () => {
  it("produces a valid-shaped WireGuard client config", () => {
    const config = buildWgClientConfig({
      privateKey: "clientPrivateKeyBase64==",
      clientAddress: "10.8.0.4",
      serverPublicKey: "serverPublicKeyBase64==",
      endpoint: "104.154.119.10:51820",
    });

    expect(config).toContain("[Interface]");
    expect(config).toContain("PrivateKey = clientPrivateKeyBase64==");
    expect(config).toContain("Address = 10.8.0.4/32");
    expect(config).toContain("[Peer]");
    expect(config).toContain("PublicKey = serverPublicKeyBase64==");
    expect(config).toContain("Endpoint = 104.154.119.10:51820");
    expect(config).toContain("AllowedIPs = 0.0.0.0/0, ::/0");
  });

  it("defaults DNS to 1.1.1.1 but allows override", () => {
    const defaultDns = buildWgClientConfig({
      privateKey: "a",
      clientAddress: "10.8.0.5",
      serverPublicKey: "b",
      endpoint: "example.com:51820",
    });
    expect(defaultDns).toContain("DNS = 1.1.1.1");

    const customDns = buildWgClientConfig({
      privateKey: "a",
      clientAddress: "10.8.0.5",
      serverPublicKey: "b",
      endpoint: "example.com:51820",
      dns: "9.9.9.9",
    });
    expect(customDns).toContain("DNS = 9.9.9.9");
  });
});
