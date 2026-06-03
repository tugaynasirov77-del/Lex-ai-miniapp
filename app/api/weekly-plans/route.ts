import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../../../lib/supabase";
import { verifyInitData } from "../../../lib/verifyTelegram";
import {
  generateIgWeeklyPlan,
  IG_PLANNER_PROMPT_VERSION,
} from "../../../lib/igPlanner";
import { enforceQuota } from "../../../lib/gating";
import type { IgAnalysisResult } from "../../../lib/igAnalyst";

export const runtime = "nodejs";
export const maxDuration = 120;

function mondayOf(d: Date): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay() || 7;
  if (day !== 1) dt.setUTCDate(dt.getUTCDate() - day + 1);
  return dt.toISOString().slice(0, 10);
}

// Конструируем минимальный синтетический analysis из brief —
// без полноценной IG-разведки. Planner работает с этим как с baseline.
function syntheticAnalysis(brief: any): IgAnalysisResult {
  const topic = String(brief?.topic || "").slice(0, 200) || "контент-проект";
  const audience = String(brief?.audience || "general");
  return {
    executive_summary: `Контент-проект по теме «${topic}». Аудитория: ${audience}. Анализ конкурентов не запускался — план опирается на общие паттерны ниши.`,
    content_themes: [topic],
    recurring_formats: ["reel-insight", "carousel-checklist", "post-story"],
    hook_patterns: ["Цифра + результат", "Вопрос к боли", "Антитеза", "Лайфхак"],
    cta_patterns: ["Сохрани пост", "Пиши в комментариях", "Подпишись"],
    visual_style: "минимализм, нейтральная палитра",
    posting_cadence: "3–5 раз в неделю",
    content_gaps: [],
    opportunities: [],
  };
}

/**
 * POST /api/weekly-plans
 * Body: { brief: Brief, projectId?: string }
 * Resp: { planId, projectId }
 *
 * Если projectId не передан — создаём минимальный IG-проект.
 * Генерация плана синхронная (~20–40s).
 */
export async function POST(req: NextRequest) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const brief = body?.brief || {};
  let projectId = String(body?.projectId || "");

  const sb = getSupabase();

  // ensure project
  if (!projectId) {
    const title = `План: ${String(brief?.topic || "новый проект").slice(0, 60)}`;
    const { data: inserted, error } = await sb
      .from("projects")
      .insert({
        tg_id: v.user.id,
        title,
        platform: "instagram",
        status: "active",
      })
      .select("id")
      .single();
    if (error || !inserted) {
      return Response.json(
        { error: error?.message || "project insert failed" },
        { status: 500 },
      );
    }
    projectId = inserted.id;
  } else {
    const { data: own } = await sb
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("tg_id", v.user.id)
      .maybeSingle();
    if (!own) return Response.json({ error: "project not found" }, { status: 404 });
  }

  const gate = await enforceQuota({ projectId, tgId: v.user.id, action: "plan" });
  if (!gate.pass) return gate.response;

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });
  }

  const weekStart = mondayOf(new Date());
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let plan;
  try {
    const r = await generateIgWeeklyPlan({
      client,
      niche: brief?.topic || undefined,
      weekStart,
      analysis: syntheticAnalysis(brief),
      priorTopics: [],
      projectId,
      tgId: v.user.id,
    });
    plan = r.plan;
  } catch (e: any) {
    return Response.json(
      { error: `planner: ${e?.message || "fail"}` },
      { status: 502 },
    );
  }

  if (!plan) {
    return Response.json({ error: "invalid JSON from planner" }, { status: 502 });
  }

  const summary =
    typeof plan.summary === "string" ? { text: plan.summary } : plan.summary || {};

  const { data: upserted, error: upErr } = await sb
    .from("content_plans")
    .upsert(
      {
        project_id: projectId,
        platform: "instagram",
        week_start: weekStart,
        items: plan.items,
        summary: { ...summary, _brief: brief },
        prompt_version: IG_PLANNER_PROMPT_VERSION,
      },
      { onConflict: "project_id,week_start,platform" as any },
    )
    .select("id")
    .single();

  if (upErr || !upserted) {
    return Response.json(
      { error: upErr?.message || "plan save failed" },
      { status: 500 },
    );
  }

  return Response.json({ planId: upserted.id, projectId });
}
