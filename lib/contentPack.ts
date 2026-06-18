import Anthropic from "@anthropic-ai/sdk";
import type { BrandKit } from "./lexAI";

const MODEL = "claude-haiku-4-5-20251001";

export type PackProjectContext = {
  niche?: string | null;
  audience?: string | null;
  content_goal?: string | null;
  content_style?: string | null;
  on_camera?: string | null;
  what_sells?: string | null;
  content_language?: string | null;
};

export type PackStoryboardScene = {
  scene: number;
  seconds: string;
  action: string;
  on_screen?: string;
};

export type PackReel = {
  title: string;
  hook: string;
  on_screen_text: string;
  voice_over: string;
  storyboard: PackStoryboardScene[];
  duration_sec: number;
  cta: string;
};

export type PackCarousel = {
  topic: string;
  hook: string;
  slides: { num: number; text: string }[];
  caption: string;
  hashtags: string[];
};

export type PackCaption = {
  text: string;
  hashtags: string[];
};

export type ContentPack = {
  reel: PackReel;
  carousel: PackCarousel;
  caption: PackCaption;
};

function onCameraLabel(v?: string | null): string {
  return v === "yes"
    ? "да, может говорить в камеру"
    : v === "sometimes"
    ? "иногда, не каждый ролик с лицом"
    : v === "no"
    ? "нет, не снимается на камеру (voice-over или без лица)"
    : "не указано";
}

function languageLabel(v?: string | null): string {
  return v === "en" ? "английский" : v === "other" ? "другой (по нише)" : "русский";
}

function buildPrompt(topic: string, brand: BrandKit | null, ctx: PackProjectContext): string {
  const niche = ctx.niche || brand?.short_description || "не задано";
  const audience = ctx.audience || brand?.audience || "не задано";
  const style = ctx.content_style || brand?.voice || "не задано";
  const goal = ctx.content_goal || (brand?.goals || []).join(", ") || "не задано";
  const sells = ctx.what_sells ? `Продаёт/продвигает: ${ctx.what_sells}` : "";

  return `Ты — контент-продюсер для Instagram-блогеров. Из ОДНОЙ идеи собираешь связанный пакет материалов в трёх форматах: Reels-сценарий, карусель и подпись. Все три должны раскрывать одну и ту же идею под разными углами, но не дублировать друг друга дословно.

Проект автора:
- Ниша: ${niche}
- Аудитория: ${audience}
- Стиль подачи: ${style}
- Главная цель: ${goal}
- Формат съёмки: ${onCameraLabel(ctx.on_camera)}
- Язык контента: ${languageLabel(ctx.content_language)}
${sells ? "- " + sells : ""}

Идея/тема пакета:
"""
${topic}
"""

Собери пакет. Весь текст — на языке: ${languageLabel(ctx.content_language)}. Учитывай формат съёмки (если автор не снимается лицом — voice-over/без лица).

Верни СТРОГО валидный JSON без markdown, ровно в этой структуре:
{
  "reel": {
    "title": "короткое название ролика",
    "hook": "первые 1-3 секунды — цепляющая фраза",
    "on_screen_text": "крупный текст на экране в начале",
    "voice_over": "полный текст озвучки, абзацами",
    "storyboard": [
      { "scene": 1, "seconds": "0-3", "action": "что в кадре", "on_screen": "текст на экране" }
    ],
    "duration_sec": 30,
    "cta": "призыв к действию в конце"
  },
  "carousel": {
    "topic": "тема карусели",
    "hook": "текст первого слайда (обложка)",
    "slides": [
      { "num": 1, "text": "текст слайда 1 (обложка-хук)" },
      { "num": 2, "text": "текст слайда 2" }
    ],
    "caption": "подпись под карусель (2-4 строки)",
    "hashtags": ["#тег1", "#тег2"]
  },
  "caption": {
    "text": "самостоятельная цепляющая подпись под пост по этой идее (3-6 строк)",
    "hashtags": ["#тег1", "#тег2"]
  }
}

Требования:
- reel.storyboard: 3-5 сцен, покрывают всю длительность, seconds в формате "0-3".
- carousel.slides: 6 слайдов (обложка + 4 смысловых + финал с CTA).
- hashtags: 8-15 релевантных нише.
- Все поля заполнены, без плейсхолдеров и пустых строк.`;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(asString).filter(Boolean) : [];
}

/** Генерирует контент-пакет (Reels + карусель + подпись) из одной идеи. */
export async function generateContentPack(args: {
  topic: string;
  brand: BrandKit | null;
  projectCtx: PackProjectContext;
}): Promise<ContentPack> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildPrompt(args.topic, args.brand, args.projectCtx);

  const r = await client.messages.create({
    model: MODEL,
    max_tokens: 3500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = r.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI вернул некорректный ответ");

  const p = JSON.parse(m[0]) as Record<string, any>;
  const rl = p.reel || {};
  const cr = p.carousel || {};
  const cp = p.caption || {};

  const storyboard: PackStoryboardScene[] = Array.isArray(rl.storyboard)
    ? rl.storyboard.map((s: any, i: number) => ({
        scene: Number(s.scene) || i + 1,
        seconds: asString(s.seconds) || `${i * 3}-${i * 3 + 3}`,
        action: asString(s.action),
        on_screen: asString(s.on_screen) || undefined,
      }))
    : [];

  const slides = Array.isArray(cr.slides)
    ? cr.slides.map((s: any, i: number) => ({
        num: Number(s.num) || i + 1,
        text: asString(s.text),
      }))
    : [];

  const reel: PackReel = {
    title: asString(rl.title) || args.topic.slice(0, 60),
    hook: asString(rl.hook),
    on_screen_text: asString(rl.on_screen_text),
    voice_over: asString(rl.voice_over),
    storyboard,
    duration_sec: Math.max(10, Math.min(90, Number(rl.duration_sec) || 30)),
    cta: asString(rl.cta),
  };

  const carousel: PackCarousel = {
    topic: asString(cr.topic) || args.topic.slice(0, 80),
    hook: asString(cr.hook),
    slides,
    caption: asString(cr.caption),
    hashtags: asStringArray(cr.hashtags),
  };

  const caption: PackCaption = {
    text: asString(cp.text),
    hashtags: asStringArray(cp.hashtags),
  };

  if (!reel.voice_over && slides.length === 0 && !caption.text) {
    throw new Error("AI не вернул пакет. Попробуй ещё раз.");
  }

  return { reel, carousel, caption };
}
