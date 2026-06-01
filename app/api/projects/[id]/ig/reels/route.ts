import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";
import { generateReelScript } from "../../../../../../lib/reelWriter";
import { canSpend } from "../../../../../../lib/projectBudget";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET: список Reel-черновиков
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = getSupabase();
  const { data, error } = await sb
    .from("content_drafts")
    .select("id,body,video_url,cover_url,status,scheduled_at,created_at,editor_score,needs_review,ig_media_id,ig_permalink")
    .eq("project_id", id)
    .eq("content_type", "reel")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ reels: data ?? [] });
}

// POST: Алина пишет сценарий → создаём draft → ставим job в очередь рендеринга.
// Само видео генерирует воркер на VPS (Lex-agents repo).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const initData = req.headers.get("x-telegram-init-data");
  const v = verifyInitData(initData);
  if (!v.ok || !v.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id: projectId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const topic = String(body.topic || "").trim() || "интересный факт для аудитории";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });

  const budget = await canSpend(projectId);
  if (!budget.ok) return Response.json({ error: budget.reason || "budget" }, { status: 402 });

  const sb = getSupabase();
  const { data: project } = await sb
    .from("projects")
    .select("id,tg_id,title,instagram_username")
    .eq("id", projectId)
    .single();
  if (!project) return Response.json({ error: "project not found" }, { status: 404 });

  // niche hint опционально
  const { data: niche } = await sb.from("niche_strategy").select("summary").eq("project_id", projectId).maybeSingle();

  const client = new Anthropic({ apiKey });
  const { draft, cost } = await generateReelScript({
    client,
    topic,
    niche: niche?.summary ?? null,
    projectId,
    tgId: project.tg_id,
  });

  if (!draft) {
    return Response.json({ error: "reel writer returned invalid JSON" }, { status: 502 });
  }

  // Сохраняем черновик. body = caption (текст под видео), media в video_url появится после рендера.
  const { data: inserted, error } = await sb
    .from("content_drafts")
    .insert({
      project_id: projectId,
      platform: "instagram",
      content_type: "reel",
      body: draft.caption,
      title_variants: [],
      source: "auto",
      status: "pending",
      model_writer: "claude-sonnet-4-6",
      cost_usd: cost,
    })
    .select("id")
    .single();

  if (error || !inserted) return Response.json({ error: error?.message || "insert failed" }, { status: 500 });

  // Ставим задачу в очередь рендеринга для воркера на VPS.
  const { error: jobError } = await sb.from("reel_jobs").insert({
    draft_id: inserted.id,
    project_id: projectId,
    status: "pending",
    script: draft.script,
    overlays: draft.overlays,
  });

  if (jobError) {
    return Response.json({ error: `draft created but queue failed: ${jobError.message}`, draft_id: inserted.id }, { status: 500 });
  }

  return Response.json({
    draft_id: inserted.id,
    queued: true,
    caption: draft.caption,
    script_preview: draft.script.slice(0, 200),
    overlays_count: draft.overlays.length,
    cost,
  });
}
