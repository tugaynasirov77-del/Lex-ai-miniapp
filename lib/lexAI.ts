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
// Vercel Hobby ceiling 10s — Sonnet 4.6 не успевает с 4k токенов.
// Используем Haiku везде, но даём ему расширенный prompt с структурой
// playbook. Качество ниже Sonnet, но укладываемся в timeout.
// На Vercel Pro (60s) можно вернуть Sonnet — поменять на claude-sonnet-4-6.
const LEX_MODEL_DEEP: AnthropicModel = "claude-haiku-4-5-20251001";

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

ФОРМАТИРОВАНИЕ ПОСТОВ (только для метода writePost):
- HOOK (первая строка) ОБЯЗАТЕЛЬНО оборачивай в <b>...</b>
- Главную мысль / инсайт / цитату оборачивай в <blockquote>...</blockquote>
  ровно ОДИН раз за пост
- Можно использовать <i>...</i> для одного-двух акцентов (редко, по делу)
- Никаких других тегов: <p>, <br>, <h1>, <ul>, <li>, <span>, <div>,
  <strong>, <em>, <code> — ЗАПРЕЩЕНЫ
- Символы & < > вне тегов заменяй на &amp; &lt; &gt;

ОТВЕТ ВСЕГДА — строгий JSON одной строкой по указанной схеме.
Без префиксов, без markdown-кодблоков, без комментариев.`;

// ---------- Helpers ----------

function safeJson<T>(s: string): T | null {
  let cleaned = s.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Попытка восстановить обрезанный JSON: добавляем закрывающие
    // скобки и убираем повисшую запятую/незакрытую строку. Haiku
    // часто обрывается на максимуме токенов — этот recovery спасает
    // частично заполненные блоки (10 hooks вместо 0 при обрыве на 11-м).
    const repaired = repairTruncatedJson(cleaned);
    if (repaired) {
      try {
        return JSON.parse(repaired) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function repairTruncatedJson(s: string): string | null {
  // Если есть незавершённая строка — закрываем её
  let str = s;
  const quotesBalanced = (str.match(/"/g) || []).length % 2 === 0;
  if (!quotesBalanced) {
    str = str + '"';
  }
  // Убираем повисшую запятую в конце массива/объекта
  str = str.replace(/,\s*$/, "");
  // Считаем баланс скобок и закрываем
  let openCurly = 0;
  let openSquare = 0;
  for (const ch of str) {
    if (ch === "{") openCurly++;
    else if (ch === "}") openCurly--;
    else if (ch === "[") openSquare++;
    else if (ch === "]") openSquare--;
  }
  while (openSquare > 0) {
    str = str.replace(/,\s*$/, "") + "]";
    openSquare--;
  }
  while (openCurly > 0) {
    str = str.replace(/,\s*$/, "") + "}";
    openCurly--;
  }
  return str;
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
  niche_summary: string;            // 1-2 предложения о нише
  audience_pains: string[];         // 3-5 болей аудитории
  working_hooks: string[];          // 5-7 hook-паттернов или ГОТОВЫХ первых строк
  content_themes: string[];         // 5-8 тем
  tone_notes: string;               // тон конкурентов
  pitfalls: string[];               // 3-5 чего избегать
  // Расширения для глубокого playbook (IG): опциональны, заполняются Sonnet'ом
  ready_hooks?: string[];           // 15-20 готовых первых строк
  carousel_themes?: { title: string; structure: string }[]; // 5-10 тем с структурой
  reel_formats?: { format: string; example: string }[];     // 3-5 готовых reels-форматов
  posting_schedule?: string;        // когда что постить
  hashtag_strategy?: string[];      // 7-10 рабочих хэштегов
  updated_at: string;               // ISO
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
  hook: string;
  image_prompt: string;             // общий промпт стиля (для master-консистенции)
  slides: { num: number; text: string; image_prompt?: string }[]; // per-slide promt
  caption: string;
  hashtags: string[];
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
// Базовый анализ (быстро). Для IG доп. вызов playbook идёт параллельно.
async function analyzeBasic(args: {
  client: Anthropic;
  projectId: string;
  tgId: number;
  contextText: string;
}): Promise<{ partial: Partial<LexInsights>; cost: number }> {
  const { client, projectId, tgId, contextText } = args;
  const task = `ЗАДАЧА: краткий анализ ниши и конкурентов.

