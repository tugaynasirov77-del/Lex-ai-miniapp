import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";
import { analyzeCompetitors, type CompetitorInput } from "../../../../../../lib/lexAI";

export const runtime = "nodejs";
export const maxDuration = 60;

async function authProject(req: NextRequest, projectId: string) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return { err: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const sb = getSupabase();
  const { data } = await sb
    .from("projects")
    .select("id,tg_id,title,channel_title,channel_username,platform")
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });
  }

  // Подтянуть конкурентов — поддерживаем оба типа таблиц
  const sb = getSupabase();
  const platform = a.project.platform || "telegram";

  let competitors: CompetitorInput[] = [];
  if (platform === "instagram") {
    // ig_competitors schema: username, full_name, followers, top_post_caption,
    // top_post_likes, top_post_url, notes, profile_url
    const { data } = await sb
      .from("ig_competitors")
      .select("username, full_name, top_post_caption, top_post_likes, notes")
      .eq("project_id", id)
      .limit(5);
    competitors = (data || []).map((c: any) => ({
      handle: c.username,
      description: c.full_name || c.notes,
      topPosts: c.top_post_caption
        ? [{ text: c.top_post_caption, views: c.top_post_likes }]
        : [],
    }));
  } else {
    // competitor_channels schema: username, top_post_text, top_post_views
    const { data } = await sb
      .from("competitor_channels")
      .select("username, top_post_text, top_post_views")
      .eq("project_id", id)
      .limit(5);
    competitors = (data || []).map((c: any) => ({
      handle: c.username,
      topPosts: c.top_post_text
        ? [{ text: c.top_post_text, views: c.top_post_views }]
        : [],
    }));
  }

  if (competitors.length === 0) {
    return Response.json(
      { error: "no_competitors", message: "Добавь хотя бы 1 конкурента" },
      { status: 400 }
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const { insights, cost } = await analyzeCompetitors({
      client,
      projectId: id,
      tgId: a.tgId,
      channelTitle:
        a.project.channel_title || a.project.title || a.project.channel_username || "канал",
      competitors,
      platform: platform as "telegram" | "instagram",
    });
    if (!insights) {
      return Response.json({ error: "analyze returned empty" }, { status: 502 });
    }
    return Response.json({ ok: true, insights, cost });
  } catch (e: any) {
    return Response.json({ error: e?.message || "analyze failed" }, { status: 502 });
  }
}
