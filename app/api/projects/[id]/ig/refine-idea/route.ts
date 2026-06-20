import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";
import { getBrandKitFromProject } from "../../../../../../lib/lexAI";
import { refineIdeaStandalone, type ProjectContext } from "../../../../../../lib/topicAdapter";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * POST /api/projects/[id]/ig/refine-idea
 *
 * Усиливает сырую идею пользователя БЕЗ референсного разбора (§14).
 * Body: { user_idea: string }
 * Возвращает: { ok: true, topic: AdaptedTopicDTO }
 *
 * Квоту не берём — это часть value экрана «Сценарий с нуля».
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const sb = getSupabase();
  const { data: project } = await sb
    .from("projects")
    .select("id, tg_id, niche, audience, content_goal, content_style, on_camera, what_sells, content_language")
    .eq("id", id)
    .eq("tg_id", v.user.id)
    .maybeSingle();
  if (!project) return Response.json({ error: "project not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const userIdea = String(body?.user_idea || "").trim();
  if (userIdea.length < 5)
    return Response.json({ error: "user_idea слишком короткая (минимум 5 символов)" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY)
    return Response.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });

  const brand = await getBrandKitFromProject(id);
  const projectCtx: ProjectContext = {
    niche: project.niche,
    audience: project.audience,
    content_goal: project.content_goal,
    content_style: project.content_style,
    on_camera: project.on_camera,
    what_sells: project.what_sells,
    language: project.content_language,
  };

  try {
    const topic = await refineIdeaStandalone({ userIdea, brand, projectCtx });
    await sb.from("project_usage").insert({
      project_id: id,
      agent_role: "idea_refine",
      cost_usd: 0.01,
      model: "claude-haiku-4-5-20251001",
    });
    return Response.json({ ok: true, topic });
  } catch (e: any) {
    return Response.json({ error: e?.message || "refine failed" }, { status: 500 });
  }
}
