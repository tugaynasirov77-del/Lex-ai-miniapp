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
    text: string;
    type: string;       // "цифра" | "парадокс" | "вопрос" | "история" | "провокация" | "другое"
    seconds: number;
  };
  structure: { start: number; end: number; label: string; text: string }[];
  format: string;       // "talking-head" | "ugc-vlog" | "demo" | "skit" | "voiceover" | "split-screen" | "other"
  why_works: string[];  // 3-5 пунктов
  adapt_to_brand: string; // 150-250 слов сценарий под brand_kit юзера
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

const ANALYSIS_SYSTEM = `Ты — эксперт по короткому вертикальному контенту (Instagram Reels, TikTok, YouTube Shorts).
Твоя задача — разбирать чужие виральные ролики и объяснять автору, ПОЧЕМУ это сработало и КАК повторить для его ниши.

ОТВЕТ — строгий JSON одной строкой по указанной схеме. Без префиксов, без markdown.`;

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

ПОДПИСЬ К РОЛИКУ:
"""
${metadata.caption.slice(0, 1500)}
"""

ТРАНСКРИПТ С ТАЙМКОДАМИ:
${transcriptWithTimes || "(нет речи)"}
${brandCtx}
ВЕРНИ JSON:
{
  "hook": {
    "text": "что именно цепляет в первые 3 секунды (текст, движение, монтажный приём)",
    "type": "цифра|парадокс|вопрос|история|провокация|другое",
    "seconds": 3
  },
  "structure": [
    {"start": 0, "end": 5, "label": "Хук", "text": "что происходит"},
    {"start": 5, "end": 15, "label": "Проблема", "text": "..."},
    {"start": 15, "end": 30, "label": "Решение", "text": "..."},
    {"start": 30, "end": 45, "label": "CTA", "text": "..."}
  ],
  "format": "talking-head|ugc-vlog|demo|skit|voiceover|split-screen|other",
  "why_works": [
    "3-5 коротких пунктов: что именно сделало ролик виральным"
  ],
  "adapt_to_brand": "150-250 слов готового сценария под нишу автора. Используй ту же формулу, но с примерами из его ниши. Раскадровка по таймкодам.",
  "cta": "точная фраза или действие в конце ролика"
}

Только JSON, одной строкой.`;

  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
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
