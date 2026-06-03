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
  const topic = String(body.topic || "").trim();
  const sourceVideoUrl = String(body.source_video_url || "").trim();
  const sourceVideoSize = Number(body.source_video_size || 0) || null;
  const sourceVideoDuration = Number(body.source_video_duration || 0) || null;
  const presetIn = String(body.preset || "expert_clean");
  const preset = ["expert_clean", "personal_brand_energy", "ai_tech_fast", "cinematic_mentor"].includes(presetIn) ? presetIn : "expert_clean";

  // mode определяется наличием source_video_url
  const mode: "avatar" | "from_upload" = sourceVideoUrl ? "from_upload" : "avatar";

  if (mode === "avatar" && !topic) {
    return Response.json({ error: "topic required for avatar mode" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });

  const budget = await canSpend(projectId);
  if (!budget.ok) return Response.json({ error: budget.reason || "budget" }, { status: 402 });

  const sb = getSupabase();

  // monthly cap по тарифу
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0,0,0,0);
  const [{ count: usedThisMonth }, { data: budgetRow }] = await Promise.all([
    sb.from("content_drafts").select("id", { count: "exact", head: true })
      .eq("project_id", projectId).eq("content_type", "reel")
      .gte("created_at", monthStart.toISOString()),
    sb.from("project_budget").select("reels_per_month").eq("project_id", projectId).maybeSingle(),
  ]);
  const cap = budgetRow?.reels_per_month ?? 15;
  if ((usedThisMonth ?? 0) >= cap) {
    return Response.json({ error: `лимит тарифа: ${cap} Reels/мес. Использовано: ${usedThisMonth}.` }, { status: 402 });
  }

  const { data: project } = await sb
    .from("projects")
    .select("id,tg_id,title,instagram_username")
    .eq("id", projectId)
    .single();
  if (!project) return Response.json({ error: "project not found" }, { status: 404 });

  // niche hint опционально
  const { data: niche } = await sb.from("niche_strategy").select("summary").eq("project_id", projectId).maybeSingle();

  if (mode === "from_upload") {
    // Видео уже загружено клиентом. Алина + caption + overlays делает воркер
    // (через /api/ig/caption-from-transcript после Whisper).
    const placeholderCaption = "(подпись будет сгенерирована после транскрипции)";

    const { data: inserted, error } = await sb
      .from("content_drafts")
      .insert({
        project_id: projectId,
        platform: "instagram",
        content_type: "reel",
        body: placeholderCaption,
        title_variants: [],
        source: "user_upload",
        status: "pending",
        source_video_url: sourceVideoUrl,
        source_video_size_bytes: sourceVideoSize,
        source_video_duration_seconds: sourceVideoDuration,
      })
      .select("id")
      .single();

    if (error || !inserted) return Response.json({ error: error?.message || "insert failed" }, { status: 500 });

    const { data: insertedJob, error: jobError } = await sb.from("reel_jobs").insert({
      draft_id: inserted.id,
      project_id: projectId,
      status: "pending",
      mode: "from_upload",
      preset,
      source_video_url: sourceVideoUrl,
      script: "",
      overlays: [],
    }).select("id").single();
    if (jobError || !insertedJob) {
      return Response.json({ error: `draft created but queue failed: ${jobError?.message}`, draft_id: inserted.id }, { status: 500 });
    }
    return Response.json({
      draft_id: inserted.id,
      reel_job_id: insertedJob.id,
      queued: true,
      mode: "from_upload",
      cap_used: (usedThisMonth ?? 0) + 1,
      cap,
    });
  }

  // === avatar mode (HeyGen) — остаётся для будущего Premium ===
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

  const { error: jobError } = await sb.from("reel_jobs").insert({
    draft_id: inserted.id,
    project_id: projectId,
    status: "pending",
    mode: "avatar",
    preset,
    script: draft.script,
    overlays: draft.overlays,
  });

  if (jobError) {
    return Response.json({ error: `draft created but queue failed: ${jobError.message}`, draft_id: inserted.id }, { status: 500 });
  }

  return Response.json({
    draft_id: inserted.id,
    queued: true,
    mode: "avatar",
    caption: draft.caption,
    script_preview: draft.script.slice(0, 200),
    overlays_count: draft.overlays.length,
    cost,
    cap_used: (usedThisMonth ?? 0) + 1,
    cap,
  });
}
