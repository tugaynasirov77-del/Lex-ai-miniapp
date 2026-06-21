import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";
import { getBrandKitFromProject } from "../../../../../../lib/lexAI";
import { generateContentPack, type PackProjectContext } from "../../../../../../lib/contentPack";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * POST /api/projects/[id]/ig/pack
 *
 * Контент-пакет (бриф раздел 17): из одной идеи генерим Reels-сценарий +
 * карусель + подпись и сохраняем 3 строки в content_drafts с общим
 * content_pack_id.
 *
 * Body: { topic: string }
 * Ответ: { ok, content_pack_id, items: [{ id, content_type }], pack }
 * Расход в project_usage (agent_role='content_pack').
 */

async function authProject(req: NextRequest, projectId: string) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user)
    return { err: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const sb = getSupabase();
  const { data } = await sb
    .from("projects")
    .select("id, tg_id, platform, niche, audience, content_goal, content_style, on_camera, what_sells, content_language")
    .eq("id", projectId)
    .eq("tg_id", v.user.id)
    .maybeSingle();
  if (!data) return { err: Response.json({ error: "project not found" }, { status: 404 }) };
  return { tgId: v.user.id, project: data };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const body = await req.json().catch(() => ({}));
  const topic = String(body?.topic || "").trim();
  if (topic.length < 5)
    return Response.json({ error: "Опиши идею (минимум 5 символов)" }, { status: 400 });
  if (topic.length > 800)
    return Response.json({ error: "Слишком длинно. До 800 символов." }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY)
    return Response.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });

  const brand = await getBrandKitFromProject(id);
  const projectCtx: PackProjectContext = {
    niche: a.project.niche,
    audience: a.project.audience,
    content_goal: a.project.content_goal,
    content_style: a.project.content_style,
    on_camera: a.project.on_camera,
    what_sells: a.project.what_sells,
    content_language: a.project.content_language,
  };

  let pack;
  try {
    pack = await generateContentPack({ topic, brand, projectCtx });
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "Не получилось собрать пакет. Попробуй ещё раз." },
      { status: 500 },
    );
  }

  const sb = getSupabase();
  const packId = randomUUID();
  const platform = a.project.platform || "instagram";
  const captionFull = [pack.caption.text, pack.caption.hashtags.join(" ")]
    .filter(Boolean)
    .join("\n\n");

  const rows = [
    {
      project_id: id,
      platform,
      content_type: "reel",
      status: "scenario_ready",
      content_pack_id: packId,
      source_topic: topic,
      chosen_title: pack.reel.title,
      scenario_data: pack.reel,
      body: pack.reel.voice_over,
      caption: pack.carousel.caption || pack.caption.text,
      source: "pack",
    },
    {
      project_id: id,
      platform,
      content_type: "carousel",
      status: "scenario_ready",
      content_pack_id: packId,
      source_topic: topic,
      chosen_title: pack.carousel.topic,
      body: pack.carousel.caption,
      caption: pack.carousel.caption,
      media_urls: pack.carousel.slides.map((s) => ({ index: s.num, text: s.text })),
      lex_carousel: pack.carousel,
      source: "pack",
    },
    {
      project_id: id,
      platform,
      content_type: "caption",
      status: "scenario_ready",
      content_pack_id: packId,
      source_topic: topic,
      chosen_title: topic.slice(0, 120),
      body: captionFull,
      caption: captionFull,
      source: "pack",
    },
  ];

  const { data: inserted, error } = await sb
    .from("content_drafts")
    .insert(rows)
    .select("id, content_type");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await sb.from("project_usage").insert({
    project_id: id,
    agent_role: "content_pack",
    cost_usd: 0.06,
    model: "claude-haiku-4-5-20251001",
  });

  return Response.json({
    ok: true,
    content_pack_id: packId,
    items: inserted ?? [],
    pack,
  });
}
