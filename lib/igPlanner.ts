import Anthropic from "@anthropic-ai/sdk";
import { buildAgentSystem } from "./agents";
import { sanitizeForAnthropic } from "./sanitize";
import { recordSpend } from "./projectBudget";
import type { IgAnalysisResult } from "./igAnalyst";

export const IG_PLANNER_MODEL = "claude-sonnet-4-6";
export const IG_PLANNER_PROMPT_VERSION = "v1";

export type IgPlanItem = {
  day: string;          // ISO date YYYY-MM-DD
  format: "reel" | "carousel" | "post";
  topic: string;
  goal: string;         // зачем этот пост (трафик / охват / прогрев / сохранения)
  hook: string;
  cta: string;
  required_assets: string[]; // что нужно: "сырое видео 60 сек", "3 фото товара" и т.п.
  priority: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  reason: string;       // зачем мы это рекомендуем (1 предложение)
};

export type IgWeeklyPlan = {
  week_start: string;   // YYYY-MM-DD (понедельник)
  summary: string;
  items: IgPlanItem[];  // ровно 7
};

const PLANNER_TASK = `ЗАДАЧА: собрать недельный (7 дней) Instagram-план для аккаунта.

Вход — JSON: {"niche":"...","week_start":"YYYY-MM-DD","analysis":{...},"prior_topics":[...]}.
"analysis" — отчёт по конкурентам с темами, hooks, gaps, opportunities.
"prior_topics" — темы за прошлые 2 недели (избегай повтора).

Что делаешь:
Собираешь 7 единиц контента, по одной на каждый день начиная с week_start.
Стандартный микс: 2 reels + 2 carousel + 3 post. Можно отклоняться от микса если оправдано отчётом, но обычно держись его.

Для каждой единицы:
• day — дата ISO YYYY-MM-DD
• format — "reel" | "carousel" | "post"
• topic — конкретная тема (≤120 символов, не общее, а очень конкретное)
• goal — одна из: "reach" (охват) | "saves" (сохранения) | "shares" (репосты) | "warm" (прогрев) | "leads" (заявки)
• hook — конкретный текст hook (≤80 символов)
• cta — конкретный CTA (≤60 символов)
• required_assets — массив 1–3 пунктов: что клиенту нужно подготовить ("сырое видео ≤60 сек где говоришь про X", "5 скриншотов отзывов", "1 фото товара")
• priority — "high" | "medium" | "low"
• effort — "low" | "medium" | "high"
• reason — 1 предложение почему именно это (опирайся на opportunities/gaps из analysis)

Принципы:
- Разнообразие: каждый день — другой угол, другой формат, другой goal. Не делай 3 reel подряд про одно
- Не повторяй prior_topics
- Hook первого дня — самый сильный
- CTA-разнообразие: не везде "сохрани пост"
- Reels чередуй с другими форматами (не два дня подряд)
- summary — 2–3 предложения общего смысла недели

Формат — строгий JSON одной строкой:
{"week_start":"YYYY-MM-DD","summary":"...","items":[{"day":"...","format":"reel","topic":"...","goal":"reach","hook":"...","cta":"...","required_assets":[...],"priority":"high","effort":"medium","reason":"..."}, ... 7 items ...]}

Никакого текста до или после JSON. Ровно 7 items.`;

function safeJson<T>(s: string): T | null {
  try {
    return JSON.parse(s.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()) as T;
  } catch {
    return null;
  }
}

const ALLOWED_FORMAT = new Set(["reel", "carousel", "post"]);
const ALLOWED_GOAL = new Set(["reach", "saves", "shares", "warm", "leads"]);
const ALLOWED_PRIORITY = new Set(["high", "medium", "low"]);
const ALLOWED_EFFORT = new Set(["low", "medium", "high"]);

function clamp<T extends string>(v: any, allowed: Set<string>, fallback: T): T {
  return allowed.has(String(v)) ? (String(v) as T) : fallback;
}

export async function generateIgWeeklyPlan(args: {
  client: Anthropic;
  niche?: string;
  weekStart: string;
  analysis: IgAnalysisResult;
  priorTopics?: string[];
  projectId: string;
  tgId: number;
}): Promise<{ plan: IgWeeklyPlan | null; cost: number }> {
  const { client, niche, weekStart, analysis, priorTopics, projectId, tgId } = args;

  const ctx = {
    niche: niche || "",
    week_start: weekStart,
    analysis,
    prior_topics: (priorTopics || []).slice(0, 30),
  };

  const res = await client.messages.create({
    model: IG_PLANNER_MODEL,
    max_tokens: 2200,
    system: buildAgentSystem("alexander", PLANNER_TASK),
    messages: [{ role: "user", content: sanitizeForAnthropic(JSON.stringify(ctx)) }],
  });

  const cost = await recordSpend({
    projectId,
    agentRole: "planner",
    model: IG_PLANNER_MODEL,
    usage: res.usage as any,
    tgId,
  });

  const raw = res.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  const parsed = safeJson<IgWeeklyPlan>(raw);
  if (!parsed || !Array.isArray(parsed.items) || parsed.items.length < 5) {
    return { plan: null, cost };
  }

  const norm: IgWeeklyPlan = {
    week_start: weekStart,
    summary: String(parsed.summary || "").slice(0, 600),
    items: parsed.items.slice(0, 7).map((it: any, i: number) => ({
      day: String(it.day || weekStart).slice(0, 10),
      format: clamp(it.format, ALLOWED_FORMAT, "post") as IgPlanItem["format"],
      topic: String(it.topic || "").slice(0, 140),
      goal: clamp(it.goal, ALLOWED_GOAL, "warm") as IgPlanItem["goal"],
      hook: String(it.hook || "").slice(0, 100),
      cta: String(it.cta || "").slice(0, 80),
      required_assets: Array.isArray(it.required_assets)
        ? it.required_assets.slice(0, 5).map((x: any) => String(x).slice(0, 140))
        : [],
      priority: clamp(it.priority, ALLOWED_PRIORITY, "medium") as IgPlanItem["priority"],
      effort: clamp(it.effort, ALLOWED_EFFORT, "medium") as IgPlanItem["effort"],
      reason: String(it.reason || "").slice(0, 240),
    })),
  };

  return { plan: norm, cost };
}
