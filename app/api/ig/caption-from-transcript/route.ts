import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../../../../lib/supabase";
import { buildAgentSystem } from "../../../../lib/agents";
import { sanitizeForAnthropic } from "../../../../lib/sanitize";
import { recordSpend } from "../../../../lib/projectBudget";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";

const CAPTION_TASK = `ЗАДАЧА: на основе транскрипта видео клиента написать caption + overlays для Reel.

Что делаешь:
1. caption — подпись под Reel в Instagram:
   • 100–300 символов
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

type Out = { caption: string; overlays: { time: number; text: string; duration: number }[] };

function safeJson<T>(s: string): T | null {
  try { return JSON.parse(s.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()) as T; } catch { return null; }
}

export async function POST(req: NextRequest) {
  if (req.headers.get("x-worker-secret") !== process.env.WORKER_SECRET) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const projectId = String(body.project_id || "");
  const draftId = String(body.draft_id || "");
  const transcript = String(body.transcript || "").slice(0, 8000);
  if (!projectId || !transcript) return Response.json({ error: "project_id + transcript required" }, { status: 400 });

  const sb = getSupabase();
  const { data: project } = await sb.from("projects").select("tg_id,title").eq("id", projectId).maybeSingle();
  if (!project) return Response.json({ error: "project not found" }, { status: 404 });

  const { data: niche } = await sb.from("niche_strategy").select("summary").eq("project_id", projectId).maybeSingle();

  const ctx = [
    niche?.summary ? `Ниша: ${niche.summary}` : "",
    `Транскрипт видео:\n${transcript}`,
  ].filter(Boolean).join("\n\n");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    system: buildAgentSystem("alina", CAPTION_TASK),
    messages: [{ role: "user", content: sanitizeForAnthropic(ctx) }],
  });

  const cost = await recordSpend({
    projectId, agentRole: "writer", model: MODEL, usage: res.usage as any, tgId: project.tg_id,
  });

  const raw = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  const out = safeJson<Out>(raw);
  if (!out || typeof out.caption !== "string") {
    return Response.json({ error: "invalid JSON from Алина" }, { status: 502 });
  }
  if (!Array.isArray(out.overlays)) out.overlays = [];
  out.overlays = out.overlays
    .filter((o: any) => o && typeof o.text === "string")
    .slice(0, 8)
    .map((o: any) => ({
      time: Math.max(0, Math.min(120, Math.round(Number(o.time) || 0))),
      duration: Math.max(1, Math.min(8, Math.round(Number(o.duration) || 3))),
      text: String(o.text).slice(0, 60),
    }));

  // обновляем draft: caption становится body
  if (draftId) {
    await sb.from("content_drafts").update({ body: out.caption, cost_usd: cost }).eq("id", draftId);
  }

  return Response.json({ caption: out.caption, overlays: out.overlays, cost });
}
