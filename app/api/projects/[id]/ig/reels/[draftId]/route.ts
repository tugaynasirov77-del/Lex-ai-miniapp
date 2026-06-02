import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../../lib/verifyTelegram";

export const runtime = "nodejs";

// DELETE — удаление черновика Reel вместе со связанным reel_job
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; draftId: string }> }) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id: projectId, draftId } = await ctx.params;
  const sb = getSupabase();

  // Проверяем проект принадлежит юзеру
  const { data: project } = await sb
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("tg_id", v.user.id)
    .maybeSingle();
  if (!project) return Response.json({ error: "project not found" }, { status: 404 });

  // ON DELETE CASCADE в reel_jobs сделает chain-удаление автоматически
  const { error } = await sb.from("content_drafts").delete().eq("id", draftId).eq("project_id", projectId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
