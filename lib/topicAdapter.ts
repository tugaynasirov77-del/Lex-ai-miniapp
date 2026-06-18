import Anthropic from "@anthropic-ai/sdk";
import type { BrandKit } from "./lexAI";
import type { ReelAnalysisDTO } from "./api";

const MODEL = "claude-haiku-4-5-20251001";

export type AdaptedTopic = {
  title: string;
  hook: string;
  rationale: string;
  format: string;
  duration_sec: number;
};

export type ProjectContext = {
  niche?: string | null;
  audience?: string | null;
  content_goal?: string | null;
  content_style?: string | null;
  on_camera?: string | null;
  what_sells?: string | null;
  language?: string | null;
};

function buildPrompt(analysis: ReelAnalysisDTO, brand: BrandKit | null, ctx: ProjectContext): string {
  // Brand-блок: используем оба источника (project columns + lex_brand_kit jsonb)
  const niche = ctx.niche || brand?.short_description || "не задано";
  const audience = ctx.audience || brand?.audience || "не задано";
  const style = ctx.content_style || brand?.voice || "не задано";
  const goal = ctx.content_goal || (brand?.goals || []).join(", ") || "не задано";
  const onCamera =
    ctx.on_camera === "yes"
      ? "да, может говорить в камеру"
      : ctx.on_camera === "sometimes"
      ? "иногда, не каждый ролик с лицом"
      : ctx.on_camera === "no"
      ? "нет, не снимается на камеру (нужно voice-over или без лица)"
      : "не указано";
  const sells = ctx.what_sells ? `Продаёт/продвигает: ${ctx.what_sells}` : "";

  // Исходный Reels — компактно
  const sourceHook = analysis.hook?.verbatim_quote || analysis.hook?.text || "";
  const mechanic = analysis.hook?.type || "";
  const whyWorks = (analysis.why_works || []).slice(0, 3).join("; ");
  const structure = (analysis.structure || [])
    .map((s) => `${s.label}: ${s.text}`)
    .join("; ");

  return `Ты — креативный директор для Instagram-блогеров. Помогаешь автору превратить чужой вирусный Reels в идею для собственного Reels.

Проект автора:
- Ниша: ${niche}
- Аудитория: ${audience}
- Стиль подачи: ${style}
- Главная цель: ${goal}
- Формат съёмки: ${onCamera}
${sells ? "- " + sells : ""}

Исходный Reels (чужой):
- Хук: "${sourceHook}"
- Тип хука / механика: ${mechanic}
- Структура: ${structure}
- Почему сработал: ${whyWorks}

ЗАДАЧА:
Предложи 3 РАЗНЫХ идеи для собственного Reels автора. Каждая идея использует ТУ ЖЕ механику что и исходный Reels, но переложена на нишу/тему автора.

Не повторяй идеи, не делай их банальными. Каждая идея должна звучать так, что автору сразу хочется её снять.

Правила:
- title — короткое название идеи, как она бы выглядела в архиве (5-10 слов)
- hook — конкретная фраза в первой строке Reels, которую автор скажет/покажет (8-20 слов, цепляет с первой секунды)
- rationale — 1 предложение почему именно эта тема зайдёт его аудитории (без воды, конкретно)
- format — какой формат съёмки: "разговор в камеру" / "voice-over + b-roll" / "текст на экране" / "POV" / "до-после" и т.п.
- duration_sec — рекомендованная длительность (15 / 30 / 45 / 60)

Учитывай on_camera: если автор не снимается лицом, не предлагай форматы где он должен говорить в камеру.

Верни СТРОГО JSON без markdown:
{
  "topics": [
    { "title": "...", "hook": "...", "rationale": "...", "format": "...", "duration_sec": 30 },
    { "title": "...", "hook": "...", "rationale": "...", "format": "...", "duration_sec": 30 },
    { "title": "...", "hook": "...", "rationale": "...", "format": "...", "duration_sec": 30 }
  ]
}`;
}

export async function adaptTopics(args: {
  analysis: ReelAnalysisDTO;
  brand: BrandKit | null;
  projectCtx: ProjectContext;
}): Promise<AdaptedTopic[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildPrompt(args.analysis, args.brand, args.projectCtx);

  const r = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = r.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI вернул некорректный ответ");

  const parsed = JSON.parse(m[0]) as { topics: AdaptedTopic[] };
  const topics = (parsed.topics || []).slice(0, 3).map((t) => ({
    title: String(t.title || "").trim(),
    hook: String(t.hook || "").trim(),
    rationale: String(t.rationale || "").trim(),
    format: String(t.format || "").trim(),
    duration_sec: Math.max(10, Math.min(90, Number(t.duration_sec) || 30)),
  }));

  if (topics.length < 1) throw new Error("AI не вернул ни одной темы");
  return topics;
}

/**
 * Улучшает пользовательскую идею: берёт её формулировку + механику исходного Reels
 * + контекст проекта, возвращает усиленную версию.
 */
export async function refineUserIdea(args: {
  userIdea: string;
  analysis: ReelAnalysisDTO;
  brand: BrandKit | null;
  projectCtx: ProjectContext;
}): Promise<AdaptedTopic> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const niche = args.projectCtx.niche || args.brand?.short_description || "не задано";
  const audience = args.projectCtx.audience || args.brand?.audience || "не задано";
  const style = args.projectCtx.content_style || args.brand?.voice || "не задано";
  const sourceHook = args.analysis.hook?.verbatim_quote || args.analysis.hook?.text || "";
  const mechanic = args.analysis.hook?.type || "";

  const prompt = `Ты — креативный директор для Instagram. Автор предложил свою идею для Reels — улучши её, опираясь на механику референсного ролика и контекст проекта.

Проект:
- Ниша: ${niche}
- Аудитория: ${audience}
- Стиль: ${style}

Референсный Reels (механика, которую нужно использовать):
- Хук: "${sourceHook}"
- Механика: ${mechanic}

Идея автора:
"""
${args.userIdea}
"""

ЗАДАЧА:
Усиль идею автора — добавь конкретики, сделай хук цепляющим, привяжи к механике референса. Не меняй суть идеи автора, только усиль её. Если идея слишком общая — конкретизируй.

Верни СТРОГО JSON без markdown:
{
  "title": "...",
  "hook": "...",
  "rationale": "...",
  "format": "...",
  "duration_sec": 30
}`;

  const r = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = r.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI вернул некорректный ответ");

  const t = JSON.parse(m[0]) as AdaptedTopic;
  return {
    title: String(t.title || "").trim(),
    hook: String(t.hook || "").trim(),
    rationale: String(t.rationale || "").trim(),
    format: String(t.format || "").trim(),
    duration_sec: Math.max(10, Math.min(90, Number(t.duration_sec) || 30)),
  };
}
