import { NextRequest } from "next/server";
import { verifyInitData } from "../../../../../lib/verifyTelegram";
import { getSupabase } from "../../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Частота напоминаний текущего юзера (управляет cron /api/cron/reminders).
 *
 * GET  → { frequency: "daily" | "medium" | "rare" | "off" }
 * POST { frequency } → сохраняет user_prefs.reminder_frequency
 *
 * Settings-тогл пишет сюда, иначе крон шлёт всем подряд (юзер не может выключить).
 */

const VALID = ["daily", "medium", "rare", "off"] as const;
type Freq = (typeof VALID)[number];

export async function GET(req: NextRequest) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user)
    return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });

  const sb = getSupabase();
  const { data } = await sb
    .from("user_prefs")
    .select("reminder_frequency")
    .eq("tg_id", v.user.id)
    .maybeSingle();

  const freq = (data?.reminder_frequency as Freq) || "daily";
  return Response.json({ frequency: VALID.includes(freq) ? freq : "daily" });
}

export async function POST(req: NextRequest) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user)
    return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { frequency?: string };
  const freq = body.frequency as Freq;
  if (!VALID.includes(freq))
    return Response.json({ error: "frequency must be daily|medium|rare|off" }, { status: 400 });

  const sb = getSupabase();
  const { error } = await sb.from("user_prefs").upsert(
    {
      tg_id: v.user.id,
      reminder_frequency: freq,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tg_id" },
  );
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true, frequency: freq });
}
