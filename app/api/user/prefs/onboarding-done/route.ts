import { NextRequest } from "next/server";
import { verifyInitData } from "../../../../../lib/verifyTelegram";
import { getSupabase } from "../../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Статус welcome-онбординга текущего юзера.
 *
 * GET  → { onboarding_completed: boolean }
 * POST → помечает онбординг пройденным (upsert user_prefs.onboarding_completed=true).
 *
 * Серверный флаг — подстраховка к localStorage: если юзер открыл Mini App
 * с нового устройства, welcome не покажется повторно.
 */

export async function GET(req: NextRequest) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user)
    return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });

  const sb = getSupabase();
  const { data } = await sb
    .from("user_prefs")
    .select("onboarding_completed")
    .eq("tg_id", v.user.id)
    .maybeSingle();

  return Response.json({ onboarding_completed: !!data?.onboarding_completed });
}

export async function POST(req: NextRequest) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user)
    return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });

  const sb = getSupabase();
  const { error } = await sb.from("user_prefs").upsert(
    {
      tg_id: v.user.id,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tg_id" }
  );

  if (error)
    return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
