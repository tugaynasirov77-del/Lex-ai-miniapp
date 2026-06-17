/**
 * Reel Decoder — разбор Instagram Reels по ссылке.
 * Pipeline:
 *   1. Извлечь shortcode из URL
 *   2. RapidAPI Instagram120 mediaByShortcode → metadata + video_url
 *   3. Скачать видео → отправить в OpenAI Whisper → транскрипт с таймкодами
 *   4. Claude Haiku анализирует структуру и возвращает JSON-разбор
 */

import Anthropic from "@anthropic-ai/sdk";
import type { BrandKit, LexInsights } from "./lexAI";

// ───────────── Types ─────────────

export type ReelMetadata = {
  shortcode: string;
  video_url: string;
  caption: string;
  author_username: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  duration_sec: number;
};

export type TranscriptSegment = {
  start: number; // seconds
  end: number;
  text: string;
};

export type ReelAnalysis = {
  hook: {
    text: string;                 // короткое описание что цепляет
    verbatim_quote?: string;      // ТОЧНЫЕ слова автора из транскрипта (с кавычками)
    type: string;                 // "цифра" | "парадокс" | "вопрос" | "история" | "провокация" | "другое"
    seconds: number;
  };
  // НОВЫЙ: раскадровка по сценам
  storyboard?: {
    scene: number;
    start: number;
    end: number;
    what_in_frame: string;        // что в кадре физически
    what_said: string;            // прямая цитата
    effect: string;               // какой эффект достигается
  }[];
  // СТАРОЕ поле — для обратной совместимости в архиве
  structure: { start: number; end: number; label: string; text: string }[];
  format: string;
  // НОВЫЙ: психологические триггеры (FOMO, провокация, парадокс ожиданий и т.д.)
  engagement_triggers?: string[];
  // НОВЫЙ: что забрать в свой контент (practical takeaways)
  takeaways?: string[];
  // НОВЫЙ: пошаговая инструкция «сними сам»
  shoot_yourself?: string[];
  why_works: string[];
  adapt_to_brand: string;
  cta: string;
};

export type ReelDecodeResult = {
  metadata: ReelMetadata;
  transcript: string;
  segments: TranscriptSegment[];
  analysis: ReelAnalysis;
  cost_usd: number;
};

// ───────────── Helpers ─────────────

/**
 * Из URL вида https://www.instagram.com/reel/ABC123/ или /p/ABC123/ → "ABC123".
 * Поддерживаем reel, reels, p, tv.
 */
export function extractShortcode(url: string): string | null {
  if (!url) return null;
  const m = url.match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}

async function fetchMetadata(shortcode: string): Promise<ReelMetadata> {
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST;
  if (!key || !host) throw new Error("RAPIDAPI_KEY/RAPIDAPI_HOST не настроены");

  // Endpoint: POST /api/instagram/mediaByShortcode { shortcode }
  const r = await fetch(`https://${host}/api/instagram/mediaByShortcode`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-key": key,
      "x-rapidapi-host": host,
    },
    body: JSON.stringify({ shortcode }),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`RapidAPI ${r.status}: ${txt.slice(0, 200)}`);
  }

  const data: any = await r.json();

  // Структура ответа instagram120 mediaByShortcode:
  // [ { urls: [{url, name, extension, quality}], meta: {...}, pictureUrl: "..." } ]
  // Для Reels в urls есть объект с extension="mp4". Для фото — только jpg.
  const items: any[] = Array.isArray(data) ? data : data?.items || [data];
  const item = items[0] || {};
  const meta = item.meta || {};
  const urls: any[] = Array.isArray(item.urls) ? item.urls : [];

  // Ищем mp4-видео в порядке убывания качества
  const videoEntry = urls
    .filter((u) => {
      const ext = String(u?.extension || "").toLowerCase();
      const name = String(u?.name || "").toLowerCase();
      return ext === "mp4" || name.includes("mp4") || name.includes("video");
    })
    .sort((a, b) => (Number(b?.quality) || 0) - (Number(a?.quality) || 0))[0];

  const videoUrl: string = videoEntry?.url || "";

  const caption: string = String(meta?.title || meta?.caption || "").trim();
  const username: string = String(meta?.username || "").trim();
  const likes = Number(meta?.likeCount) || 0;
  const comments = Number(meta?.commentCount) || 0;
  const views = Number(meta?.viewCount) || Number(meta?.playCount) || 0;
  const duration = Number(meta?.duration) || Number(videoEntry?.duration) || 0;

  if (!videoUrl) {
    // Если есть pictureUrl — это статика, не Reels
    if (item?.pictureUrl) {
      throw new Error("Это статичный пост, а не Reels. Кидай ссылку на видео.");
    }
    throw new Error("Не удалось получить видео. Проверь что Reels публичный и доступен без логина.");
  }

  return {
    shortcode,
    video_url: videoUrl,
    caption: String(caption || "").slice(0, 4000),
    author_username: String(username || ""),
    view_count: views,
    like_count: likes,
    comment_count: comments,
    duration_sec: duration,
  };
}

