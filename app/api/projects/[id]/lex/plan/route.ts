import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";
import {
  writeWeekPlan,
  getWeekPlanFromCache,
  getInsightsFromCache,
  getBrandKitFromProject,
} from "../../../../../../lib/lexAI";

export const runtime = "nodejs";
export const maxDuration = 30;

async function authProject(req: NextRequest, projectId: string) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return { err: Response.json({ error: "unauthorized" }, { status: 401 }) };
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

// GET — отдать кеш плана если есть
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const plan = await getWeekPlanFromCache(id);
  return Response.json({ plan });
}

// POST — сгенерить план заново
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });
  }

  const [{ insights }, brand] = await Promise.all([
    getInsightsFromCache(id),
    getBrandKitFromProject(id),
  ]);

  if (!insights) {
    return Response.json(
      {
        error: "no_insights",
        message: "Сначала запусти анализ конкурентов.",
      },
      { status: 400 }
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const { plan, cost } = await writeWeekPlan({
      client,
      projectId: id,
      tgId: a.tgId,
      insights,
      brand,
    });
    if (!plan) {
      return Response.json({ error: "plan writer returned empty" }, { status: 502 });
    }
    return Response.json({ ok: true, plan, cost });
  } catch (e: any) {
    return Response.json({ error: e?.message || "plan failed" }, { status: 502 });
  }
}
