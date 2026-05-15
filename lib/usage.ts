import { getSupabase } from "./supabase";
import { verifyInitData } from "./verifyTelegram";

export interface UsageInsert {
  tgId: number;
  agentId: string;
  endpoint: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_tokens?: number | null;
  cache_read_tokens?: number | null;
}

export async function logUsage(u: UsageInsert): Promise<void> {
  try {
    const sb = getSupabase();
    await sb.from("usage_log").insert({
      tg_id: u.tgId,
      agent_id: u.agentId,
      endpoint: u.endpoint,
      input_tokens: u.input_tokens ?? 0,
      output_tokens: u.output_tokens ?? 0,
      cache_creation_tokens: u.cache_creation_tokens ?? 0,
      cache_read_tokens: u.cache_read_tokens ?? 0,
    });
  } catch {
    // не валим запрос если лог не записался
  }
}

export function tgIdFromHeader(initData: string | null | undefined): number | null {
  const v = verifyInitData(initData);
  return v.ok && v.user ? v.user.id : null;
}
