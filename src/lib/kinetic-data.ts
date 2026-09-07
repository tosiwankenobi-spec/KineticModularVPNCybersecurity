export type ModuleId =
  "tunnel" | "malware" | "tracker" | "firewall" | "dns" | "identity" | "killswitch" | "splitTunnel";

// Canonical alert-severity levels, shared between the console UI and the
// `alerts` table's `level` check constraint (see supabase/migrations/0001_init.sql).
export type AlertLevel = "info" | "warn" | "danger" | "success";

export type ModuleCategory = "Network" | "Threats" | "Privacy" | "Advanced";

export type Module = {
  id: ModuleId;
  name: string;
  category: ModuleCategory;
  description: string;
  loadMb: number;
  latencyMs: number;
  defaultOn: boolean;
};

export const MODULES: Module[] = [
  {
    id: "tunnel",
    name: "Encrypted Tunnel",
    category: "Network",
    description: "WireGuard-based ChaCha20-Poly1305 tunnel through hardened relay nodes.",
    loadMb: 42,
    latencyMs: 12,
    defaultOn: true,
  },
  {
    id: "killswitch",
    name: "Kill Switch",
    category: "Network",
    description: "Blocks all traffic instantly if the tunnel drops.",
    loadMb: 4,
    latencyMs: 0,
    defaultOn: true,
  },
  {
    id: "splitTunnel",
    name: "Split Tunneling",
    category: "Network",
    description: "Route selected apps outside the tunnel for local speed.",
    loadMb: 8,
    latencyMs: 1,
    defaultOn: false,
  },
  {
    id: "malware",
    name: "Malware Shield",
    category: "Threats",
    description: "Behavioral analysis blocks zero-day payloads at the gateway.",
    loadMb: 68,
    latencyMs: 3,
    defaultOn: true,
  },
  {
    id: "firewall",
    name: "Adaptive Firewall",
    category: "Threats",
    description: "Port hardening and inbound rules tuned per network profile.",
    loadMb: 22,
    latencyMs: 1,
    defaultOn: false,
  },
  {
    id: "tracker",
    name: "Tracker Blocker",
    category: "Privacy",
    description: "Strips 3rd-party trackers, fingerprinters, and ad beacons.",
    loadMb: 14,
    latencyMs: 0,
    defaultOn: true,
  },
  {
    id: "dns",
    name: "Private DNS",
    category: "Privacy",
    description: "DNS-over-HTTPS with query masking on our resolver mesh.",
    loadMb: 6,
    latencyMs: 2,
    defaultOn: false,
  },
  {
    id: "identity",
    name: "Identity Masking",
    category: "Advanced",
    description: "Rotating email aliases and virtual card numbers.",
    loadMb: 18,
    latencyMs: 0,
    defaultOn: false,
  },
];

export const MODULE_CATEGORIES: ModuleCategory[] = ["Network", "Threats", "Privacy", "Advanced"];

export type Region = { code: string; city: string; country: string; ping: number };

export const REGIONS: Region[] = [
  { code: "CH", city: "Zurich", country: "Switzerland", ping: 12 },
  { code: "IS", city: "Reykjavík", country: "Iceland", ping: 24 },
  { code: "SG", city: "Singapore", country: "Singapore", ping: 68 },
  { code: "US", city: "New York", country: "United States", ping: 42 },
];
