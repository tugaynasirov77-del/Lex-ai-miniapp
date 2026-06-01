import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../../../lib/verifyTelegram";

export const runtime = "nodejs";

// Юзер выбрал ключевые слова + анимацию → ставим job обратно в pending для Phase 2.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; draftId: string }> }) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id: projectId, draftId } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const keyIndices: number[] = Array.isArray(body.key_indices)
    ? body.key_indices.filter((n: unknown) => typeof n === "number" && Number.isFinite(n)).map((n: number) => Math.floor(n))
    : [];
  const animation = String(body.animation || "slide_up");
  if (!["slide_up", "pop", "fade"].includes(animation)) {
    return Response.json({ error: "invalid animation" }, { status: 400 });
  }

  const sb = getSupabase();

  // проверяем, что drafт юзера и проект существует
  const { data: project } = await sb
    .from("projects").select("id")
    .eq("id", projectId).eq("tg_id", v.user.id).maybeSingle();
  if (!project) return Response.json({ error: "project not found" }, { status: 404 });

  // находим job по draft_id
  const { data: job } = await sb
    .from("reel_jobs").select("id,status")
    .eq("draft_id", draftId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!job) return Response.json({ error: "job not found" }, { status: 404 });

  // обновляем выборку и возвращаем в очередь
  const { error } = await sb
    .from("reel_jobs")
    .update({
      user_selections: { key_indices: keyIndices, animation },
      status: "pending",
      phase: null,
      error: null,
      attempts: 0,
      claimed_by: null,
      claimed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, job_id: job.id });
}
