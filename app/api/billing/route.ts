import { NextRequest } from "next/server";
import { verifyInitData } from "../../../lib/verifyTelegram";
import { getSupabase } from "../../../lib/supabase";
import { TIERS } from "../../../lib/tiers";
import { getActiveTier, countUsage } from "../../../lib/gating";
import { isYooKassaConfigured } from "../../../lib/yookassa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/billing — текущий tier, usage, доступные планы */
export async function GET(req: NextRequest) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user)
    return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });

  const tier = await getActiveTier(v.user.id);
  const cfg = TIERS[tier];

  // Usage по 3 action'ам, период из cfg.limits[action].period
  const [postsUsed, carouselsUsed, reelsUsed] = await Promise.all([
    countUsage(v.user.id, "post", cfg.limits.post.period),
    countUsage(v.user.id, "carousel", cfg.limits.carousel.period),
    countUsage(v.user.id, "reel", cfg.limits.reel.period),
  ]);

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
    usage: {
      post: { used: postsUsed, limit: cfg.limits.post.count, period: cfg.limits.post.period },
      carousel: { used: carouselsUsed, limit: cfg.limits.carousel.count, period: cfg.limits.carousel.period },
      reel: { used: reelsUsed, limit: cfg.limits.reel.count, period: cfg.limits.reel.period },
    },
    // Авто-включение Pro/Business когда ENV ЮKassa прописаны.
    // Без второго деплоя — достаточно прокинуть YOOKASSA_SHOP_ID + YOOKASSA_SECRET_KEY.
    available_tiers: Object.values(TIERS).map((t) =>
      t.tier === "free" ? t : { ...t, available: isYooKassaConfigured() },
    ),
    payments_enabled: isYooKassaConfigured(),
  });
}
