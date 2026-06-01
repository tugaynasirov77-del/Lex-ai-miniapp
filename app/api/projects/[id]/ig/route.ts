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

  const [{ data: project }, { data: reels }, { data: carousels }, { data: competitors }, { data: snaps }] = await Promise.all([
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
  ]);

  if (!project) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json({
    project,
    reels: reels ?? [],
    carousels: carousels ?? [],
    competitors: competitors ?? [],
    snapshots: snaps ?? [],
  });
}