async function transcribeVideo(
  videoUrl: string,
): Promise<{ text: string; segments: TranscriptSegment[]; cost: number }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY не настроен");

  // Скачиваем видео в память (Reels обычно 5-15 МБ, лимит Whisper 25 МБ)
  const vr = await fetch(videoUrl);
  if (!vr.ok) throw new Error(`не удалось скачать видео (${vr.status})`);
  const buf = await vr.arrayBuffer();
  const bytes = buf.byteLength;
  if (bytes > 24 * 1024 * 1024) {
    throw new Error("видео >24 МБ, Whisper не примет");
  }

  const fd = new FormData();
  fd.append("file", new Blob([buf], { type: "video/mp4" }), "reel.mp4");
  fd.append("model", "whisper-1");
  fd.append("response_format", "verbose_json");
  fd.append("timestamp_granularities[]", "segment");

  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: fd,
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Whisper ${r.status}: ${t.slice(0, 200)}`);
  }
  const j: any = await r.json();
  const segments: TranscriptSegment[] = Array.isArray(j.segments)
    ? j.segments.map((s: any) => ({
        start: Number(s.start) || 0,
        end: Number(s.end) || 0,
        text: String(s.text || "").trim(),
      }))
    : [];
  const text = String(j.text || segments.map((s) => s.text).join(" ")).trim();

  // Стоимость: $0.006/мин × duration / 60
  const durationMin = (Number(j.duration) || 0) / 60;
  const cost = durationMin * 0.006;

  return { text, segments, cost };
}

const ANALYSIS_SYSTEM = `Ты — режиссёр-аналитик короткого вертикального контента.
Разбираешь чужие виральные Reels для автора, чтобы он МОГ ПОВТОРИТЬ — физически снять такой же.

ПРИНЦИПЫ:
1. Используй ТОЧНЫЕ слова из транскрипта (verbatim quote с кавычками), не пересказ.
2. Раскадровка по сценам — что в кадре, что говорится, какой эффект.
3. Не философствуй — давай конкретные практические takeaways.
4. Психологические триггеры называй прямо (провокация, FOMO, любопытство, парадокс ожиданий, эффект подглядывания, противоречие толпе).
5. Инструкция «сними сам» — пошагово, как чек-лист действий, не теория.
6. Сценарий под нишу автора — рабочий черновик, не «общие рекомендации».
7. ВАЖНО: в значениях JSON НЕ оборачивай текст в кавычки, апострофы или ёлочки.
   Кавычки только когда это синтаксис JSON. Внутри строк — обычный текст без обрамлений.
   Не используй markdown (*, **, _) — только plain text.

ОТВЕТ — строгий JSON одной строкой. Без префиксов, без markdown.`;

async function analyze(args: {
  client: Anthropic;
  metadata: ReelMetadata;
  transcript: string;
  segments: TranscriptSegment[];
  insights: LexInsights | null;
  brand: BrandKit | null;
}): Promise<{ analysis: ReelAnalysis; cost: number }> {
  const { client, metadata, transcript, segments, insights, brand } = args;

  const transcriptWithTimes = segments
    .slice(0, 50)
    .map((s) => `[${fmtTime(s.start)}–${fmtTime(s.end)}] ${s.text}`)
    .join("\n");

  const brandCtx = brand
    ? `\nКонтекст автора, для которого нужен адаптированный сценарий:\n- Ниша: ${(brand as any).niche || brand.short_description || ""}\n- Аудитория: ${brand.audience || ""}\n- Тон: ${brand.voice || ""}\n- О чём: ${brand.short_description || ""}\n${insights?.niche_summary ? `- Ниша подробно: ${insights.niche_summary}` : ""}\n`
    : "";

  const task = `Разбери Instagram Reels.

МЕТАДАННЫЕ:
- Автор: @${metadata.author_username || "?"}
- Просмотры: ${metadata.view_count.toLocaleString("ru-RU")}
- Лайки: ${metadata.like_count.toLocaleString("ru-RU")}
- Комментарии: ${metadata.comment_count.toLocaleString("ru-RU")}
- Длина: ${Math.round(metadata.duration_sec)} сек

