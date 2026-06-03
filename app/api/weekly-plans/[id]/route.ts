import { NextRequest } from "next/server";
import { getSupabase } from "../../../../lib/supabase";
import { verifyInitData } from "../../../../lib/verifyTelegram";

export const runtime = "nodejs";

/**
 * GET /api/weekly-plans/[id] — polling endpoint.
 * Возвращает WeeklyPlanDTO-shape:
 * { id, project_id, status, phase?, ideas?, error?, updated_at }
 *
 * status='ready' — синхронная генерация в POST, к моменту GET план уже есть.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const sb = getSupabase();

  const { data: plan } = await sb
    .from("content_plans")
    .select(
      "id,project_id,items,summary,created_at,projects!inner(tg_id)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!plan) return Response.json({ error: "not found" }, { status: 404 });
  if ((plan as any).projects.tg_id !== v.user.id) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const items = Array.isArray((plan as any).items) ? ((plan as any).items as any[]) : [];
  const ideas = items.map((it, idx) => ({
    idx,
    format: String(it?.format || "post"),
    topic: String(it?.topic || ""),
    hook: String(it?.hook || ""),
  }));

  return Response.json({
    id: plan.id,
    project_id: plan.project_id,
    status: "ready",
    phase: null,
    ideas,
    error: null,
    updated_at: (plan as any).created_at,
  });
}
