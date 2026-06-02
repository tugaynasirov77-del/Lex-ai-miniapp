import Anthropic from "@anthropic-ai/sdk";
import { buildAgentSystem } from "./agents";
import { sanitizeForAnthropic } from "./sanitize";
import { recordSpend } from "./projectBudget";

export const ARKADIY_MODEL = "claude-sonnet-4-6";

export type EditorVerdict = "approve" | "rewrite";

export type DraftJSON = { titles: string[]; body: string };

export type EditorReview = {
  score: number; // 1..10 общий
  hook_strength: number; // 1..10
  cta_present: boolean;
  clarity: number; // 1..10
  errors: string[];
  comments: string;
  verdict: EditorVerdict;
  cleaned: DraftJSON; // отредактированный текст
};

const ARKADIY_TASK = `ЗАДАЧА: оценить черновик поста и почистить его.

Входной JSON: {"titles":[...],"body":"..."}.

Что делаешь:
1. Чистишь body как редактор:
   • орфография и пунктуация — приоритет №1
   • убираешь канцеляризмы, штампы, водянистые обороты
   • если body >800 символов — сокращаешь до 600–800, не теряя сути
   • убираешь упоминания конкретных годов и "в этом году"/"сегодня"
   • разметка Telegram HTML: разрешены ТОЛЬКО <b> <i> <u> <blockquote>. Остальные теги удалить, оставив содержимое. Markdown (**, __, #) — заменить на нужный тег или убрать.
   • ровно ОДИН <blockquote> с ключевой фразой
   • спецсимволы &<> вне тегов → &amp; &lt; &gt;
2. Оцениваешь итоговую версию по шкалам 1–10:
   • score — общий балл
   • hook_strength — насколько цепляет первая строка
   • clarity — ясность мысли
   • cta_present — есть ли явное действие (вопрос аудитории / призыв / ссылка / провокация)
3. errors — список конкретных косяков (если есть)
4. comments — короткий вердикт для копирайтера (1–2 предложения), что улучшить если score<7
5. verdict — "approve" если score≥7, иначе "rewrite"

Формат ответа — строгий JSON одной строкой:
{"score":8,"hook_strength":7,"cta_present":true,"clarity":9,"errors":[],"comments":"...","verdict":"approve","cleaned":{"titles":["..","..",".."],"body":"..."}}

Никакого текста до или после JSON.`;

function safeJson<T>(s: string): T | null {
  try {
    const cleaned = s.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

export async function reviewDraft(args: {
  client: Anthropic;
  draft: DraftJSON;
  projectId: string;
  tgId: number;
}): Promise<{ review: EditorReview | null; cost: number }> {
  const { client, draft, projectId, tgId } = args;

  const res = await client.messages.create({
    model: ARKADIY_MODEL,
    max_tokens: 900,
    system: buildAgentSystem("arkadiy", ARKADIY_TASK),
    messages: [{ role: "user", content: sanitizeForAnthropic(JSON.stringify(draft)) }],
  });

  const cost = await recordSpend({
    projectId,
    agentRole: "editor",
    model: ARKADIY_MODEL,
    usage: res.usage as any,
    tgId,
  });

  const raw = res.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  const parsed = safeJson<EditorReview>(raw);
  if (!parsed || typeof parsed.score !== "number" || !parsed.cleaned || !parsed.cleaned.body) {
    return { review: null, cost };
  }

  // нормализация
  parsed.score = Math.max(1, Math.min(10, Math.round(parsed.score)));
  parsed.verdict = parsed.score >= 7 ? "approve" : "rewrite";
  if (!Array.isArray(parsed.cleaned.titles)) parsed.cleaned.titles = draft.titles;
  if (!Array.isArray(parsed.errors)) parsed.errors = [];
  if (typeof parsed.comments !== "string") parsed.comments = "";

  return { review: parsed, cost };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reel caption review (v1)
// ─────────────────────────────────────────────────────────────────────────────

export const ARKADIY_REEL_CAPTION_PROMPT_VERSION = "v1";

export type ReelCaptionReview = {
  score: number;
  hook_strength: number;
  cta_present: boolean;
  clarity: number;
  errors: string[];
  comments: string;
  verdict: EditorVerdict;
  cleaned_caption: string;
};

const ARKADIY_REEL_CAPTION_TASK = `ЗАДАЧА: оценить и почистить caption для Instagram Reel.

Входной JSON: {"caption":"...","transcript":"..."}.
"transcript" — что говорит человек в видео. Caption должен соответствовать смыслу.

Что делаешь:
1. Чистишь caption:
   • орфография, пунктуация, регистр
   • убираешь канцеляризмы, штампы, водянистые обороты
   • длина 100–300 символов (без хэштегов), если выходит — поджимаешь
   • Hook в первой строке (цифра / провокация / вопрос)
   • эмодзи 1–3 штуки, тематические
   • концовка: вопрос или CTA
   • хэштеги 3–5 штук по теме, английские, в конце через пробел
   • никакого markdown (**, __, #), только plain text + эмодзи
2. Проверь соответствие транскрипту: caption не должен противоречить тому, что говорится в видео
3. Оценки 1–10: score, hook_strength, clarity, cta_present (bool)
4. errors — конкретные косяки
5. comments — короткий вердикт для копирайтера (1–2 предложения), что улучшить если score<7
6. verdict — "approve" если score≥7, иначе "rewrite"

Формат ответа — строгий JSON одной строкой:
{"score":8,"hook_strength":7,"cta_present":true,"clarity":9,"errors":[],"comments":"...","verdict":"approve","cleaned_caption":"..."}

Никакого текста до или после JSON.`;

export async function reviewReelCaption(args: {
  client: Anthropic;
  caption: string;
  transcript: string;
  projectId: string;
  tgId: number;
}): Promise<{ review: ReelCaptionReview | null; cost: number }> {
  const { client, caption, transcript, projectId, tgId } = args;

  const res = await client.messages.create({
    model: ARKADIY_MODEL,
    max_tokens: 900,
    system: buildAgentSystem("arkadiy", ARKADIY_REEL_CAPTION_TASK),
    messages: [
      {
        role: "user",
        content: sanitizeForAnthropic(
          JSON.stringify({ caption, transcript: transcript.slice(0, 4000) })
        ),
      },
    ],
  });

  const cost = await recordSpend({
    projectId,
    agentRole: "editor",
    model: ARKADIY_MODEL,
    usage: res.usage as any,
    tgId,
  });

  const raw = res.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  const parsed = safeJson<ReelCaptionReview>(raw);
  if (
    !parsed ||
    typeof parsed.score !== "number" ||
    typeof parsed.cleaned_caption !== "string" ||
    parsed.cleaned_caption.trim().length === 0
  ) {
    return { review: null, cost };
  }

  parsed.score = Math.max(1, Math.min(10, Math.round(parsed.score)));
  parsed.verdict = parsed.score >= 7 ? "approve" : "rewrite";
  if (!Array.isArray(parsed.errors)) parsed.errors = [];
  if (typeof parsed.comments !== "string") parsed.comments = "";
  parsed.cleaned_caption = parsed.cleaned_caption.trim().slice(0, 1000);

  return { review: parsed, cost };
}
