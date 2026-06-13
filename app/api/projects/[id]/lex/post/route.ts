import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";
import {
  writePost,
  getInsightsFromCache,
  getBrandKitFromProject,
} from "../../../../../../lib/lexAI";
import { enforceQuota } from "../../../../../../lib/gating";

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

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const body = await req.json().catch(() => ({}));
  const topic = String(body?.topic || "").trim();
  if (!topic) return Response.json({ error: "topic required" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });
  }

  const gate = await enforceQuota({ tgId: a.tgId, action: "post" });
  if (!gate.pass) return gate.response;

  const [{ insights }, brand] = await Promise.all([
    getInsightsFromCache(id),
    getBrandKitFromProject(id),
  ]);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const { variants, cost } = await writePost({
      client,
      projectId: id,
      tgId: a.tgId,
      topic,
      insights,
      brand,
    });
    if (variants.length === 0) {
      return Response.json({ error: "writer returned empty" }, { status: 502 });
    }

    // Создаём draft с body=первый вариант (не пустой!) + все варианты в lex_variants.
    // UI покажет 3 варианта, юзер выберет — body обновится через PATCH.
    const sb = getSupabase();
    const { data: inserted, error } = await sb
      .from("content_drafts")
      .insert({
        project_id: id,
        platform: "telegram",
        content_type: "post",
        body: variants[0].body,
        title_variants: variants.map((v) => v.title).filter(Boolean),
        chosen_title: variants[0].title || null,
        lex_variants: variants,
        source: "manual",
        status: "pending",
        cost_usd: cost,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      return Response.json({ error: error?.message || "insert failed" }, { status: 500 });
    }

    return Response.json({
      ok: true,
      draftId: inserted.id,
      variants,
      cost,
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || "writer failed" }, { status: 502 });
  }
}
