import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../lib/supabase";
import { verifyInitData } from "../../../../../lib/verifyTelegram";

export const runtime = "nodejs";

// POST /api/weekly-plans/[id]/approve
// План — guidance документ. Approve тут = пометить как «принят к работе».
// content_plans не имеет status-колонки в текущей схеме, поэтому
// мы пишем флаг в jsonb summary._review (graceful, без миграции).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const sb = getSupabase();

  const { data: plan } = await sb
    .from("content_plans")
    .select("id,project_id,summary,projects!inner(tg_id)")
    .eq("id", id)
    .maybeSingle();

  if (!plan) return Response.json({ error: "not found" }, { status: 404 });
  if ((plan as any).projects.tg_id !== v.user.id) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const prevSummary = (plan as any).summary || {};
  const review = prevSummary._review || {};
  if (review.status === "approved") {
    return Response.json({ ok: true, already: true });
  }

  const nextSummary = {
    ...prevSummary,
    _review: { status: "approved", at: new Date().toISOString(), by_tg_id: v.user.id },
  };

  const { error } = await sb
    .from("content_plans")
    .update({ summary: nextSummary })
    .eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
