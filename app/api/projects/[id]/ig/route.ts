import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../lib/supabase";
import { verifyInitData } from "../../../../../lib/verifyTelegram";

export const runtime = "nodejs";

// Агрегированный GET для IG-страницы проекта (аналог /api/projects/[id] для TG).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const initData = req.headers.get("x-telegram-init-data");
  const v = verifyInitData(initData);
  if (!v.ok || !v.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const sb = getSupabase();

  const [{ data: project }, { data: reels }, { data: carousels }, { data: competitors }, { data: snaps }, { data: jobs }] = await Promise.all([
    sb.from("projects").select("*").eq("id", id).eq("tg_id", v.user.id).maybeSingle(),
    sb
      .from("content_drafts")
      .select("id,body,video_url,cover_url,status,scheduled_at,created_at,editor_score,needs_review,ig_media_id,ig_permalink,published_at")
      .eq("project_id", id)
      .eq("content_type", "reel")
      .order("created_at", { ascending: false })
      .limit(20),
    sb
      .from("content_drafts")
      .select("id,body,media_urls,status,scheduled_at,created_at,editor_score,needs_review,ig_media_id,ig_permalink,published_at")
      .eq("project_id", id)
      .eq("content_type", "carousel")
      .order("created_at", { ascending: false })
      .limit(20),
    sb.from("ig_competitors").select("*").eq("project_id", id).order("followers", { ascending: false, nullsFirst: false }).limit(10),
    sb.from("ig_snapshots").select("followers,posts_count,reels_count,snapshot_at").eq("project_id", id).order("snapshot_at", { ascending: false }).limit(14),
    sb.from("reel_jobs").select("draft_id,status,phase,error,attempts,updated_at,transcript_words,user_selections").eq("project_id", id).order("updated_at", { ascending: false }).limit(50),
  ]);

  if (!project) return Response.json({ error: "not found" }, { status: 404 });

  // склеиваем фазу job'а в каждый reel
  const jobByDraft = new Map<string, any>();
  for (const j of jobs ?? []) {
    if (!jobByDraft.has(j.draft_id)) jobByDraft.set(j.draft_id, j);
  }
  const reelsWithJob = (reels ?? []).map((r: any) => ({ ...r, job: jobByDraft.get(r.id) ?? null }));

  return Response.json({
    project,
    reels: reelsWithJob,
    carousels: carousels ?? [],
    competitors: competitors ?? [],
    snapshots: snaps ?? [],
  });
}
