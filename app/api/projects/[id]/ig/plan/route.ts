import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";
import {
  generateIgWeeklyPlan,
  IG_PLANNER_PROMPT_VERSION,
} from "../../../../../../lib/igPlanner";

export const runtime = "nodejs";
export const maxDuration = 90;

async function authProject(req: NextRequest, projectId: string) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user)
    return { err: Response.json({ error: v.error ?? "unauthorized" }, { status: 401 }) };
  const sb = getSupabase();
  const { data } = await sb
    .from("projects")
    .select("id,tg_id")
    .eq("id", projectId)
    .eq("tg_id", v.user.id)
    .maybeSingle();
  if (!data) return { err: Response.json({ error: "project not found" }, { status: 404 }) };
  return { tgId: v.user.id };
}

function mondayOf(d: Date): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay() || 7;
  if (day !== 1) dt.setUTCDate(dt.getUTCDate() - day + 1);
  return dt.toISOString().slice(0, 10);
}

/** GET — последний IG-план */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const sb = getSupabase();
  const { data } = await sb
    .from("content_plans")
    .select("id,week_start,items,summary,created_at,prompt_version,platform")
    .eq("project_id", id)
    .eq("platform", "instagram")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  return Response.json({ plan: data ?? null });
}

/** POST — сгенерировать новый IG-план на ближайшую неделю */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const sb = getSupabase();

  // нужен свежий analysis
  const { data: analysis } = await sb
    .from("ig_analyses")
    .select("result,created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!analysis || !analysis.result) {
    return Response.json(
      { error: "no analysis yet — run POST /ig/analyze first" },
      { status: 400 }
    );
  }

  // niche контекст
  const { data: niche } = await sb
    .from("niche_strategy")
    .select("summary")
    .eq("project_id", id)
    .maybeSingle();

  // последние темы (избегаем повтора)
  const { data: priorPlans } = await sb
    .from("content_plans")
    .select("items")
    .eq("project_id", id)
    .eq("platform", "instagram")
    .order("week_start", { ascending: false })
    .limit(2);
  const priorTopics: string[] = [];
  for (const p of priorPlans || []) {
    if (Array.isArray((p as any).items)) {
      for (const it of (p as any).items as any[]) {
        if (it?.topic) priorTopics.push(String(it.topic));
      }
    }
  }

  // считаем понедельник следующей недели
  const todayMonday = mondayOf(new Date());
  const requested = String((await req.json().catch(() => ({}))).week_start || "");
  const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : todayMonday;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const { plan, cost } = await generateIgWeeklyPlan({
    client,
    niche: niche?.summary || undefined,
    weekStart,
    analysis: analysis.result as any,
    priorTopics,
    projectId: id,
    tgId: a.tgId,
  });

  if (!plan) return Response.json({ error: "invalid JSON from planner" }, { status: 502 });

  // апсёрт в content_plans (один план на week_start+platform)
  const { data: inserted, error } = await sb
    .from("content_plans")
    .upsert(
      {
        project_id: id,
        platform: "instagram",
        week_start: weekStart,
        items: plan.items,
        summary: plan.summary,
        prompt_version: IG_PLANNER_PROMPT_VERSION,
      },
      { onConflict: "project_id,week_start,platform" as any }
    )
    .select("id,week_start,items,summary,created_at")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true, plan: inserted, cost });
}
