import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../../../../../lib/supabase";
import { verifyInitData } from "../../../../../lib/verifyTelegram";
import { logUsage } from "../../../../../lib/usage";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * POST /api/projects/[id]/chat — свободный диалог с агентом LEX на главном
 * экране. Структурный flow (разбор → темы → сценарий) идёт по готовым
 * эндпоинтам; сюда попадает только свободный текст пользователя
 * («у меня салон, не знаю что снять»).
 *
 * Body: { messages: { role: "user" | "assistant"; content: string }[] }
 * Ответ: SSE-стрим — data: { type: "delta", text } / { type: "done", reply }.
 */

function buildSystem(p: {
  niche?: string | null;
  audience?: string | null;
  content_goal?: string | null;
  content_style?: string | null;
  on_camera?: string | null;
  what_sells?: string | null;
}): string {
  const ctx: string[] = [];
  if (p.niche) ctx.push(`Ниша: ${p.niche}`);
  if (p.audience) ctx.push(`Аудитория: ${p.audience}`);
  if (p.content_goal) ctx.push(`Цель контента: ${p.content_goal}`);
  if (p.content_style) ctx.push(`Стиль: ${p.content_style}`);
  if (p.on_camera) ctx.push(`В кадре: ${p.on_camera}`);
  if (p.what_sells) ctx.push(`Что продаёт: ${p.what_sells}`);
  const ctxBlock = ctx.length ? `\n\nКонтекст проекта пользователя:\n- ${ctx.join("\n- ")}` : "";
  return (
    "Ты — LEX, AI-ассистент по Instagram-контенту внутри Telegram Mini App. " +
    "Ты помогаешь автору придумывать идеи для Reels, разбираться что снимать и доводить до готового сценария. " +
    "Говори тепло, по-человечески и конкретно, на «ты», на русском. Без воды и канцелярита. " +
    "Отвечай коротко (2–5 предложений или короткий список) — это чат в мессенджере, не статья. " +
    "Всегда опирайся на нишу и аудиторию пользователя. " +
    "В конце мягко предложи следующий шаг: разобрать понравившийся Reels (попросить ссылку) или сделать сценарий по идее." +
    ctxBlock
  );
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 });

  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = getSupabase();
  const { data: project } = await sb
    .from("projects")
    .select("id, niche, audience, content_goal, content_style, on_camera, what_sells")
    .eq("id", id)
    .eq("tg_id", v.user.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    messages?: { role: "user" | "assistant"; content: string }[];
  };
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }))
    .slice(-12);
  if (history.length === 0 || history[history.length - 1].role !== "user")
    return NextResponse.json({ error: "last message must be user" }, { status: 400 });

  const tgId = v.user.id;
  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        const streamResp = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 700,
          system: buildSystem(project),
          messages: history,
        });
        let full = "";
        streamResp.on("text", (delta) => {
          full += delta;
          send({ type: "delta", text: delta });
        });
        const final = await streamResp.finalMessage();
        send({ type: "done", reply: full.trim() });
        controller.close();
        await logUsage({
          tgId,
          agentId: "lex-chat",
          endpoint: "chat",
          input_tokens: final.usage?.input_tokens,
          output_tokens: final.usage?.output_tokens,
          cache_creation_tokens: final.usage?.cache_creation_input_tokens || 0,
          cache_read_tokens: final.usage?.cache_read_input_tokens || 0,
        });
      } catch (e: any) {
        send({ type: "error", error: e?.message ?? String(e) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
