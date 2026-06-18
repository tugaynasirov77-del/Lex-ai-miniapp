import { NextRequest } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyInitData } from "../../../lib/verifyTelegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/analytics
 * Body: { events: [{ event: string, props?: object, ts?: number }] }
 *
 * Принимает батч продуктовых событий с клиента и пишет в analytics_events.
 * tg_id берём из initData (если валиден) — иначе пишем null (аноним).
 * Не валим клиента ошибками: всегда отвечаем ok.
 */
const KNOWN_EVENTS = new Set([
  "app_opened",
  "onboarding_started",
  "onboarding_completed",
  "project_created",
  "reels_link_entered",
  "reels_analysis_started",
  "reels_analysis_completed",
  "reels_analysis_failed",
  "adaptation_viewed",
  "adaptation_topic_selected",
  "own_idea_entered",
  "script_generation_started",
  "script_generated",
  "script_saved",
  "script_copied",
  "script_added_to_plan",
  "content_status_changed",
  "content_marked_published",
  "archive_opened",
  "paywall_opened",
  "single_analysis_purchased",
  "subscription_started",
  "user_returned_day_1",
  "user_returned_day_7",
  // доп. служебные
  "caption_generated",
  "carousel_generated",
  "plan_opened",
  "library_opened",
]);

export async function POST(req: NextRequest) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  const tgId = v.ok && v.user ? v.user.id : null;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: true, skipped: "bad json" });
  }

  const events = Array.isArray(body?.events) ? body.events : [];
  if (events.length === 0) return Response.json({ ok: true, count: 0 });

  const rows = events
    .filter((e: any) => typeof e?.event === "string")
    .slice(0, 50) // защита от флуда
    .map((e: any) => ({
      tg_id: tgId,
      event: KNOWN_EVENTS.has(e.event) ? e.event : `other:${String(e.event).slice(0, 40)}`,
      props: e.props && typeof e.props === "object" ? e.props : null,
      created_at: typeof e.ts === "number" ? new Date(e.ts).toISOString() : new Date().toISOString(),
    }));

  if (rows.length === 0) return Response.json({ ok: true, count: 0 });

  try {
    const sb = getSupabase();
    await sb.from("analytics_events").insert(rows);
  } catch {
    // analytics best-effort — не валим клиента
  }
  return Response.json({ ok: true, count: rows.length });
}
