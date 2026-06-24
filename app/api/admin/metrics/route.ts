import { NextRequest } from "next/server";
import { getSupabase } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/metrics?secret=$CRON_SECRET
 * Краткая сводка по разборам Reels. Защита — CRON_SECRET (как в broadcast).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.nextUrl.searchParams.get("secret") !== secret)
    return Response.json({ error: "forbidden" }, { status: 403 });

  const sb = getSupabase();

  const countOf = async (table: string, build?: (q: any) => any) => {
    let q = sb.from(table).select("*", { count: "exact", head: true });
    if (build) q = build(q);
    const { count, error } = await q;
    return error ? `err: ${error.message}` : (count ?? 0);
  };

  const [decodeRequests, decodeCompleted, reelDecodesRows] = await Promise.all([
    countOf("analytics_events", (q) => q.eq("event", "reels_analysis_started")),
    countOf("analytics_events", (q) => q.eq("event", "reels_analysis_completed")),
    countOf("reel_decodes"),
  ]);

  return Response.json({
    reel_decode_requests: decodeRequests,     // нажатий «разобрать» (started)
    reel_decode_completed: decodeCompleted,   // успешных разборов
    reel_decodes_unique_rows: reelDecodesRows, // строк в reel_decodes (с учётом кэша)
  });
}
