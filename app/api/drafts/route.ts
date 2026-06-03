import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../../../lib/supabase";
import { verifyInitData } from "../../../lib/verifyTelegram";
import { generateCarousel } from "../../../lib/carouselWriter";
import { enforceQuota } from "../../../lib/gating";
import { buildAgentSystem } from "../../../lib/agents";
import { sanitizeForAnthropic } from "../../../lib/sanitize";

export const runtime = "nodejs";
export const maxDuration = 120;

const POST_WRITER_MODEL = "claude-sonnet-4-6";

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
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  if (format === "carousel") {
    try {
      const { carousel } = await generateCarousel({
        client,
        topic,
        projectId,
        tgId: v.user.id,
      });
      if (!carousel) {
        return Response.json({ error: "carousel writer returned invalid JSON" }, { status: 502 });
      }
      const { data: inserted, error } = await sb
        .from("content_drafts")
        .insert({
          project_id: projectId,
          platform,
          content_type: "carousel",
          body: carousel.caption || "",
          caption: carousel.caption || "",
          chosen_title: carousel.carousel_title || null,
          media_urls: carousel.slides,
          source: "user_brief",
          status: "ready",
        })
        .select("id")
        .single();
      if (error || !inserted) {
        return Response.json({ error: error?.message || "insert failed" }, { status: 500 });
      }
      return Response.json({ draftId: inserted.id, projectId });
    } catch (e: any) {
      return Response.json({ error: `carousel: ${e?.message || "fail"}` }, { status: 502 });
    }
  }

  // post — простой одинарный writer-вызов под brief.topic.
  try {
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
    if (!text) return Response.json({ error: "writer returned empty" }, { status: 502 });

    const { data: inserted, error } = await sb
      .from("content_drafts")
      .insert({
        project_id: projectId,
        platform,
        content_type: "post",
        body: text,
        source: "user_brief",
        status: "ready",
      })
      .select("id")
      .single();
    if (error || !inserted) {
      return Response.json({ error: error?.message || "insert failed" }, { status: 500 });
    }
    return Response.json({ draftId: inserted.id, projectId });
  } catch (e: any) {
    return Response.json({ error: `writer: ${e?.message || "fail"}` }, { status: 502 });
  }
}
