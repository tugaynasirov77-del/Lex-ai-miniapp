import Anthropic from "@anthropic-ai/sdk";
import { buildAgentSystem } from "./agents";
import { sanitizeForAnthropic } from "./sanitize";
import { recordSpend } from "./projectBudget";

// На Vercel Hobby (10s ceiling) Sonnet не помещается в after()-бюджет.
// Haiku 4.5 в ~3× быстрее, для слайдов карусели качество приемлемое.
// На Vercel Pro (60s) — вернуть на claude-sonnet-4-6.
export const ALINA_CAROUSEL_MODEL = "claude-haiku-4-5-20251001";
export const ALINA_CAROUSEL_PROMPT_VERSION = "v1";

export type CarouselSlide = {
  index: number;          // 1..N
  title: string;          // короткий заголовок слайда (до 40 симв)
  body: string;           // основной текст слайда (до 220 симв)
  visual: string;         // подсказка по визуалу (до 120 симв)
};

export type CarouselDraft = {
  carousel_title: string; // общее название карусели
  hook: string;           // hook первого слайда
  cta: string;            // CTA последнего слайда
  caption: string;        // caption под пост в IG (с хэштегами)
  slides: CarouselSlide[];
};

const CAROUSEL_TASK = `ЗАДАЧА: написать сценарий Instagram-карусели по заданной теме.

Структура карусели — 6–8 слайдов:
1) Hook-слайд: цепляющий заголовок (вопрос / цифра / провокация). title ≤40 символов, body ≤120.
2–6) Основные слайды: каждый раскрывает одну мысль / шаг / факт. title ≤40, body ≤220.
7) CTA-слайд: предлагает действие (комментарий / сохранение / переход в профиль). title ≤40, body ≤180.

Также:
- carousel_title — общее название карусели для внутреннего использования (≤60 символов)
- hook — текст hook-слайда (дубликат title первого слайда, для удобства фронта)
- cta — текст CTA (дубликат title последнего слайда)
- caption — подпись под пост в IG: 200–500 символов + 3–5 английских хэштега в конце. Hook в первой строке. 1–3 эмодзи. Никакого markdown.
- для каждого слайда поле "visual" — короткая подсказка по визуалу (≤120 символов): фон, акцентный объект, типографика, цветовая идея

Запреты:
- не упоминай конкретные годы
- не используй markdown (**, __, #) — только plain text + эмодзи
- никаких "сегодня", "в этом году"
- не больше 8 слайдов

Формат ответа — строгий JSON одной строкой:
{"carousel_title":"...","hook":"...","cta":"...","caption":"...","slides":[{"index":1,"title":"...","body":"...","visual":"..."},...]}

Никакого текста до или после JSON.`;

function safeJson<T>(s: string): T | null {
  try {
    return JSON.parse(s.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()) as T;
  } catch {
    return null;
  }
}

function clampStr(s: any, max: number): string {
  return String(s ?? "").trim().slice(0, max);
}

export async function generateCarousel(args: {
  client: Anthropic;
  topic: string;
  nicheSummary?: string;
  projectId: string;
  tgId: number;
  extraSystem?: string;
}): Promise<{ carousel: CarouselDraft | null; cost: number }> {
  const { client, topic, nicheSummary, projectId, tgId, extraSystem } = args;

  const ctx = [
    nicheSummary ? `Ниша: ${nicheSummary}` : "",
    `Тема карусели: ${topic}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const task = extraSystem ? `${CAROUSEL_TASK}\n\n${extraSystem}` : CAROUSEL_TASK;

  const res = await client.messages.create({
    model: ALINA_CAROUSEL_MODEL,
    max_tokens: 1600,
    system: buildAgentSystem("alina", task),
    messages: [{ role: "user", content: sanitizeForAnthropic(ctx) }],
  });

  const cost = await recordSpend({
    projectId,
    agentRole: "writer",
    model: ALINA_CAROUSEL_MODEL,
    usage: res.usage as any,
    tgId,
  });

  const raw = res.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  const parsed = safeJson<CarouselDraft>(raw);
  if (!parsed || !Array.isArray(parsed.slides) || parsed.slides.length < 3) {
    return { carousel: null, cost };
  }

  // Нормализация
  const slides: CarouselSlide[] = parsed.slides
    .slice(0, 8)
    .map((s, i) => ({
      index: i + 1,
      title: clampStr(s.title, 60),
      body: clampStr(s.body, 240),
      visual: clampStr(s.visual, 140),
    }))
    .filter((s) => s.title.length > 0 || s.body.length > 0);

  if (slides.length < 3) return { carousel: null, cost };

  const norm: CarouselDraft = {
    carousel_title: clampStr(parsed.carousel_title, 80),
    hook: clampStr(parsed.hook || slides[0].title, 100),
    cta: clampStr(parsed.cta || slides[slides.length - 1].title, 100),
    caption: clampStr(parsed.caption, 1200),
    slides,
  };

  return { carousel: norm, cost };
}