Верни JSON:
{
  "niche_summary": "2-3 предложения: что за ниша, кто аудитория",
  "audience_pains": ["боль 1", ... 4-5 штук],
  "working_hooks": ["паттерн hook 1", ... 5-7],
  "content_themes": ["тема 1", ... 6-8],
  "tone_notes": "1-2 предложения о тоне",
  "pitfalls": ["чего избегать 1", ... 3-5]
}
Только JSON.`;
  const res = await client.messages.create({
    model: LEX_MODEL,
    max_tokens: 900,
    temperature: 0.5,
    system: LEX_SYSTEM + "\n\n" + task,
    messages: [{ role: "user", content: sanitizeForAnthropic(contextText) }],
  });
  const cost = await recordSpend({
    projectId,
    agentRole: "lex_analyze",
    model: LEX_MODEL,
    usage: res.usage as any,
    tgId,
  });
  const raw = extractText(res);
  const parsed = safeJson<any>(raw) || {};
  return { partial: parsed, cost };
}

// Playbook split на 2 подвызова — иначе Haiku обрезает по max_tokens
// и весь JSON ломается.

async function analyzeHooks(args: {
  client: Anthropic;
  projectId: string;
  tgId: number;
  contextText: string;
}): Promise<{ partial: Partial<LexInsights>; cost: number }> {
  const { client, projectId, tgId, contextText } = args;
  const task = `ЗАДАЧА: придумай 10 готовых первых строк (hooks) для IG-постов в нише.

Это РЕАЛЬНЫЕ цепляющие фразы, готовые к копированию (не паттерны, не шаблоны).
Каждая ≤80 символов. Должна работать как первая строка поста.

Верни JSON:
{
  "ready_hooks": ["фраза 1", "фраза 2", ... ровно 10 штук]
}
Только JSON.`;
  const res = await client.messages.create({
    model: LEX_MODEL,
    max_tokens: 900,
    temperature: 0.8,
    system: LEX_SYSTEM + "\n\n" + task,
    messages: [{ role: "user", content: sanitizeForAnthropic(contextText) }],
  });
  const cost = await recordSpend({
    projectId,
    agentRole: "lex_hooks",
    model: LEX_MODEL,
    usage: res.usage as any,
    tgId,
  });
  const raw = extractText(res);
  const parsed = safeJson<any>(raw) || {};
  return { partial: parsed, cost };
}

async function analyzeCarousels(args: {
  client: Anthropic;
  projectId: string;
  tgId: number;
  contextText: string;
}): Promise<{ partial: Partial<LexInsights>; cost: number }> {
  const { client, projectId, tgId, contextText } = args;
  const task = `ЗАДАЧА: для Instagram-проекта собери 5 идей каруселей со структурой слайдов.

Верни JSON:
{
  "carousel_themes": [
    {"title": "название", "structure": "1: X / 2: Y / 3: Z / CTA"},
    ... ровно 5 штук
  ]
}
Только JSON. Каждый structure 80-150 символов.`;
  const res = await client.messages.create({
    model: LEX_MODEL,
    max_tokens: 1200,
    temperature: 0.7,
    system: LEX_SYSTEM + "\n\n" + task,
    messages: [{ role: "user", content: sanitizeForAnthropic(contextText) }],
  });
  const cost = await recordSpend({
    projectId,
    agentRole: "lex_carousels",
    model: LEX_MODEL,
    usage: res.usage as any,
    tgId,
  });
  const raw = extractText(res);
  const parsed = safeJson<any>(raw) || {};
  return { partial: parsed, cost };
}

async function analyzeReelsAndMeta(args: {
  client: Anthropic;
  projectId: string;
  tgId: number;
  contextText: string;
}): Promise<{ partial: Partial<LexInsights>; cost: number }> {
  const { client, projectId, tgId, contextText } = args;
  const task = `ЗАДАЧА: для Instagram-проекта собери Reels-форматы, расписание и хэштеги.

