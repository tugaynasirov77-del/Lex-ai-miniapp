import Anthropic from "@anthropic-ai/sdk";
import type { BrandKit } from "./lexAI";
import type { AdaptedTopicDTO, ReelAnalysisDTO, ReelScenarioData } from "./api";

const MODEL = "claude-haiku-4-5-20251001";

export type ScriptProjectContext = {
  niche?: string | null;
  audience?: string | null;
  content_goal?: string | null;
  content_style?: string | null;
  on_camera?: string | null;
  what_sells?: string | null;
  content_language?: string | null;
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
  return v === "en" ? "английский" : v === "other" ? "другой (уточни у автора по нише)" : "русский";
}

function buildPrompt(
  topic: AdaptedTopicDTO,
  analysis: ReelAnalysisDTO | null,
  brand: BrandKit | null,
  ctx: ScriptProjectContext,
): string {
  const niche = ctx.niche || brand?.short_description || "не задано";
  const audience = ctx.audience || brand?.audience || "не задано";
  const style = ctx.content_style || brand?.voice || "не задано";
  const goal = ctx.content_goal || (brand?.goals || []).join(", ") || "не задано";
  const sells = ctx.what_sells ? `Продаёт/продвигает: ${ctx.what_sells}` : "";

  const sourceBlock = analysis
    ? `Механика исходного (референсного) Reels — используй её как каркас:
- Хук референса: "${analysis.hook?.verbatim_quote || analysis.hook?.text || ""}"
- Тип хука: ${analysis.hook?.type || ""}
- Почему сработал: ${(analysis.why_works || []).slice(0, 3).join("; ")}
- Структура: ${(analysis.structure || []).map((s) => `${s.label}: ${s.text}`).join("; ")}`
    : "Референсного разбора нет — опирайся на тему и контекст проекта.";

  return `Ты — сценарист коротких вертикальных видео (Instagram Reels) для блогеров. Твоя задача — написать полный, готовый к съёмке сценарий одного Reels.

Проект автора:
- Ниша: ${niche}
- Аудитория: ${audience}
- Стиль подачи: ${style}
- Главная цель контента: ${goal}
- Формат съёмки: ${onCameraLabel(ctx.on_camera)}
- Язык контента: ${languageLabel(ctx.content_language)}
${sells ? "- " + sells : ""}

Выбранная тема для Reels:
- Название: ${topic.title}
- Хук-идея: "${topic.hook}"
- Почему зайдёт: ${topic.rationale}
- Формат: ${topic.format}
- Длительность: ~${topic.duration_sec} сек

${sourceBlock}

ЗАДАЧА:
Напиши законченный сценарий на ${topic.duration_sec} секунд. Весь текст (хук, озвучка, подпись, вставки, CTA) — на языке: ${languageLabel(ctx.content_language)}.
Учитывай формат съёмки: если автор не снимается лицом — не пиши "скажи в камеру", используй voice-over и b-roll.
Сделай хук цепляющим с первой секунды. Озвучка должна звучать живо, под стиль "${style}", без воды и канцелярита.

Верни СТРОГО валидный JSON без markdown, без пояснений, ровно в этой структуре:
{
  "title": "короткое название ролика для архива",
  "goal": "одна фраза — какую задачу решает ролик",
  "hook": "первые 1-3 секунды: точная фраза/действие, которое цепляет",
  "on_screen_text": "крупный текст на экране в первые секунды",
  "voice_over": "полный текст озвучки от начала до конца, абзацами",
  "storyboard": [
    { "scene": 1, "seconds": "0-3", "action": "что происходит в кадре", "on_screen": "текст на экране в этой сцене" }
  ],
  "duration_sec": ${topic.duration_sec},
  "in_frame": "что в кадре в целом (объект, человек, продукт)",
  "angle": "ракурс съёмки",
  "background": "фон/локация",
  "light": "свет",
  "editing_hints": "подсказки по монтажу (склейки, темп, эффекты)",
  "text_overlays": ["короткие текстовые вставки по ходу ролика"],
  "music_hint": "подсказка по музыке/звуку/тренду",
  "cta": "финальный призыв к действию",
  "caption": "подпись к публикации (2-4 строки, живо, с эмодзи в меру)",
  "hashtags": ["#хэштег1", "#хэштег2"],
  "risks": ["что может пойти не так при съёмке/публикации"],
  "alt_hooks": ["альтернативный хук 1", "альтернативный хук 2"],
  "alt_cta": "альтернативный вариант CTA"
}

Требования к содержимому:
- storyboard: 3-6 сцен, покрывающих всю длительность, поля seconds в формате "0-3".
- text_overlays: 3-6 коротких вставок.
- hashtags: 8-15 релевантных нише хэштегов.
- risks: 2-4 пункта.
- alt_hooks: ровно 2 варианта.
- Все строки заполнены, без пустых полей и без плейсхолдеров.`;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => asString(x)).filter(Boolean) : [];
}

