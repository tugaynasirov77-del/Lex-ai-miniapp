import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";
import {
  writeReelScript,
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
    .select("id,tg_id,platform")
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
  const topic = String(body?.topic || "").trim();
  const durationRaw = Number(body?.duration ?? 30);
  const duration: 15 | 30 | 60 =
    durationRaw === 15 ? 15 : durationRaw === 60 ? 60 : 30;

  if (!topic) return Response.json({ error: "topic required" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });
  }

  const gate = await enforceQuota({ tgId: a.tgId, action: "reel" });
  if (!gate.pass) return gate.response;

  const [{ insights }, brand] = await Promise.all([
    getInsightsFromCache(id),
    getBrandKitFromProject(id),
  ]);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const { script, cost } = await writeReelScript({
      client,
      projectId: id,
      tgId: a.tgId,
      topic,
      duration,
      insights,
      brand,
    });
    if (!script) {
      return Response.json({ error: "reel writer returned empty" }, { status: 502 });
    }

    // Текстовое представление для body — для совместимости со старым review.
    const textBody = [
      `🎬 ${script.topic}`,
      "",
      `HOOK: ${script.hook}`,
      "",
      "РАСКАДРОВКА:",
      ...script.scenes.map(
        (s) =>
          `[${s.seconds}] ${s.action}${s.on_screen ? `\n   в кадре: ${s.on_screen}` : ""}`
      ),
      "",
      `🎵 ${script.music_hint}`,
      "",
      `📝 ${script.caption}`,
      "",
      script.hashtags.join(" "),
    ].join("\n");

    const sb = getSupabase();
    const { data: inserted, error } = await sb
      .from("content_drafts")
      .insert({
        project_id: id,
        platform: a.project.platform || "instagram",
        content_type: "reel",
        body: textBody,
        caption: script.caption,
        chosen_title: script.topic,
        lex_reel: script,
        source: "manual",
        status: "pending",
        cost_usd: cost,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      return Response.json({ error: error?.message || "insert failed" }, { status: 500 });
    }

    return Response.json({ ok: true, draftId: inserted.id, script, cost });
  } catch (e: any) {
    return Response.json({ error: e?.message || "reel failed" }, { status: 502 });
  }
}