Верни JSON:
{
  "reel_formats": [
    {"format": "название", "example": "как снять, 1 предложение"},
    ... ровно 4 штуки
  ],
  "posting_schedule": "1-2 предложения: какие форматы когда (пн-вс)",
  "hashtag_strategy": ["#tag1", "#tag2", ... ровно 8 хэштегов]
}
Только JSON.`;
  const res = await client.messages.create({
    model: LEX_MODEL,
    max_tokens: 900,
    temperature: 0.7,
    system: LEX_SYSTEM + "\n\n" + task,
    messages: [{ role: "user", content: sanitizeForAnthropic(contextText) }],
  });
  const cost = await recordSpend({
    projectId,
    agentRole: "lex_reels_meta",
    model: LEX_MODEL,
    usage: res.usage as any,
    tgId,
  });
  const raw = extractText(res);
  const parsed = safeJson<any>(raw) || {};
  return { partial: parsed, cost };
}

export async function analyzeCompetitors(args: {
  client: Anthropic;
  projectId: string;
  tgId: number;
  channelTitle: string;
  niche?: string;
  competitors: CompetitorInput[];
  platform?: "telegram" | "instagram";
}): Promise<{ insights: LexInsights | null; cost: number }> {
  const { client, projectId, tgId, channelTitle, niche, competitors, platform } = args;
  const isIg = platform === "instagram";

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
  const contextText = lines.join("\n");

  // IG: 2 параллельных вызова Haiku (basic + playbook). Каждый ≤1.5k tokens,
  // в параллели влезаем в 10s ceiling. Мерджим результаты.
  // TG: один базовый вызов (для playbook надо реальные посты конкурентов,
  // а они уже есть с t.me/s/ — но достаточно базового анализа).
  let parsed: any = null;
  let cost = 0;

  if (isIg) {
    const [basic, hooks, carousels, reelsMeta] = await Promise.all([
      analyzeBasic({ client, projectId, tgId, contextText }),
      analyzeHooks({ client, projectId, tgId, contextText }),
      analyzeCarousels({ client, projectId, tgId, contextText }),
      analyzeReelsAndMeta({ client, projectId, tgId, contextText }),
    ]);
    parsed = { ...basic.partial, ...hooks.partial, ...carousels.partial, ...reelsMeta.partial };
    cost = basic.cost + hooks.cost + carousels.cost + reelsMeta.cost;
  } else {
    const basic = await analyzeBasic({ client, projectId, tgId, contextText });
    parsed = basic.partial;
    cost = basic.cost;
  }

  if (!parsed || !parsed.niche_summary) {
    return { insights: null, cost };
  }
  // Заглушка чтобы прежний код ниже не сломался
  void LEX_MODEL_DEEP;

  const p: any = parsed;
  const insights: LexInsights = {
    niche_summary: String(p.niche_summary).slice(0, 500),
    audience_pains: Array.isArray(p.audience_pains)
      ? p.audience_pains.slice(0, 5).map((s: any) => String(s).slice(0, 200))
      : [],
    working_hooks: Array.isArray(p.working_hooks)
      ? p.working_hooks.slice(0, 7).map((s: any) => String(s).slice(0, 200))
      : [],
    content_themes: Array.isArray(p.content_themes)
      ? p.content_themes.slice(0, 8).map((s: any) => String(s).slice(0, 200))
      : [],
    tone_notes: String(p.tone_notes || "").slice(0, 500),
    pitfalls: Array.isArray(p.pitfalls)
      ? p.pitfalls.slice(0, 5).map((s: any) => String(s).slice(0, 200))
      : [],
    // playbook-поля (IG)
    ready_hooks: Array.isArray(p.ready_hooks)
      ? p.ready_hooks.slice(0, 20).map((s: any) => String(s).slice(0, 200))
      : undefined,
    carousel_themes: Array.isArray(p.carousel_themes)
      ? p.carousel_themes.slice(0, 10).map((c: any) => ({
          title: String(c?.title || "").slice(0, 120),
          structure: String(c?.structure || "").slice(0, 500),
        })).filter((c: any) => c.title)
      : undefined,
    reel_formats: Array.isArray(p.reel_formats)
      ? p.reel_formats.slice(0, 6).map((r: any) => ({
          format: String(r?.format || "").slice(0, 120),
          example: String(r?.example || "").slice(0, 400),
        })).filter((r: any) => r.format)
      : undefined,
    posting_schedule: p.posting_schedule ? String(p.posting_schedule).slice(0, 600) : undefined,
    hashtag_strategy: Array.isArray(p.hashtag_strategy)
      ? p.hashtag_strategy.slice(0, 12).map((h: any) => String(h).replace(/^#?/, "#").slice(0, 40))
      : undefined,
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

Длина body: СТРОГО 300-450 символов (с тегами не считается).
Структура: <b>hook</b> → суть (1-3 факта) → <blockquote>инсайт</blockquote> → CTA.

Каждый из 3 вариантов — РАЗНЫЙ hook (выбери из формул в системе):
- Вариант 1: hook с цифрой
- Вариант 2: hook с парадоксом/историей
- Вариант 3: hook с провокацией/против толпы

ОБЯЗАТЕЛЬНО:
- Первая строка в <b>...</b> — это заголовок
- Главную мысль (1-3 коротких строки) — в <blockquote>...</blockquote>
  ровно один раз
- Других HTML-тегов нет. Без markdown.
- Эмодзи 0-2 на пост, по делу.

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

МАСТЕР-СТИЛЬ (используй основой для всех слайдов): ${styleHint}

Верни JSON:
{
  "topic": "...",
  "hook": "текст hook-слайда (= slides[0].text)",
  "image_prompt": "Общий стиль карусели одной строкой — English Midjourney промпт со стилем выше + цветовой палитрой + типографикой. Единый для всех слайдов.",
  "slides": [
    {
      "num": 1,
      "text": "текст слайда 1",
      "image_prompt": "Сцена для этого слайда (English, ≤200 симв): что в кадре, композиция, акцентный объект — со ссылкой на мастер-стиль через '+ master style above'. Юзер скопирует и сгенерит в Midjourney."
    },
    {"num": 2, "text": "...", "image_prompt": "..."},
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
    .map((s: any, i: number) => ({
      num: i + 1,
      text: String(s.text ?? "").trim().slice(0, 100),
      image_prompt: s.image_prompt ? String(s.image_prompt).slice(0, 400) : undefined,
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

// ---------- Method 5: writeWeekPlan ----------

export type PlanIdea = {
  day: string;                              // "пн" | "вт" | "ср" | "чт" | "пт" | "сб" | "вс"
  format: "post" | "carousel" | "reel";
  topic: string;
  hook: string;
};

export type WeekPlan = {
  ideas: PlanIdea[];      // ровно 7 — по идее в день
  generated_at: string;
};

/**
 * Генерит план контента на 7 дней (пн-вс). Один Anthropic-вызов.
 * Тарифные ограничения накладывает UI: для Free показываются все 7,
 * но действия (создать на основе идеи) доступны только на первых N.
 */
export async function writeWeekPlan(args: {
  client: Anthropic;
  projectId: string;
  tgId: number;
  insights: LexInsights | null;
  brand: BrandKit | null;
}): Promise<{ plan: WeekPlan | null; cost: number }> {
  const { client, projectId, tgId, insights, brand } = args;
  const ctx = buildContextBlock(insights, brand);

  const task = `ЗАДАЧА: придумай план контента на 7 дней (пн → вс).