/** Генерирует полный сценарий Reels (20 полей ReelScenarioData). */
export async function generateScript(args: {
  topic: AdaptedTopicDTO;
  sourceDecode?: ReelAnalysisDTO | null;
  brand?: BrandKit | null;
  projectCtx: ScriptProjectContext;
}): Promise<ReelScenarioData> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildPrompt(
    args.topic,
    args.sourceDecode ?? null,
    args.brand ?? null,
    args.projectCtx,
  );

  const r = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = r.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI вернул некорректный ответ");

  const p = JSON.parse(m[0]) as Record<string, unknown>;

  const storyboard = Array.isArray(p.storyboard)
    ? (p.storyboard as Record<string, unknown>[]).map((s, i) => ({
        scene: Number(s.scene) || i + 1,
        seconds: asString(s.seconds) || `${i * 3}-${i * 3 + 3}`,
        action: asString(s.action),
        on_screen: asString(s.on_screen) || undefined,
      }))
    : [];

  const altHooks = asStringArray(p.alt_hooks).slice(0, 2);

  const scenario: ReelScenarioData = {
    title: asString(p.title) || args.topic.title,
    goal: asString(p.goal),
    hook: asString(p.hook) || args.topic.hook,
    on_screen_text: asString(p.on_screen_text),
    voice_over: asString(p.voice_over),
    storyboard,
    duration_sec: Math.max(10, Math.min(90, Number(p.duration_sec) || args.topic.duration_sec || 30)),
    in_frame: asString(p.in_frame),
    angle: asString(p.angle),
    background: asString(p.background),
    light: asString(p.light),
    editing_hints: asString(p.editing_hints),
    text_overlays: asStringArray(p.text_overlays),
    music_hint: asString(p.music_hint),
    cta: asString(p.cta),
    caption: asString(p.caption),
    hashtags: asStringArray(p.hashtags),
    risks: asStringArray(p.risks),
    alt_hooks: altHooks,
    alt_cta: asString(p.alt_cta),
  };

  if (!scenario.voice_over && !scenario.hook) {
    throw new Error("AI не вернул сценарий. Попробуй ещё раз.");
  }
  return scenario;
}

export type RefineAction =
  | "shorter"
  | "sharper"
  | "calmer"
  | "expert"
  | "simpler"
  | "alternative";

const ACTION_INSTRUCTION: Record<RefineAction, string> = {
  shorter: "Сделай заметно короче и плотнее, убери воду. Сохрани смысл.",
  sharper: "Сделай дерзче, смелее, цепляюще. Добавь энергии, но без грубости.",
  calmer: "Сделай спокойнее, мягче, увереннее — без давления и кликбейта.",
  expert: "Сделай экспертнее: больше конкретики, фактов, профессионального тона.",
  simpler: "Упрости формулировки, говори простым человеческим языком.",
  alternative: "Дай другой вариант с тем же смыслом, но иначе сформулированный.",
};

/** Переписывает один блок сценария под выбранное действие. Возвращает текст. */
export async function refineScriptBlock(args: {
  blockName: string;
  currentText: string;
  action: RefineAction;
  projectCtx?: ScriptProjectContext;
}): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const ctx = args.projectCtx;
  const ctxBlock = ctx
    ? `Контекст проекта: ниша «${ctx.niche || "—"}», аудитория «${ctx.audience || "—"}», стиль «${ctx.content_style || "—"}», язык ${languageLabel(ctx.content_language)}.`
    : "";

  const prompt = `Ты — редактор сценариев Reels. Перепиши фрагмент сценария (блок «${args.blockName}»).
${ctxBlock}

Действие: ${ACTION_INSTRUCTION[args.action]}

Исходный текст:
"""
${args.currentText}
"""

Верни ТОЛЬКО переписанный текст блока — без кавычек, без пояснений, без markdown. Сохрани язык оригинала.`;

  const r = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const text = r.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (!text) throw new Error("AI вернул пустой ответ");
  return text;
}
