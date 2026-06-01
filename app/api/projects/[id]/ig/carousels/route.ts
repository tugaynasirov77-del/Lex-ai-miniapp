import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = getSupabase();
  const { data, error } = await sb
    .from("content_drafts")
    .select("id,body,media_urls,status,scheduled_at,created_at,editor_score,needs_review,ig_media_id,ig_permalink")
    .eq("project_id", id)
    .eq("content_type", "carousel")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ carousels: data ?? [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const initData = req.headers.get("x-telegram-init-data");
  const v = verifyInitData(initData);
  if (!v.ok || !v.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id: projectId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const caption = String(body.caption || "").slice(0, 2200);
  const mediaUrls: string[] = Array.isArray(body.media_urls) ? body.media_urls.slice(0, 10) : [];

  // TODO Этап 2:
  //   1) Алина пишет caption + раскадровку (2-10 слайдов: title + body для каждого)
  //   2) генерация картинок (DALL-E или nano-banana или статичные шаблоны)
  //   3) загрузка в Supabase Storage → media_urls
  //   4) Аркадий — ревью caption
  //   5) Виктор публикует через IG Graph (publishCarousel)

  const sb = getSupabase();
  const { data, error } = await sb
    .from("content_drafts")
    .insert({
      project_id: projectId,
      platform: "instagram",
      content_type: "carousel",
      body: caption || "(пустая карусель)",
      media_urls: mediaUrls,
      title_variants: [],
      source: "manual",
      status: "pending",
    })
    .select("id")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ draft_id: data.id, stub: true, message: "Carousel skeleton. Pipeline TODO Этап 2." });
}
