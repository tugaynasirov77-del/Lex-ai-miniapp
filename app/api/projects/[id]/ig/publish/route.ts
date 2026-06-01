import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";
import { publishReel, publishCarousel, publishImage, igConfigured } from "../../../../../../lib/instagram";

export const runtime = "nodejs";

// СКЕЛЕТ — Этап 3 (Виктор-публикатор IG). Сейчас вернёт 501 если IG не настроен.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const initData = req.headers.get("x-telegram-init-data");
  const v = verifyInitData(initData);
  if (!v.ok || !v.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id: projectId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const draftId = String(body.draft_id || "");
  if (!draftId) return Response.json({ error: "draft_id required" }, { status: 400 });

  const sb = getSupabase();
  const { data: project } = await sb
    .from("projects")
    .select("instagram_account_id,instagram_username")
    .eq("id", projectId)
    .single();
  const { data: draft } = await sb
    .from("content_drafts")
    .select("id,content_type,body,video_url,cover_url,media_urls")
    .eq("id", draftId)
    .single();

  if (!project?.instagram_account_id) {
    return Response.json({ ok: false, error: "IG account not attached" }, { status: 400 });
  }
  if (!draft) return Response.json({ error: "draft not found" }, { status: 404 });
  if (!igConfigured()) {
    return Response.json(
      { ok: false, stub: true, message: "TODO Этап 3: INSTAGRAM_ACCESS_TOKEN не задан. Виктор-публикатор пока не настроен." },
      { status: 501 }
    );
  }

  let result;
  if (draft.content_type === "reel" && draft.video_url) {
    result = await publishReel({
      accountId: project.instagram_account_id,
      videoUrl: draft.video_url,
      caption: draft.body,
      coverUrl: draft.cover_url ?? undefined,
    });
  } else if (draft.content_type === "carousel" && Array.isArray(draft.media_urls) && draft.media_urls.length >= 2) {
    result = await publishCarousel({
      accountId: project.instagram_account_id,
      mediaUrls: draft.media_urls as string[],
      caption: draft.body,
    });
  } else if (draft.content_type === "post" && Array.isArray(draft.media_urls) && draft.media_urls[0]) {
    result = await publishImage({
      accountId: project.instagram_account_id,
      imageUrl: (draft.media_urls as string[])[0],
      caption: draft.body,
    });
  } else {
    return Response.json({ error: "no media to publish" }, { status: 400 });
  }

  if (result.ok && result.media_id) {
    await sb
      .from("content_drafts")
      .update({
        status: "approved",
        ig_media_id: result.media_id,
        ig_permalink: result.permalink ?? null,
        published_at: new Date().toISOString(),
      })
      .eq("id", draftId);
  }
  return Response.json(result);
}
