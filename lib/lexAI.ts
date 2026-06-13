import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "./supabase";
import { sanitizeForAnthropic } from "./sanitize";
import { recordSpend, type AnthropicModel } from "./projectBudget";

// LEX AI — единый агент-инструмент.
// Заменяет: contentWriter (Алина), arkadiyEditor (Аркадий),
// strategist (Александр), carouselWriter, igAnalyst (Анна),
// igPlanner, reelWriter.
//
// Маркетинг команды из 7 агентов остаётся в UI/лендинге.
// В коде — один инструмент с 4 методами.

const LEX_MODEL: AnthropicModel = "claude-haiku-4-5-20251001";

// Единый system prompt. Содержит идентичность, принципы качества,
// hook-формулы, запреты штампов. Подходит для всех 4 методов.
const LEX_SYSTEM = `Ты — LEX AI, инструмент для создания контента в Telegram и Instagram.

ПРИНЦИПЫ:
1. Конкретика > абстракции. Используй цифры, имена, события, цитаты.
2. Hook в первой строке: цифра ИЛИ парадокс ИЛИ провокация. Максимум 12 слов.
3. Структура: hook → суть (1-3 факта) → инсайт → CTA.
4. Каждый материал учится на топ-постах конкурентов. Не копируй — делай в той же логике, но лучше.
5. Tone of voice бренда — священен. Не выходи за brand_kit.

ЗАПРЕЩЕНЫ слова и обороты:
успех, развитие, эффективность, потенциал, синергия, оптимизация,
продуктивность, лидерство, ценность, качественный, важно отметить,
в современном мире, на сегодняшний день, всем известно, давайте поговорим,
я хочу поделиться, в этом году, сегодня многие.

HOOK-ФОРМУЛЫ (выбери одну):
- ЦИФРА: «47%», «3 года», «12 ошибок»
- ПАРАДОКС: «Я уволил клиентов и заработал больше»
- ВРЕМЯ: «За 30 минут я понял, что 5 лет ошибался»
- ПОТЕРЯ: «Потерял 2 млн на простой ошибке»
- ПРИЗНАНИЕ: «Долго стеснялся это сказать»
- ПРОТИВ ТОЛПЫ: «Все говорят X. Это неправда»
- ВОПРОС-ТРИГГЕР: «Почему ты до сих пор делаешь Y?»

Каждый материал ДОЛЖЕН содержать минимум ОДНО из:
- Конкретное число с единицей измерения (47%, 3 млн ₽, 8 минут)
- Имя реального человека или бренда
- Конкретное событие с датой/местом
- Прямая цитата

ОТВЕТ ВСЕГДА — строгий JSON одной строкой по указанной схеме.
Без префиксов, без markdown-кодблоков, без комментариев.`;

// ---------- Helpers ----------

