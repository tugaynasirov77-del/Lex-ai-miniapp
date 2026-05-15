import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  }
  cached = createClient(url, key, {
    auth: { persistSession: false },
  });
  return cached;
}

export interface ProjectRow {
  id: string;
  tg_id: number;
  title: string;
  status: "in_progress" | "done" | "paused";
  progress: number;
  agents: string[];
  created_at: string;
  updated_at: string;
}
