import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";
import {
  analyzeIgCompetitors,
  IG_ANALYST_PROMPT_VERSION,
} from "../../../../../../lib/igAnalyst";
import { enforceQuota } from "../../../../../../lib/gating";

export const runtime = "nodejs";
export const maxDuration = 90;

async function authProject(req: NextRequest, projectId: string) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user)
    return { err: Response.json({ error: v.error ?? "unauthorized" }, { status: 401 }) };
  const sb = getSupabase();
  const { data } = await sb
    .from("projects")
    .select("id,tg_id,title,instagram_username")
    .eq("id", projectId)
    .eq("tg_id", v.user.id)
    .maybeSingle();
  if (!data) return { err: Response.json({ error: "project not found" }, { status: 404 }) };
  return { tgId: v.user.id, project: data };
}

/** GET — последний анализ */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const sb = getSupabase();
  const { data } = await sb
    .from("ig_analyses")
    .select("id,result,competitor_ids,created_at,cost_usd")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return Response.json({ analysis: data ?? null });
}

/** POST — запустить анализ по всем текущим конкурентам проекта */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const gate = await enforceQuota({ projectId: id, tgId: a.tgId, action: "analysis" });
  if (!gate.pass) return gate.response;

  const sb = getSupabase();

  // Retry SELECT 3 раза с паузой 500мс — Supabase replica иногда
  // не успевает закоммитить INSERT'ы из AddCompetitorsScreen к моменту,
  // когда auto-start дёргает analyze. Без этого получаем ложный 400.
  let competitors: Array<{
    id: string;
    username: string;
    profile_url?: string;
    notes?: string;
  }> | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data } = await sb
      .from("ig_competitors")
      .select("id,username,profile_url,notes")
      .eq("project_id", id);
    if (data && data.length > 0) {
      competitors = data;
      break;
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 500));
  }
  if (!competitors || competitors.length === 0) {
    return Response.json(
      { error: "no competitors added (POST /competitors first)" },
      { status: 400 }
    );
  }

  const { data: niche } = await sb
    .from("niche_strategy")
    .select("summary")
    .eq("project_id", id)
    .maybeSingle();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const { result, cost } = await analyzeIgCompetitors({
    client,
    niche: niche?.summary || undefined,
    myAccount: a.project.instagram_username || undefined,
    competitors: competitors.map((c) => ({
      id: c.id,
      username: c.username,
      profile_url: c.profile_url,
      notes: c.notes,
    })),
    projectId: id,
    tgId: a.tgId,
  });

  if (!result) return Response.json({ error: "invalid JSON from analyst" }, { status: 502 });

  const { data: inserted, error } = await sb
    .from("ig_analyses")
    .insert({
      project_id: id,
      result,
      competitor_ids: competitors.map((c) => c.id),
      prompt_version: IG_ANALYST_PROMPT_VERSION,
      cost_usd: cost,
    })
    .select("id,created_at")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true, analysis_id: inserted.id, result, cost });
}
