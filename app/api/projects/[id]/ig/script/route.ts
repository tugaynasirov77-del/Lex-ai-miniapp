import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";
import { getBrandKitFromProject } from "../../../../../../lib/lexAI";
import { generateScript, type ScriptProjectContext } from "../../../../../../lib/scriptGenerator";
import type { AdaptedTopicDTO } from "../../../../../../lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * POST /api/projects/[id]/ig/script
 *
 * Генерирует полный сценарий Reels по выбранной адаптированной теме.
 * Body: { decode_id?: string, topic: AdaptedTopicDTO }
 * Ответ: { ok: true, scenario: ReelScenarioData }
 *
 * Квоту отдельно не берём — генерация сценария это продолжение value разбора.
 * Расход трекается в project_usage (agent_role='script_generator').
 */

async function authProject(req: NextRequest, projectId: string) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user)
    return { err: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const sb = getSupabase();
  const { data } = await sb
    .from("projects")
    .select("id, tg_id, niche, audience, content_goal, content_style, on_camera, what_sells, content_language")
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
  const decodeId = String(body?.decode_id || "").trim();
  const topic = body?.topic as AdaptedTopicDTO | undefined;

  if (!topic || typeof topic.title !== "string" || !topic.title.trim())
    return Response.json({ error: "topic required" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY)
    return Response.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });

  const sb = getSupabase();

  // Опционально подтягиваем анализ исходного Reels (если flow пришёл из разбора).
  let sourceAnalysis = null;
  if (decodeId) {
    const { data: decode } = await sb
      .from("reel_decodes")
      .select("analysis")
      .eq("id", decodeId)
      .maybeSingle();
    sourceAnalysis = decode?.analysis ?? null;
  }

  const brand = await getBrandKitFromProject(id);
  const projectCtx: ScriptProjectContext = {
    niche: a.project.niche,
    audience: a.project.audience,
    content_goal: a.project.content_goal,
    content_style: a.project.content_style,
    on_camera: a.project.on_camera,
    what_sells: a.project.what_sells,
    content_language: a.project.content_language,
  };

  try {
    const scenario = await generateScript({
      topic,
      sourceDecode: sourceAnalysis,
      brand,
      projectCtx,
    });
    await sb.from("project_usage").insert({
      project_id: id,
      agent_role: "script_generator",
      cost_usd: 0.03,
      model: "claude-haiku-4-5-20251001",
    });
    return Response.json({ ok: true, scenario });
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "Не получилось сгенерировать сценарий. Попробуй ещё раз." },
      { status: 500 },
    );
  }
}
