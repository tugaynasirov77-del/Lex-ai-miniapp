import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../lib/supabase";
import { verifyInitData } from "../../../../../lib/verifyTelegram";

export const runtime = "nodejs";

// GET /api/ig/reel-jobs/[id] — polling endpoint for UploadScreen / GenerateScreen.
// Returns ReelJobDTO shape matching lib/api.ts.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const sb = getSupabase();

  const { data: job, error } = await sb
    .from("reel_jobs")
    .select("id,project_id,draft_id,status,phase,transcript_words,video_url,cover_url,attempts,error,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!job) return Response.json({ error: "not found" }, { status: 404 });

  // Ownership check через project.
  const { data: project } = await sb
    .from("projects")
    .select("tg_id")
    .eq("id", job.project_id)
    .maybeSingle();
  if (!project || project.tg_id !== v.user.id) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  return Response.json(job);
}
