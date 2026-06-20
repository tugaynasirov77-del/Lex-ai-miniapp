import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../lib/supabase";
import { verifyInitData } from "../../../../../lib/verifyTelegram";
import { getBrandKitFromProject } from "../../../../../lib/lexAI";
import { generateDailyIdeas } from "../../../../../lib/dailyIdeas";
import type { ProjectContext } from "../../../../../lib/topicAdapter";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * GET /api/projects/[id]/ideas
 *
 * «Идеи для Reels на сегодня» — 3 идеи под нишу проекта.
 * Кэш: 1 набор на проект в день (project_daily_ideas). Генерация — Haiku.
 */

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
  if (!project)
    return Response.json({ error: "project not found" }, { status: 404 });

  const date = todayUtc();

  // Кэш на сегодня
  const { data: cached } = await sb
    .from("project_daily_ideas")
    .select("ideas")
    .eq("project_id", id)
    .eq("idea_date", date)
    .maybeSingle();
  if (cached?.ideas)
    return Response.json({ ok: true, ideas: cached.ideas, cached: true });

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
    const ideas = await generateDailyIdeas({ brand, projectCtx });
    // upsert (на случай гонки двух запросов)
    await sb
      .from("project_daily_ideas")
      .upsert({ project_id: id, idea_date: date, ideas }, { onConflict: "project_id,idea_date" });
    await sb.from("project_usage").insert({
      project_id: id,
      agent_role: "daily_ideas",
      cost_usd: 0.01,
      model: "claude-haiku-4-5-20251001",
    });
    return Response.json({ ok: true, ideas, cached: false });
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "Не получилось собрать идеи. Попробуй позже." },
      { status: 500 },
    );
  }
}