Выдай 7 идей — по одной на день недели.
Для каждой идеи: формат (post / carousel / reel), тема и hook.
Чередуй форматы: ~3 поста, ~2 карусели, ~2 reels на неделе.
Темы должны быть РАЗНЫМИ и опираться на боли аудитории + рабочие hooks из контекста.

Верни JSON:
{
  "ideas": [
    {"day": "пн", "format": "post", "topic": "...", "hook": "первая фраза, ≤80 симв"},
    {"day": "вт", "format": "carousel", "topic": "...", "hook": "..."},
    {"day": "ср", "format": "reel", "topic": "...", "hook": "..."},
    {"day": "чт", "format": "post", "topic": "...", "hook": "..."},
    {"day": "пт", "format": "post", "topic": "...", "hook": "..."},
    {"day": "сб", "format": "carousel", "topic": "...", "hook": "..."},
    {"day": "вс", "format": "reel", "topic": "...", "hook": "..."}
  ]
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
    agentRole: "lex_plan",
    model: LEX_MODEL,
    usage: res.usage as any,
    tgId,
  });

  const raw = extractText(res);
  const parsed = safeJson<{ ideas: PlanIdea[] }>(raw);
  if (!parsed || !Array.isArray(parsed.ideas) || parsed.ideas.length < 5) {
    return { plan: null, cost };
  }

  const VALID_FORMATS: PlanIdea["format"][] = ["post", "carousel", "reel"];
  const ideas: PlanIdea[] = parsed.ideas
    .slice(0, 7)
    .map((i) => ({
      day: String(i.day || "").slice(0, 10),
      format: VALID_FORMATS.includes(i.format) ? i.format : "post",
      topic: String(i.topic || "").slice(0, 200),
      hook: String(i.hook || "").slice(0, 200),
    }))
    .filter((i) => i.topic.length > 0);

  if (ideas.length < 5) return { plan: null, cost };

  const plan: WeekPlan = {
    ideas,
    generated_at: new Date().toISOString(),
  };

  // Кешируем план на проекте — для retrieve без AI-вызова
  const sb = getSupabase();
  await sb.from("projects").update({ lex_week_plan: plan }).eq("id", projectId);

  return { plan, cost };
}

export async function getWeekPlanFromCache(projectId: string): Promise<WeekPlan | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("projects")
    .select("lex_week_plan")
    .eq("id", projectId)
    .maybeSingle();
  return (data?.lex_week_plan as WeekPlan) || null;
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
