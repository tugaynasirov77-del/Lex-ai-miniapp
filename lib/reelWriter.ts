import Anthropic from "@anthropic-ai/sdk";
import { buildAgentSystem } from "./agents";
import { sanitizeForAnthropic } from "./sanitize";
import { recordSpend } from "./projectBudget";

const MODEL = "claude-sonnet-4-6";

const REEL_TASK = `ЗАДАЧА: написать сценарий 30-секундного Reel для Instagram.

Входной контекст: ниша и тема (от пользователя).

Что делаешь:
1. Пишешь script — текст, который скажет аватар (HeyGen). Разговорный, для произнесения вслух.
   • Длина 60–90 слов (≈25–35 сек речи на нормальной скорости)
   • Hook в первой фразе: цифра, неожиданное утверждение или вопрос
   • Концовка: вопрос аудитории / провокация / CTA
   • БЕЗ упоминаний годов
   • Простые слова, короткие предложения
2. Пишешь caption — подпись под Reel в Instagram (для текста под видео):
   • 100–300 символов
   • С эмодзи (1–3)
   • Можно 3–5 hashtag в конце
3. Пишешь overlays — текстовые подложки, которые FFmpeg выжжет поверх видео в нужный момент:
   • 3–5 штук
   • Короткие фразы (≤ 40 символов каждая)
   • time — секунда с начала видео (число), duration — сколько висит (число)
   • Это акценты на ключевых словах, не дубль всего текста

Формат ответа — строгий JSON одной строкой:
{"script":"...","caption":"...","overlays":[{"time":2,"text":"90% агентов = обёртка","duration":3},{"time":8,"text":"вот что важно","duration":2}]}

Никакого текста до или после JSON.`;

export type ReelDraft = {
  script: string;
  caption: string;
  overlays: { time: number; text: string; duration: number }[];
};

function safeJson<T>(s: string): T | null {
  try {
    return JSON.parse(s.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()) as T;
  } catch {
    return null;
  }
}

export async function generateReelScript(args: {
  client: Anthropic;
  topic: string;
  niche?: string | null;
  projectId: string;
  tgId: number;
}): Promise<{ draft: ReelDraft | null; cost: number }> {
  const { client, topic, niche, projectId, tgId } = args;

  const userCtx = [
    niche ? `Ниша: ${niche}` : "",
    `Тема Reel: ${topic}`,
    "Напиши сценарий по этой теме.",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 900,
    system: buildAgentSystem("alina", REEL_TASK),
    messages: [{ role: "user", content: sanitizeForAnthropic(userCtx) }],
  });

  const cost = await recordSpend({
    projectId,
    agentRole: "writer",
    model: MODEL,
    usage: res.usage as any,
    tgId,
  });

  const raw = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  const draft = safeJson<ReelDraft>(raw);

  if (!draft || typeof draft.script !== "string" || !draft.script.trim()) {
    return { draft: null, cost };
  }
  if (!Array.isArray(draft.overlays)) draft.overlays = [];
  if (typeof draft.caption !== "string") draft.caption = "";

  // нормализация overlays
  draft.overlays = draft.overlays
    .filter((o: any) => o && typeof o.text === "string")
    .slice(0, 8)
    .map((o: any) => ({
      time: Math.max(0, Math.min(60, Math.round(Number(o.time) || 0))),
      duration: Math.max(1, Math.min(8, Math.round(Number(o.duration) || 3))),
      text: String(o.text).slice(0, 60),
    }));

  return { draft, cost };
}
