import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";
import {
  decodeReel,
  extractShortcode,
} from "../../../../../../lib/reelDecoder";
import {
  getInsightsFromCache,
  getBrandKitFromProject,
} from "../../../../../../lib/lexAI";
import { checkQuota, getActiveTier } from "../../../../../../lib/gating";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

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
  const url = String(body?.url || "").trim();
  if (!url) return Response.json({ error: "url required" }, { status: 400 });

  const shortcode = extractShortcode(url);
  if (!shortcode)
    return Response.json({ error: "Не удалось распознать ссылку. Используй формат instagram.com/reel/XXXX" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY)
    return Response.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });
  if (!process.env.OPENAI_API_KEY)
    return Response.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
  if (!process.env.RAPIDAPI_KEY || !process.env.RAPIDAPI_HOST)
    return Response.json({ error: "RAPIDAPI not configured" }, { status: 500 });

  const sb = getSupabase();

  // ─── Cache по shortcode на 7 дней ───
  const cacheCutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: cached } = await sb
    .from("reel_decodes")
    .select("*")
    .eq("shortcode", shortcode)
    .gte("created_at", cacheCutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached) {
    return Response.json({
      cached: true,
      decode: {
        id: cached.id,
        metadata: {
          shortcode: cached.shortcode,
          video_url: cached.video_url,
          caption: cached.caption,
          author_username: cached.author_username,
          view_count: cached.view_count,
          like_count: cached.like_count,
          comment_count: cached.comment_count,
          duration_sec: cached.duration_sec,
        },
        transcript: cached.transcript,
        analysis: cached.analysis,
      },
    });
  }

  // ─── Квота (админы — безлимит, внутри checkQuota) ───
  const gate = await checkQuota({ tgId: a.tgId, action: "reel_decode" });
  if (!gate.ok) {
    const msg =
      gate.tier === "free"
        ? "Бесплатно 3 разбора в месяц. Перейди на Pro — 30 разборов в месяц."
        : "Лимит на этот месяц исчерпан. Перейди на Pro+ — 100 разборов в месяц.";
    return Response.json(
      {
        error: msg,
        code: "quota_exceeded",
        tier: gate.tier,
        limit: gate.limit.count,
        used: gate.used,
        period: gate.limit.period,
      },
      { status: 402 },
    );
  }

  // ─── Разбор ───
  const [{ insights }, brand] = await Promise.all([
    getInsightsFromCache(id),
    getBrandKitFromProject(id),
  ]);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let result;
  try {
    result = await decodeReel({ client, url, insights, brand });
  } catch (e: any) {
    return Response.json({ error: e?.message || "decode failed" }, { status: 502 });
  }

  // Сохраняем
  const { data: row, error: insErr } = await sb
    .from("reel_decodes")
    .insert({
      project_id: id,
      tg_id: a.tgId,
      source_url: url,
      shortcode: result.metadata.shortcode,
      video_url: result.metadata.video_url,
      caption: result.metadata.caption,
      author_username: result.metadata.author_username,
      view_count: result.metadata.view_count,
      like_count: result.metadata.like_count,
      comment_count: result.metadata.comment_count,
      duration_sec: result.metadata.duration_sec,
      transcript: result.transcript,
      analysis: result.analysis,
      cost_usd: result.cost_usd,
    })
    .select("id")
    .maybeSingle();
  if (insErr) {
    return Response.json({ error: insErr.message }, { status: 500 });
  }

  return Response.json({
    cached: false,
    decode: {
      id: row?.id,
      metadata: result.metadata,
      transcript: result.transcript,
      analysis: result.analysis,
    },
    quota: {
      tier: gate.tier,
      used: gate.used + 1,
      limit: gate.limit.count,
      period: gate.limit.period,
    },
  });
}

// GET — история разборов
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const sb = getSupabase();
  const { data } = await sb
    .from("reel_decodes")
    .select(
      "id,shortcode,author_username,view_count,like_count,comment_count,duration_sec,analysis,created_at",
    )
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const tier = await getActiveTier(a.tgId);
  const gate = await checkQuota({ tgId: a.tgId, action: "reel_decode" });

  return Response.json({
    items: data || [],
    quota: {
      tier,
      used: gate.used,
      limit: gate.limit.count,
      period: gate.limit.period,
      ok: gate.ok,
    },
  });
}
