import { createClient } from "@supabase/supabase-js";
import type { AlertLevel, ModuleId } from "./kinetic-data";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.local.example to .env.local and fill in your Supabase project credentials.",
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type ProfileRow = {
  id: string;
  display_name: string | null;
  created_at: string;
};

export type ModuleSettingRow = {
  user_id: string;
  module_id: ModuleId;
  enabled: boolean;
  updated_at: string;
};

export type AlertRow = {
  id: string;
  user_id: string;
  module_id: ModuleId | null;
  level: AlertLevel;
  title: string;
  detail: string;
  read: boolean;
  created_at: string;
};

export type RelayNodeRow = {
  code: string;
  city: string;
  country: string;
  ping_ms: number;
  status: "online" | "offline" | "maintenance";
};

export type SessionRow = {
  id: string;
  user_id: string;
  region_code: string;
  connected_at: string;
  disconnected_at: string | null;
};

export type WgPeerRow = {
  id: string;
  user_id: string;
  public_key: string;
  allowed_ip: string;
  label: string | null;
  created_at: string;
  revoked_at: string | null;
};
