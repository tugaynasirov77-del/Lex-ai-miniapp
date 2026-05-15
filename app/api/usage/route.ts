import { NextRequest } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyInitData } from "../../../lib/verifyTelegram";

export const runtime = "nodejs";

// Цены $/1M токенов для claude-sonnet-4-6
const PRICE = {
  input: 3.0,
  output: 15.0,
  cache_creation: 3.75,
  cache_read: 0.30,
};

export async function GET(req: NextRequest) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("usage_log")
      .select("agent_id, endpoint, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, created_at")
      .eq("tg_id", v.user.id)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;

    const rows = data ?? [];
    let inSum = 0, outSum = 0, creSum = 0, readSum = 0;
    const byAgent: Record<string, { input: number; output: number; calls: number }> = {};

    for (const r of rows) {
      inSum += r.input_tokens || 0;
      outSum += r.output_tokens || 0;
      creSum += r.cache_creation_tokens || 0;
      readSum += r.cache_read_tokens || 0;
      const a = byAgent[r.agent_id] ?? { input: 0, output: 0, calls: 0 };
      a.input += r.input_tokens || 0;
      a.output += r.output_tokens || 0;
      a.calls += 1;
      byAgent[r.agent_id] = a;
    }

    const costUsd =
      (inSum * PRICE.input + outSum * PRICE.output + creSum * PRICE.cache_creation + readSum * PRICE.cache_read) /
      1_000_000;

    const cacheTotal = readSum + creSum + inSum;
    const cacheHitRate = cacheTotal > 0 ? readSum / cacheTotal : 0;

    return Response.json({
      total: {
        calls: rows.length,
        input_tokens: inSum,
        output_tokens: outSum,
        cache_creation_tokens: creSum,
        cache_read_tokens: readSum,
        cost_usd: costUsd,
        cache_hit_rate: cacheHitRate,
      },
      by_agent: byAgent,
    });
  } catch (e: any) {
    return Response.json({ error: e.message ?? "db error" }, { status: 500 });
  }
}
