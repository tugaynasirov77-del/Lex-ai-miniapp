import { NextRequest } from "next/server";
import { getSupabase } from "../../../../lib/supabase";
import { verifyInitData } from "../../../../lib/verifyTelegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/drafts/review-queue
 * Все черновики юзера, кроме опубликованных. Для единого review-экрана.
 */
export async function GET(req: NextRequest) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) {
    return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });
  }

  const sb = getSupabase();
  const { data: projects } = await sb
    .from("projects")
    .select("id,title,platform")
    .eq("tg_id", v.user.id);
  const projectIds = (projects ?? []).map((p) => p.id);
  if (projectIds.length === 0) return Response.json({ drafts: [], projects: [] });

  const { data: drafts } = await sb
    .from("content_drafts")
    .select(
      "id,project_id,platform,content_type,status,chosen_title,text,body,caption,video_url,cover_url,media_urls,editor_score,editor_verdict,editor_comments,scheduled_at,review_log,user_selections,created_at,published_message_id"
    )
    .in("project_id", projectIds)
    .is("published_message_id", null)
    .order("created_at", { ascending: false })
    .limit(80);

  return Response.json({ drafts: drafts ?? [], projects: projects ?? [] });
}
