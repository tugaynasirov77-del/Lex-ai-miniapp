import { NextRequest } from "next/server";
import { verifyInitData } from "../../../lib/verifyTelegram";
import { getSupabase } from "../../../lib/supabase";
import { TIERS } from "../../../lib/tiers";
import { getActiveTier, getProjectUsage } from "../../../lib/gating";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/billing?project_id=... — текущий tier, лимиты, usage, доступные планы */
export async function GET(req: NextRequest) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("project_id");
  const tier = await getActiveTier(v.user.id);
  const cfg = TIERS[tier];

  let usage = null;
  if (projectId) {
    const sb = getSupabase();
    // owner check
    const { data: p } = await sb.from("projects").select("id").eq("id", projectId).eq("tg_id", v.user.id).maybeSingle();
    if (p) usage = await getProjectUsage(projectId);
  }

  const sb = getSupabase();
  const { data: sub } = await sb
    .from("subscriptions")
    .select("plan,status,started_at,expires_at,renew_at,cancel_at,provider,amount_stars")
    .eq("tg_id", v.user.id)
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  return Response.json({
    tier,
    current_config: cfg,
    subscription: sub,
    usage,
    available_tiers: Object.values(TIERS),
  });
}
