import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";
import {
  writeCarousel,
  getInsightsFromCache,
  getBrandKitFromProject,
  type CarouselStyle,
} from "../../../../../../lib/lexAI";
import { enforceQuota } from "../../../../../../lib/gating";

export const runtime = "nodejs";
export const maxDuration = 30;

const VALID_STYLES: CarouselStyle[] = [
  "minimal",
  "pop",
  "editorial",
  "ai_tech",
  "business",
];

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
  const styleRaw = String(body?.style || "minimal");
  const style = VALID_STYLES.includes(styleRaw as CarouselStyle)
    ? (styleRaw as CarouselStyle)
    : "minimal";

  if (!topic) return Response.json({ error: "topic required" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });
  }

  const gate = await enforceQuota({ tgId: a.tgId, action: "carousel" });
  if (!gate.pass) return gate.response;

  const [{ insights }, brand] = await Promise.all([
    getInsightsFromCache(id),
    getBrandKitFromProject(id),
  ]);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const { carousel, cost } = await writeCarousel({
      client,
      projectId: id,
      tgId: a.tgId,
      topic,
      style,
      insights,
      brand,
    });
    if (!carousel) {
      return Response.json({ error: "carousel writer returned empty" }, { status: 502 });
    }

    const sb = getSupabase();
    const { data: inserted, error } = await sb
      .from("content_drafts")
      .insert({
        project_id: id,
        platform: a.project.platform || "instagram",
        content_type: "carousel",
        body: carousel.caption,
        caption: carousel.caption,
        chosen_title: carousel.topic,
        media_urls: carousel.slides.map((s) => ({ index: s.num, text: s.text })),
        lex_carousel: carousel,
        source: "manual",
        status: "pending",
        cost_usd: cost,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      return Response.json({ error: error?.message || "insert failed" }, { status: 500 });
    }

    return Response.json({ ok: true, draftId: inserted.id, carousel, cost });
  } catch (e: any) {
    return Response.json({ error: e?.message || "carousel failed" }, { status: 502 });
  }
}
