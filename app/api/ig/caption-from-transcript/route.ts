import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../../../../lib/supabase";
import { buildAgentSystem } from "../../../../lib/agents";
import { sanitizeForAnthropic } from "../../../../lib/sanitize";
import { recordSpend } from "../../../../lib/projectBudget";
import {
  reviewReelCaption,
  ARKADIY_REEL_CAPTION_PROMPT_VERSION,
  type ReelCaptionReview,
} from "../../../../lib/arkadiyEditor";

export const runtime = "nodejs";
export const maxDuration = 90;

const ALINA_MODEL = "claude-sonnet-4-6";
const ALINA_PROMPT_VERSION = "v2"; // bumped с интеграцией Аркадия
const ARKADIY_THRESHOLD = 7;
const MAX_RETRIES = 1; // одна повторная попытка если score<7

const CAPTION_TASK_BASE = `ЗАДАЧА: на основе транскрипта видео клиента написать caption + overlays для Reel.

Что делаешь:
1. caption — подпись под Reel в Instagram:
   • 100–300 символов (без хэштегов)
   • Hook в первой строке (цифра / провокация / вопрос)
   • Эмодзи 1-3 штуки, тематические
   • Концовка: вопрос/CTA
   • В конце 3-5 hashtag по теме (по-английски, в стиле #marketing #ai)
2. overlays — текстовые подложки которые FFmpeg выжжет поверх ключевых моментов:
   • 3-5 штук
   • короткие фразы (≤ 40 символов)
   • time — секунда от начала видео, duration — сколько висит (2-4 сек)
   • выбирай моменты по транскрипту: сильные утверждения, цифры, поворотные точки

Формат ответа — строгий JSON одной строкой:
{"caption":"...","overlays":[{"time":3,"text":"...","duration":3}]}

Никакого текста до или после JSON.`;

type AlinaOut = { caption: string; overlays: { time: number; text: string; duration: number }[] };

function safeJson<T>(s: string): T | null {
  try {
    return JSON.parse(s.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()) as T;
  } catch {
    return null;
  }
}

function normalizeOverlays(arr: any): AlinaOut["overlays"] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((o: any) => o && typeof o.text === "string")
    .slice(0, 8)
    .map((o: any) => ({
      time: Math.max(0, Math.min(120, Math.round(Number(o.time) || 0))),
      duration: Math.max(1, Math.min(8, Math.round(Number(o.duration) || 3))),
      text: String(o.text).slice(0, 60),
    }));
}

async function callAlina(args: {
  client: Anthropic;
  ctx: string;
  task: string;
  projectId: string;
  tgId: number;
}): Promise<{ out: AlinaOut | null; cost: number }> {
  const { client, ctx, task, projectId, tgId } = args;
  const res = await client.messages.create({
    model: ALINA_MODEL,
    max_tokens: 700,
    system: buildAgentSystem("alina", task),
    messages: [{ role: "user", content: sanitizeForAnthropic(ctx) }],
  });
  const cost = await recordSpend({
    projectId,
    agentRole: "writer",
    model: ALINA_MODEL,
    usage: res.usage as any,
    tgId,
  });
  const raw = res.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  const out = safeJson<AlinaOut>(raw);
  if (!out || typeof out.caption !== "string") return { out: null, cost };
  out.overlays = normalizeOverlays(out.overlays);
  return { out, cost };
}

export async function POST(req: NextRequest) {
  if (req.headers.get("x-worker-secret") !== process.env.WORKER_SECRET) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const projectId = String(body.project_id || "");
  const draftId = String(body.draft_id || "");
  const transcript = String(body.transcript || "").slice(0, 8000);

  if (!projectId) return Response.json({ error: "project_id required" }, { status: 400 });
  // Edge: пустой / слишком короткий транскрипт — не зовём AI впустую
  if (transcript.trim().length < 20) {
    return Response.json({ error: "transcript too short (<20 chars)" }, { status: 400 });
  }

  const sb = getSupabase();
  const { data: project } = await sb
    .from("projects")
    .select("tg_id,title")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return Response.json({ error: "project not found" }, { status: 404 });

  const { data: niche } = await sb
    .from("niche_strategy")
    .select("summary")
    .eq("project_id", projectId)
    .maybeSingle();

  const baseCtx = [
    niche?.summary ? `Ниша: ${niche.summary}` : "",
    `Транскрипт видео:\n${transcript}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  let totalCost = 0;

  // 1) Алина пишет первый вариант
  let { out: alina, cost: c1 } = await callAlina({
    client,
    ctx: baseCtx,
    task: CAPTION_TASK_BASE,
    projectId,
    tgId: project.tg_id,
  });
  totalCost += c1;
  if (!alina) {
    return Response.json({ error: "invalid JSON from Алина" }, { status: 502 });
  }

  // 2) Аркадий оценивает + чистит
  let review: ReelCaptionReview | null = null;
  let retries = 0;
  try {
    const rr = await reviewReelCaption({
      client,
      caption: alina.caption,
      transcript,
      projectId,
      tgId: project.tg_id,
    });
    review = rr.review;
    totalCost += rr.cost;
  } catch (e) {
    // Аркадий упал — оставляем caption от Алины как есть, без score
    review = null;
  }

  // 3) Если score<7 и есть бюджет ретраев — Алина переписывает с замечаниями Аркадия
  if (review && review.score < ARKADIY_THRESHOLD && retries < MAX_RETRIES) {
    retries++;
    const retryTask = `${CAPTION_TASK_BASE}

ПРЕДЫДУЩАЯ ПОПЫТКА БЫЛА СЛАБОЙ (оценка ${review.score}/10):
"${alina.caption}"

Замечания редактора Аркадия:
${review.comments}
${review.errors.length ? "Конкретные ошибки: " + review.errors.join("; ") : ""}

Перепиши caption с учётом этих замечаний. Тот же JSON-формат.`;

    const retryRes = await callAlina({
      client,
      ctx: baseCtx,
      task: retryTask,
      projectId,
      tgId: project.tg_id,
    });
    totalCost += retryRes.cost;
    if (retryRes.out) {
      alina = retryRes.out;
      // повторный review после ретрая
      try {
        const rr2 = await reviewReelCaption({
          client,
          caption: alina.caption,
          transcript,
          projectId,
          tgId: project.tg_id,
        });
        if (rr2.review) review = rr2.review;
        totalCost += rr2.cost;
      } catch {
        /* оставляем старый review */
      }
    }
  }

  // Финальный caption: cleaned от Аркадия если есть, иначе сырой от Алины
  const finalCaption =
    review && review.cleaned_caption ? review.cleaned_caption : alina.caption;

  // 4) Сохраняем в draft
  if (draftId) {
    const update: Record<string, any> = {
      body: finalCaption,
      caption: finalCaption,
      cost_usd: totalCost,
    };
    if (review) {
      update.editor_score = review.score;
      update.editor_verdict = review.verdict;
      update.editor_comments = review.comments;
      update.editor_errors = review.errors;
      update.needs_review = review.verdict !== "approve";
      update.editor_prompt_version = ARKADIY_REEL_CAPTION_PROMPT_VERSION;
      update.writer_prompt_version = ALINA_PROMPT_VERSION;
      update.editor_retries = retries;
    }
    await sb.from("content_drafts").update(update).eq("id", draftId);
  }

  return Response.json({
    caption: finalCaption,
    overlays: alina.overlays,
    cost: totalCost,
    editor: review
      ? {
          score: review.score,
          verdict: review.verdict,
          comments: review.comments,
          errors: review.errors,
          retries,
        }
      : null,
  });
}
