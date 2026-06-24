import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";
import { getBrandKitFromProject } from "../../../../../../lib/lexAI";
import { adaptTopics, refineUserIdea, type ProjectContext } from "../../../../../../lib/topicAdapter";
import { getActiveTier } from "../../../../../../lib/gating";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * POST /api/projects/[id]/ig/adapt
 *
 * Адаптирует разбор Reels под проект пользователя:
 *  - режим "topics"   (по умолчанию): возвращает 3 темы под brand kit
 *  - режим "refine"   : улучшает пользовательскую идею под референс
 *
 * Body:
 *  { mode?: "topics" | "refine", decode_id: string, user_idea?: string }
 *
 * Квоту НЕ берём отдельно — адаптация = часть value первого разбора (бесплатно).
 * Расход трекается в project_usage для аналитики.
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
  const mode: "topics" | "refine" = body?.mode === "refine" ? "refine" : "topics";
  const decodeId = String(body?.decode_id || "").trim();
  const userIdea = String(body?.user_idea || "").trim();

  if (!decodeId)
    return Response.json({ error: "decode_id required" }, { status: 400 });
  if (mode === "refine" && userIdea.length < 5)
    return Response.json({ error: "user_idea слишком короткая (минимум 5 символов)" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY)
    return Response.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });

  // Монетизация: разбор бесплатный, адаптация под нишу + сценарий — только Pro.
  const tier = await getActiveTier(a.tgId);
  if (tier === "free")
    return Response.json(
      { error: "Адаптация под нишу доступна на Pro", code: "pro_required" },
      { status: 402 },
    );

  // Тянем разбор и проверяем что он принадлежит этому юзеру
  const sb = getSupabase();
  // reel_decodes — общий кэш разборов публичных Reels (ключ — shortcode),
  // строка может принадлежать другому tg_id. Ищем только по id.
  const { data: decode } = await sb
    .from("reel_decodes")
    .select("id, analysis")
    .eq("id", decodeId)
    .maybeSingle();
  if (!decode || !decode.analysis)
    return Response.json({ error: "Разбор не найден" }, { status: 404 });

  const brand = await getBrandKitFromProject(id);
  const projectCtx: ProjectContext = {
    niche: a.project.niche,
    audience: a.project.audience,
    content_goal: a.project.content_goal,
    content_style: a.project.content_style,
    on_camera: a.project.on_camera,
    what_sells: a.project.what_sells,
    language: a.project.content_language,
  };

  try {
    if (mode === "refine") {
      const topic = await refineUserIdea({
        userIdea,
        analysis: decode.analysis,
        brand,
        projectCtx,
      });
      await sb.from("project_usage").insert({
        project_id: id,
        agent_role: "topic_refine",
        cost_usd: 0.01,
        model: "claude-haiku-4-5-20251001",
      });
      return Response.json({ ok: true, topic });
    }

    const topics = await adaptTopics({
      analysis: decode.analysis,
      brand,
      projectCtx,
    });
    await sb.from("project_usage").insert({
      project_id: id,
      agent_role: "topic_adapt",
      cost_usd: 0.02,
      model: "claude-haiku-4-5-20251001",
    });
    return Response.json({ ok: true, decode_id: decodeId, topics });
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "Не получилось адаптировать. Попробуй ещё раз." },
      { status: 500 },
    );
  }
}
