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
  channel_username?: string | null;
  channel_id?: number | null;
  channel_title?: string | null;
  channel_subscribers?: number | null;
  bot_admin_status?: string | null;
  channel_attached_at?: string | null;
}

export interface ProjectBudgetRow {
  project_id: string;
  monthly_cap_usd: number;
  spent_usd_current_month: number;
  auto_pause_on_exceed: boolean;
}

export type ProjectAgentRole = "analyst" | "scout" | "writer" | "editor" | "strategist" | "community";

export interface ProjectAgentRow {
  id: string;
  project_id: string;
  role: ProjectAgentRole;
  status: "pending" | "active" | "paused";
  config: Record<string, unknown>;
  last_run_at: string | null;
}
