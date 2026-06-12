import { NextRequest, after } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../../../lib/supabase";
import { verifyInitData } from "../../../lib/verifyTelegram";
import { generateCarousel } from "../../../lib/carouselWriter";
import { enforceQuota } from "../../../lib/gating";
import { buildAgentSystem } from "../../../lib/agents";
import { sanitizeForAnthropic } from "../../../lib/sanitize";

export const runtime = "nodejs";
export const maxDuration = 120;

// На Vercel Hobby (10s ceiling) Sonnet почти не успевает дописать пост
// в after() → юзер ждёт orphan-timeout. Haiku 4.5 примерно в 3× быстрее
// и для коротких TG-постов даёт сопоставимое качество. На Vercel Pro
// (60s) можно вернуть Sonnet.
const POST_WRITER_MODEL = "claude-haiku-4-5";

async function markFailed(draftId: string, reason: string) {
  const sb = getSupabase();
  await sb
    .from("content_drafts")
    .update({
      status: "rejected", // 'failed' нет в CHECK; используем 'rejected' для fail-state
      error: reason.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId);
}

/**
 * POST /api/drafts
 * Body: { format: 'post'|'carousel', brief: Brief, projectId?: string }
 * Resp: { draftId, projectId }
 *
 * Sync-генерация (~10–30s). Если projectId не передан — создаём минимальный проект.
 */
export async function POST(req: NextRequest) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const format = String(body?.format || "");
  const brief = body?.brief || {};
  let projectId = String(body?.projectId || "");

  if (!["post", "carousel"].includes(format)) {
    return Response.json({ error: "format must be post|carousel" }, { status: 400 });
  }
  const topic = String(brief?.topic || "").trim();
  if (!topic) return Response.json({ error: "brief.topic required" }, { status: 400 });

  const sb = getSupabase();
  const platform = format === "carousel" ? "instagram" : "telegram";

  // ensure project
  if (!projectId) {
    const title = `${format === "carousel" ? "Карусель" : "Пост"}: ${topic.slice(0, 60)}`;
    const { data: inserted, error } = await sb
      .from("projects")
      .insert({ tg_id: v.user.id, title, platform, status: "active" })
      .select("id")
      .single();
    if (error || !inserted) {
      return Response.json({ error: error?.message || "project insert failed" }, { status: 500 });
    }
    projectId = inserted.id;
  } else {
    const { data: own } = await sb
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("tg_id", v.user.id)
      .maybeSingle();
    if (!own) return Response.json({ error: "project not found" }, { status: 404 });
  }

  if (format === "carousel") {
    const gate = await enforceQuota({
      projectId,
      tgId: v.user.id,
      action: "carousel",
    });
    if (!gate.pass) return gate.response;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });
  }

  // 1) Сразу создаём placeholder-row. В schema CHECK constraint
  //    пропускает только pending|ready|approved|rejected|published|failed —
  //    'generating' нет, поэтому используем status='pending' + пустой
  //    body как маркер «в процессе». GET-маппер отличает по body.
  const { data: placeholder, error: insErr } = await sb
    .from("content_drafts")
    .insert({
      project_id: projectId,
      platform,
      content_type: format,
      body: "",
      source: "manual",
      status: "pending",
    })
    .select("id")
    .single();
  if (insErr || !placeholder) {
    return Response.json({ error: insErr?.message || "insert failed" }, { status: 500 });
  }
  const draftId = placeholder.id as string;
  const tgId = v.user.id;

  // 2) Тяжёлая AI-работа — в after(). Ответ клиенту уходит немедленно, AI
  //    продолжается до maxDuration. На Vercel Hobby это 10s — если не
  //    успели, orphan-cron подберёт и пометит 'failed'.
  after(async () => {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    try {
      if (format === "carousel") {
        const { carousel } = await generateCarousel({
          client,
          topic,
          projectId,
          tgId,
        });
        if (!carousel) {
          await markFailed(draftId, "carousel writer returned invalid JSON");
          return;
        }
        await sb
          .from("content_drafts")
          .update({
            body: carousel.caption || "",
            caption: carousel.caption || "",
            chosen_title: carousel.carousel_title || null,
            media_urls: carousel.slides,
            status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", draftId);
        return;
      }

      // post
      const task = `Напиши ОДИН Telegram-пост по теме.

Тон: ${brief?.tone || "confident"}.
Тема: ${topic}.
${brief?.audience ? `Аудитория: ${brief.audience}.` : ""}
${brief?.goal ? `Цель: ${brief.goal}.` : ""}

Требования:
- 600–1500 символов.
- Сильный hook первой строкой.
- Без markdown-заголовков и эмодзи-спама.
- Один смысловой CTA в конце.
- Никаких "сегодня", дат и конкретных цифр которых нет в данных.

Выведи только текст поста, без префиксов.`;
      const res = await client.messages.create({
        model: POST_WRITER_MODEL,
        max_tokens: 1200,
        system: buildAgentSystem("alina", task),
        messages: [{ role: "user", content: sanitizeForAnthropic(topic) }],
      });
      const text = res.content
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("")
        .trim();
      if (!text) {
        await markFailed(draftId, "writer returned empty");
        return;
      }
      await sb
        .from("content_drafts")
        .update({
          body: text,
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", draftId);
    } catch (e: any) {
      await markFailed(draftId, `${format}: ${e?.message || "fail"}`);
    }
  });

  return Response.json({ draftId, projectId });
}
