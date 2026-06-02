import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM = `Подбираешь emoji к ключевым словам в видео.
Для каждого слова верни ОДИН emoji который усиливает смысл (или пустую строку если не подходит).
Контекст — соседний транскрипт фразы. Учитывай его, чтобы emoji был релевантен теме.
Стиль: тематически точно, без банального (никаких 👍 ❤️ к произвольным словам).

Формат ответа — строго JSON одной строкой:
{"WORD1":"🚀","WORD2":""}

Никакого текста до или после JSON.`;

function safeJson<T>(s: string): T | null {
  try {
    return JSON.parse(s.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()) as T;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (req.headers.get("x-worker-secret") !== process.env.WORKER_SECRET) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const words: string[] = Array.isArray(body.words) ? body.words.map((w: any) => String(w).toUpperCase()) : [];
  const context = String(body.context || "").slice(0, 2000);

  if (words.length === 0) return Response.json({ emojis: {} });

  const userMsg = `Контекст:\n${context}\n\nКлючевые слова: ${words.join(", ")}\n\nВерни JSON {слово: emoji или ""}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });

  const raw = res.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  const parsed = safeJson<Record<string, string>>(raw) || {};
  const out: Record<string, string> = {};
  for (const w of words) {
    const v = parsed[w];
    out[w] = typeof v === "string" ? v.trim() : "";
  }
  return Response.json({ emojis: out });
}