function safeJson<T>(s: string): T | null {
  try {
    const cleaned = s.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

function extractText(res: Anthropic.Messages.Message): string {
  return res.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// ---------- Types ----------

export type CompetitorInput = {
  handle: string;
  topPosts?: { text: string; views?: number | null }[];
  description?: string | null;
};

export type LexInsights = {
  niche_summary: string;        // 1-2 предложения о нише
  audience_pains: string[];     // 3-5 болей аудитории
  working_hooks: string[];      // 5-7 hook-паттернов которые работают у конкурентов
  content_themes: string[];     // 5-8 ходовых тем
  tone_notes: string;           // как пишут конкуренты (тон)
  pitfalls: string[];           // 3-5 ошибок которые делать НЕ нужно
  updated_at: string;           // ISO
};

export type BrandKit = {
  channel_title: string;
  short_description: string;    // 1 предложение про канал
  voice: string;                // тон (личное/деловое/ироничное)
  audience: string;             // ЦА в 1 предложении
  goals: string[];              // 2-3 цели контента
};

export type PostVariant = {
  hook: string;                 // первая строка
  body: string;                 // полный текст 300-450 симв
  title: string;                // 30-70 симв, plain text
};

export type CarouselDraft = {
  topic: string;
  hook: string;                 // дубликат title 1-го слайда для удобства фронта
  image_prompt: string;         // готовый промпт для Midjourney/Sora/DALL-E
  slides: { num: number; text: string }[]; // 6-8 слайдов
  caption: string;              // под пост, 200-400 симв + хэштеги
  hashtags: string[];           // 5-7 хэштегов отдельно
};

export type ReelScript = {
  topic: string;
  hook: string;                 // первые 3 секунды на камеру
  scenes: { seconds: string; action: string; on_screen?: string }[]; // раскадровка
  music_hint: string;           // подсказка по музыке/тренду
  caption: string;              // под видео
  hashtags: string[];           // 5-7
  duration_sec: number;         // целевая длительность
};

// ---------- Method 1: analyzeCompetitors ----------

/**
 * Анализ ниши и конкурентов. Результат кешируется в БД (projects.lex_insights).
 * Возвращает структурированные insights для использования во всех 3 generator-методах.
 *
 * Кеш живёт 7 дней — после этого рекомендуется обновить (вне этого метода).
 */
export async function analyzeCompetitors(args: {
  client: Anthropic;
  projectId: string;
  tgId: number;
  channelTitle: string;
  niche?: string;
  competitors: CompetitorInput[];
}): Promise<{ insights: LexInsights | null; cost: number }> {
  const { client, projectId, tgId, channelTitle, niche, competitors } = args;

  const lines: string[] = [];
  lines.push(`Канал: ${channelTitle}`);
  if (niche) lines.push(`Ниша: ${niche}`);
  lines.push("");
  lines.push(`Конкуренты (${competitors.length}):`);
  for (const c of competitors.slice(0, 5)) {
    lines.push(`— @${c.handle}`);
    if (c.description) lines.push(`  Описание: ${c.description.slice(0, 200)}`);
    if (c.topPosts && c.topPosts.length > 0) {
      lines.push("  Топ постов:");
      for (const p of c.topPosts.slice(0, 3)) {
        const v = p.views ? ` [👁 ${p.views}]` : "";
        lines.push(`    ·${v} ${p.text.replace(/\n+/g, " ").slice(0, 200)}`);
      }
    }
  }

  const task = `ЗАДАЧА: проанализируй конкурентов и выдай insights для генерации контента.

Верни JSON:
{
  "niche_summary": "1-2 предложения о нише",
  "audience_pains": ["боль 1", "боль 2", "боль 3"],
  "working_hooks": ["рабочий hook-паттерн 1", "паттерн 2", ...],
  "content_themes": ["тема 1", "тема 2", ...],
  "tone_notes": "1-2 предложения о тоне конкурентов",
  "pitfalls": ["ошибка 1", "ошибка 2", "ошибка 3"]
}

Только JSON, ничего больше.`;

  const res = await client.messages.create({
    model: LEX_MODEL,
    max_tokens: 900,
    temperature: 0.5,
    system: LEX_SYSTEM + "\n\n" + task,
    messages: [{ role: "user", content: sanitizeForAnthropic(lines.join("\n")) }],
  });

  const cost = await recordSpend({
    projectId,
    agentRole: "lex_analyze",
    model: LEX_MODEL,
    usage: res.usage as any,
    tgId,
  });

  const raw = extractText(res);
  const parsed = safeJson<Omit<LexInsights, "updated_at">>(raw);
  if (!parsed || !parsed.niche_summary) {
    return { insights: null, cost };
  }

  const insights: LexInsights = {
    niche_summary: String(parsed.niche_summary).slice(0, 400),
    audience_pains: Array.isArray(parsed.audience_pains)
      ? parsed.audience_pains.slice(0, 5).map((s) => String(s).slice(0, 200))
      : [],
    working_hooks: Array.isArray(parsed.working_hooks)
      ? parsed.working_hooks.slice(0, 7).map((s) => String(s).slice(0, 200))
      : [],
    content_themes: Array.isArray(parsed.content_themes)
      ? parsed.content_themes.slice(0, 8).map((s) => String(s).slice(0, 200))
      : [],
    tone_notes: String(parsed.tone_notes || "").slice(0, 400),
    pitfalls: Array.isArray(parsed.pitfalls)
      ? parsed.pitfalls.slice(0, 5).map((s) => String(s).slice(0, 200))
      : [],
    updated_at: new Date().toISOString(),
  };

  // Сохраняем в БД для дальнейшего переиспользования
  const sb = getSupabase();
  await sb
    .from("projects")
    .update({
      lex_insights: insights,
      lex_insights_updated_at: insights.updated_at,
    })
    .eq("id", projectId);

  return { insights, cost };
}

/**
 * Подтягивает insights из БД. Если устарел >7 дней — возвращает stale=true.
 */
export async function getInsightsFromCache(
  projectId: string,
): Promise<{ insights: LexInsights | null; stale: boolean }> {
  const sb = getSupabase();
  const { data } = await sb
    .from("projects")
    .select("lex_insights, lex_insights_updated_at")
    .eq("id", projectId)
    .maybeSingle();
  if (!data?.lex_insights) return { insights: null, stale: true };
  const updated = data.lex_insights_updated_at
    ? new Date(data.lex_insights_updated_at).getTime()
    : 0;
  const ageDays = (Date.now() - updated) / (1000 * 60 * 60 * 24);
  return { insights: data.lex_insights as LexInsights, stale: ageDays > 7 };
}

// ---------- Helper: build context block for generators ----------

function buildContextBlock(insights: LexInsights | null, brand: BrandKit | null): string {
  const parts: string[] = [];
  if (brand) {
    parts.push("БРЕНД:");
    parts.push(`- Канал: ${brand.channel_title}`);
    if (brand.short_description) parts.push(`- О чём: ${brand.short_description}`);
    if (brand.voice) parts.push(`- Тон: ${brand.voice}`);
    if (brand.audience) parts.push(`- Аудитория: ${brand.audience}`);
    if (brand.goals?.length) parts.push(`- Цели: ${brand.goals.join("; ")}`);
    parts.push("");
  }
  if (insights) {
    parts.push("КОНТЕКСТ НИШИ И КОНКУРЕНТОВ:");
    if (insights.niche_summary) parts.push(`- Ниша: ${insights.niche_summary}`);
    if (insights.audience_pains?.length)
      parts.push(`- Боли аудитории: ${insights.audience_pains.join("; ")}`);
    if (insights.working_hooks?.length)
      parts.push(`- Рабочие hook-паттерны у конкурентов: ${insights.working_hooks.join("; ")}`);
    if (insights.tone_notes) parts.push(`- Тон конкурентов: ${insights.tone_notes}`);
    if (insights.pitfalls?.length)
      parts.push(`- Чего избегать: ${insights.pitfalls.join("; ")}`);
    parts.push("");
  }
  return parts.join("\n");
}

// ---------- Method 2: writePost (3 variants) ----------

/**
 * Пишет 3 варианта Telegram-поста за один Anthropic-вызов.
 * 300-450 символов каждый. max_tokens=900 (3×~300 output).
 * Время на Haiku: 4-6 секунд. Влезает в Vercel Hobby 10с ceiling.
 */
export async function writePost(args: {
  client: Anthropic;
  projectId: string;
  tgId: number;
  topic: string;
  insights: LexInsights | null;
  brand: BrandKit | null;
}): Promise<{ variants: PostVariant[]; cost: number }> {
  const { client, projectId, tgId, topic, insights, brand } = args;

  const ctx = buildContextBlock(insights, brand);

  const task = `ЗАДАЧА: напиши 3 РАЗНЫХ варианта Telegram-поста на тему.

Тема: ${topic}

Длина body: СТРОГО 300-450 символов. Не больше.
Структура: hook → суть (1-3 факта) → инсайт → CTA.

Каждый из 3 вариантов — РАЗНЫЙ hook (выбери из формул в системе):
- Вариант 1: hook с цифрой
- Вариант 2: hook с парадоксом/историей
- Вариант 3: hook с провокацией/против толпы

Plain text. Без HTML-тегов, без markdown. Эмодзи 0-2 на пост, по делу.

Верни JSON:
{
  "variants": [
    {"hook": "первая строка варианта 1", "body": "полный текст 300-450 симв", "title": "заголовок 30-70 симв"},
    {"hook": "...", "body": "...", "title": "..."},
    {"hook": "...", "body": "...", "title": "..."}
  ]
}

Только JSON.`;

  const res = await client.messages.create({
    model: LEX_MODEL,
    max_tokens: 1200,
    temperature: 0.7,
    system: LEX_SYSTEM,
    messages: [
      { role: "user", content: sanitizeForAnthropic(ctx + "\n" + task) },
    ],
  });

  const cost = await recordSpend({
    projectId,
    agentRole: "lex_post",
    model: LEX_MODEL,
    usage: res.usage as any,
    tgId,
  });

  const raw = extractText(res);
  const parsed = safeJson<{ variants: PostVariant[] }>(raw);
  if (!parsed || !Array.isArray(parsed.variants) || parsed.variants.length === 0) {
    return { variants: [], cost };
  }

  const variants: PostVariant[] = parsed.variants
    .slice(0, 3)
    .map((v) => ({
      hook: String(v.hook ?? "").slice(0, 200),
      body: String(v.body ?? "").trim().slice(0, 600),
      title: String(v.title ?? "").slice(0, 100),
    }))
    .filter((v) => v.body.length > 50);

  return { variants, cost };
}

// ---------- Method 3: writeCarousel (prompt-based) ----------

export type CarouselStyle =
  | "minimal"      // Inter + один акцент
  | "pop"          // gradient + эмодзи
  | "editorial"    // NYT-style
  | "ai_tech"      // futuristic, neon
  | "business";    // corporate clean

const STYLE_PROMPTS: Record<CarouselStyle, string> = {
  minimal:
    "minimalist Instagram carousel, light neutral background, single bold Inter title, thin accent line, one geometric shape, lots of whitespace, --ar 4:5 --v 6",
  pop:
    "vibrant Instagram carousel, gradient background (sunset hues), playful sans-serif title, large emoji as visual anchor, modern Gen-Z aesthetic, --ar 4:5 --v 6",
  editorial:
    "editorial Instagram carousel in The New York Times style, serif typography (Playfair Display), muted off-white background, classic photo-journalism feel, --ar 4:5 --v 6",
  ai_tech:
    "futuristic Instagram carousel, dark navy background, neon cyan and magenta accents, glassmorphism panels, monospace text, AI-tech aesthetic, --ar 4:5 --v 6",
  business:
    "corporate Instagram carousel, clean white background, dark blue brand color, professional sans-serif (Inter Bold), single icon per slide, McKinsey-style minimalism, --ar 4:5 --v 6",
};

/**
 * Карусель в prompt-based формате. Не рендерит картинки —
 * выдаёт готовый промпт для Midjourney/Sora/DALL-E + тексты слайдов + caption.
 * Один вызов Haiku, ~3-4 секунды.
 */
export async function writeCarousel(args: {
  client: Anthropic;
  projectId: string;
  tgId: number;
  topic: string;
  style?: CarouselStyle;
  insights: LexInsights | null;
  brand: BrandKit | null;
}): Promise<{ carousel: CarouselDraft | null; cost: number }> {
  const { client, projectId, tgId, topic, style = "minimal", insights, brand } = args;

  const ctx = buildContextBlock(insights, brand);
  const styleHint = STYLE_PROMPTS[style];

  const task = `ЗАДАЧА: придумай Instagram-карусель из 6-8 слайдов.

Тема: ${topic}

Структура карусели:
- Слайд 1: HOOK (цифра/парадокс/провокация). ≤40 символов.
- Слайды 2-6: основная мысль, по одной идее на слайд. ≤60 символов каждый.
- Последний: CTA (сохрани/подпишись/поделись). ≤40 символов.

ВИЗУАЛЬНЫЙ СТИЛЬ (используй для image_prompt): ${styleHint}

Верни JSON:
{
  "topic": "...",
  "hook": "текст hook-слайда (дубликат slides[0].text)",
  "image_prompt": "ПОЛНЫЙ промпт для Midjourney/Sora — английский, со стилем выше, единый для всей карусели",
  "slides": [
    {"num": 1, "text": "текст слайда 1"},
    {"num": 2, "text": "..."},
    ...
  ],
  "caption": "Подпись под пост 200-400 символов, hook первой строкой, без markdown",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}

Только JSON.`;

  const res = await client.messages.create({
    model: LEX_MODEL,
    max_tokens: 1400,
    temperature: 0.7,
    system: LEX_SYSTEM,
    messages: [
      { role: "user", content: sanitizeForAnthropic(ctx + "\n" + task) },
    ],
  });

  const cost = await recordSpend({
    projectId,
    agentRole: "lex_carousel",
    model: LEX_MODEL,
    usage: res.usage as any,
    tgId,
  });

  const raw = extractText(res);
  const parsed = safeJson<CarouselDraft>(raw);
  if (!parsed || !Array.isArray(parsed.slides) || parsed.slides.length < 3) {
    return { carousel: null, cost };
  }

  const slides = parsed.slides
    .slice(0, 8)
    .map((s, i) => ({
      num: i + 1,
      text: String(s.text ?? "").trim().slice(0, 100),
    }))
    .filter((s) => s.text.length > 0);

  if (slides.length < 3) return { carousel: null, cost };

  const carousel: CarouselDraft = {
    topic: String(parsed.topic || topic).slice(0, 120),
    hook: String(parsed.hook || slides[0].text).slice(0, 100),
    image_prompt: String(parsed.image_prompt || "").slice(0, 800),
    slides,
    caption: String(parsed.caption || "").slice(0, 600),
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags
          .slice(0, 7)
          .map((h) => String(h).replace(/^#?/, "#").slice(0, 40))
      : [],
  };

  return { carousel, cost };
}

// ---------- Method 4: writeReelScript ----------

/**
 * Сценарий Reels (текстовый, без рендера). Юзер сам снимает по сценарию.
 * Один вызов Haiku, ~3-4 секунды.
 */
export async function writeReelScript(args: {
  client: Anthropic;
  projectId: string;
  tgId: number;
  topic: string;
  duration?: 15 | 30 | 60; // секунды
  insights: LexInsights | null;
  brand: BrandKit | null;
}): Promise<{ script: ReelScript | null; cost: number }> {
  const { client, projectId, tgId, topic, duration = 30, insights, brand } = args;

  const ctx = buildContextBlock(insights, brand);

  const task = `ЗАДАЧА: напиши сценарий Reels на ${duration} секунд.

Тема: ${topic}

Структура:
- HOOK (0-3 сек): первая фраза на камеру. Парадокс/цифра/вопрос. Цель: остановить скролл.
- РАСКАДРОВКА: 4-6 сцен с таймингом. Каждая описывает: действие на камеру + текст в кадре (если есть).
- ФИНАЛ: CTA (сохрани/подпишись/коммент).

Верни JSON:
{
  "topic": "...",
  "hook": "первая фраза на камеру 0-3 сек, ≤80 символов",
  "scenes": [
    {"seconds": "0-3", "action": "что делать на камеру", "on_screen": "текст в кадре или null"},
    {"seconds": "3-8", "action": "...", "on_screen": "..."},
    ...
  ],
  "music_hint": "подсказка по trending audio (стиль, настроение, как найти)",
  "caption": "Подпись под Reels 150-300 символов, hook первой строкой",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "duration_sec": ${duration}
}

Только JSON.`;

  const res = await client.messages.create({
    model: LEX_MODEL,
    max_tokens: 1200,
    temperature: 0.7,
    system: LEX_SYSTEM,
    messages: [
      { role: "user", content: sanitizeForAnthropic(ctx + "\n" + task) },
    ],
  });

  const cost = await recordSpend({
    projectId,
    agentRole: "lex_reel",
    model: LEX_MODEL,
    usage: res.usage as any,
    tgId,
  });

  const raw = extractText(res);
  const parsed = safeJson<ReelScript>(raw);
  if (!parsed || !Array.isArray(parsed.scenes) || parsed.scenes.length < 2) {
    return { script: null, cost };
  }

  const scenes = parsed.scenes
    .slice(0, 8)
    .map((s) => ({
      seconds: String(s.seconds ?? "").slice(0, 20),
      action: String(s.action ?? "").slice(0, 300),
      on_screen: s.on_screen ? String(s.on_screen).slice(0, 200) : undefined,
    }))
    .filter((s) => s.action.length > 0);

  if (scenes.length < 2) return { script: null, cost };

  const script: ReelScript = {
    topic: String(parsed.topic || topic).slice(0, 120),
    hook: String(parsed.hook || "").slice(0, 200),
    scenes,
    music_hint: String(parsed.music_hint || "").slice(0, 300),
    caption: String(parsed.caption || "").slice(0, 500),
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags
          .slice(0, 7)
          .map((h) => String(h).replace(/^#?/, "#").slice(0, 40))
      : [],
    duration_sec: duration,
  };

  return { script, cost };
}

// ---------- Brand kit helpers ----------

export async function getBrandKitFromProject(projectId: string): Promise<BrandKit | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("projects")
    .select("title, channel_title, channel_username, lex_brand_kit")
    .eq("id", projectId)
    .maybeSingle();
  if (!data) return null;
  if (data.lex_brand_kit) return data.lex_brand_kit as BrandKit;
  // Fallback minimal kit from project fields
  return {
    channel_title: data.channel_title || data.title || data.channel_username || "канал",
    short_description: "",
    voice: "доверительный, личный, без воды",
    audience: "малый бизнес и предприниматели",
    goals: ["рост подписчиков", "вовлечение"],
  };
}
