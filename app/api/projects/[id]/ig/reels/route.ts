import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";

export const runtime = "nodejs";

// СКЕЛЕТ — Этап 2 (Михаил Reels-maker) наполнит реальной генерацией.
// Сейчас: GET возвращает список Reel-черновиков проекта,
// POST создаёт пустой Reel-черновик (placeholder для будущего пайплайна HeyGen+FFmpeg).

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = getSupabase();
  const { data, error } = await sb
    .from("content_drafts")
    .select("id,body,video_url,cover_url,status,scheduled_at,created_at,editor_score,needs_review,ig_media_id,ig_permalink")
    .eq("project_id", id)
    .eq("content_type", "reel")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ reels: data ?? [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const initData = req.headers.get("x-telegram-init-data");
  const v = verifyInitData(initData);
  if (!v.ok || !v.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id: projectId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const caption = String(body.caption || "").slice(0, 2200);
  const script = String(body.script || "").slice(0, 5000);

  // TODO Этап 2:
  //   1) Алина пишет script + overlays metadata
  //   2) Михаил → HeyGen API (avatar video) → polling → download
  //   3) Whisper → SRT
  //   4) FFmpeg → burn subs + overlays + music → 1080x1920 → upload to S3/Supabase Storage
  //   5) Аркадий — ревью текста (caption + script)
  //   6) сохраняется video_url в этом драфте + meta для Виктора

  const sb = getSupabase();
  const { data, error } = await sb
    .from("content_drafts")
    .insert({
      project_id: projectId,
      platform: "instagram",
      content_type: "reel",
      body: caption || script || "(пустой Reel-черновик)",
      title_variants: [],
      source: "manual",
      status: "pending",
    })
    .select("id")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ draft_id: data.id, stub: true, message: "Reel skeleton created. Pipeline TODO Этап 2." });
}
