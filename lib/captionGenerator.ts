import Anthropic from "@anthropic-ai/sdk";
import type { BrandKit } from "./lexAI";

const MODEL = "claude-haiku-4-5-20251001";

export type CaptionStyle = "viral" | "expert" | "story" | "sales" | "minimal";

export type CaptionVariant = {
  style: CaptionStyle;
  style_label: string;
  text: string;
};

export type CaptionGenResult = {
  variants: CaptionVariant[];
  hashtags: string[];
};

const STYLE_LABELS: Record<CaptionStyle, string> = {
  viral: "Вирусный",
  expert: "Экспертный",
  story: "Душевный",
  sales: "Продающий",
  minimal: "Минималистичный",
};

function buildPrompt(topic: string, brand: BrandKit | null): string {
  const brandBlock = brand
    ? `Контекст бренда:
- Тема канала: ${brand.short_description}
- Тон: ${brand.voice}
- Аудитория: ${brand.audience}
- Цели контента: ${(brand.goals || []).join("; ")}`
    : "Контекст бренда не задан — используй универсальный тон.";

  return `Ты — топовый SMM-копирайтер для Instagram. Пишешь подписи под Reels на русском.

${brandBlock}

Тема Reels / о чём пост:
"""
${topic}
"""

Сгенерируй 5 РАЗНЫХ подписей под этот Reels — каждая в своём стиле:

1. **viral** (Вирусный) — короткая, цепляющая, hook в первой строке, обрывается на интриге. 2-4 строки. БЕЗ хештегов.
2. **expert** (Экспертный) — value-driven, конкретные приёмы/цифры/факты, нумерованный или маркированный список внутри. 4-7 строк. БЕЗ хештегов.
3. **story** (Душевный) — личная история или эмоция, "я когда-то...". 4-6 строк. БЕЗ хештегов.
4. **sales** (Продающий) — чёткое value-proposition + явный CTA (записаться, перейти, забрать). 3-5 строк. БЕЗ хештегов.
5. **minimal** (Минималистичный) — 1-2 короткие строки, без воды. БЕЗ хештегов.

Отдельно подбери 15 релевантных хештегов — смесь: 3-4 широких (1М+), 7-8 средних (50k-500k), 3-4 нишевых (< 50k). Без #-символа.

Правила:
- Никаких эмодзи в начале подписи как «маркера». Эмодзи можно только осмысленно внутри текста.
- Никаких «Привет всем!» и других клише.
- Не использовать слова: «гайд», «инсайты», «эксклюзивно».
- Каждая подпись должна звучать естественно, как от живого человека.

Верни СТРОГО JSON без markdown:
{
  "variants": [
    { "style": "viral", "text": "..." },
    { "style": "expert", "text": "..." },
    { "style": "story", "text": "..." },
    { "style": "sales", "text": "..." },
    { "style": "minimal", "text": "..." }
  ],
  "hashtags": ["тег1", "тег2", ...]
}`;
}

export async function generateCaptions(args: {
  topic: string;
  brand: BrandKit | null;
}): Promise<CaptionGenResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildPrompt(args.topic, args.brand);

  const r = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = r.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI вернул некорректный ответ");

  const parsed = JSON.parse(jsonMatch[0]) as {
    variants: { style: CaptionStyle; text: string }[];
    hashtags: string[];
  };

  const variants: CaptionVariant[] = (parsed.variants || []).map((v) => ({
    style: v.style,
    style_label: STYLE_LABELS[v.style] || v.style,
    text: String(v.text || "").trim(),
  }));

  const hashtags = (parsed.hashtags || [])
    .map((h) => String(h || "").trim().replace(/^#+/, ""))
    .filter(Boolean)
    .slice(0, 20);

  return { variants, hashtags };
}