ПОДПИСЬ:
"""
${metadata.caption.slice(0, 1500)}
"""

ТРАНСКРИПТ С ТАЙМКОДАМИ:
${transcriptWithTimes || "(нет речи)"}
${brandCtx}
ВЕРНИ JSON ровно по этой схеме:
{
  "hook": {
    "text": "1 фраза — что именно цепляет в первые 3 сек (содержание, не теория)",
    "verbatim_quote": "ТОЧНЫЕ слова автора в первые 3 сек — копируй из транскрипта 1-в-1",
    "type": "цифра|парадокс|вопрос|история|провокация|признание|другое",
    "seconds": 3
  },
  "storyboard": [
    {
      "scene": 1,
      "start": 0,
      "end": 3,
      "what_in_frame": "что физически в кадре (план, ракурс, движение)",
      "what_said": "точная цитата из транскрипта",
      "effect": "какой эффект на зрителя"
    }
    // 4-6 сцен покрывающих весь ролик
  ],
  "format": "talking-head|ugc-vlog|demo|skit|voiceover|split-screen|other",
  "engagement_triggers": [
    "2-4 психологических триггера: провокация, FOMO, любопытство, парадокс ожиданий, эффект подглядывания, противоречие толпе, признание уязвимости"
  ],
  "why_works": [
    "3-4 коротких пункта: что именно сделало ролик виральным (формат, темп, эмоция)"
  ],
  "takeaways": [
    "3-5 КОНКРЕТНЫХ practical-уроков для автора. Формат: глагол + действие. Например: 'Сделай первый кадр крупным планом лица', 'Дай парадокс в первой фразе', 'Используй один cut в первые 3 секунды'."
  ],
  "shoot_yourself": [
    "Пошаговая инструкция СНЯТЬ такой же ролик в нише автора. Каждый пункт — конкретное действие. Минимум 5 шагов.",
    "Пример: '1. Включи камеру на штатив на уровне глаз'",
    "'2. На 0:00 произнеси фразу X с интонацией Y'",
    "'3. На 0:03 переключись на крупный план рук'"
  ],
  "adapt_to_brand": "Готовый сценарий в нише автора — 150-250 слов. Должен включать: точную первую фразу, ход 4-5 сцен с таймкодами, финальный CTA. Не общие рекомендации, а текст который можно сразу взять и снять.",
  "cta": "точная фраза или действие в конце оригинального ролика",
  "structure": [
    {"start": 0, "end": 5, "label": "Хук", "text": "что происходит"},
    {"start": 5, "end": 15, "label": "Развитие", "text": "..."},
    {"start": 15, "end": 30, "label": "Кульминация", "text": "..."},
    {"start": 30, "end": 45, "label": "CTA", "text": "..."}
  ]
}

Только JSON одной строкой, без markdown.`;

  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 3500,
    temperature: 0.5,
    system: ANALYSIS_SYSTEM,
    messages: [{ role: "user", content: task }],
  });

  const raw = res.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  let parsed: ReelAnalysis;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Claude вернул невалидный JSON");
  }

  const usage = res.usage;
  const input = usage?.input_tokens || 0;
  const output = usage?.output_tokens || 0;
  // Haiku 4.5 pricing
  const cost = (input * 0.8) / 1_000_000 + (output * 4) / 1_000_000;

  return { analysis: parsed, cost };
}

function fmtTime(sec: number): string {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

// ───────────── Главная функция ─────────────

export async function decodeReel(args: {
  client: Anthropic;
  url: string;
  insights: LexInsights | null;
  brand: BrandKit | null;
}): Promise<ReelDecodeResult> {
  const shortcode = extractShortcode(args.url);
  if (!shortcode) throw new Error("Не удалось распознать Instagram-ссылку");

  const metadata = await fetchMetadata(shortcode);
  const { text: transcript, segments, cost: whisperCost } = await transcribeVideo(metadata.video_url);
  const { analysis, cost: claudeCost } = await analyze({
    client: args.client,
    metadata,
    transcript,
    segments,
    insights: args.insights,
    brand: args.brand,
  });

  const totalCost = 0.005 /* RapidAPI Basic est */ + whisperCost + claudeCost;
  return {
    metadata,
    transcript,
    segments,
    analysis,
    cost_usd: Number(totalCost.toFixed(4)),
  };
}
