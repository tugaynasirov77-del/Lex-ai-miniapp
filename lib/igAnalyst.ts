import Anthropic from "@anthropic-ai/sdk";
import { buildAgentSystem } from "./agents";
import { sanitizeForAnthropic } from "./sanitize";
import { recordSpend } from "./projectBudget";

export const IG_ANALYST_MODEL = "claude-sonnet-4-6";
export const IG_ANALYST_PROMPT_VERSION = "v1";

export type CompetitorInput = {
  id?: string;
  username: string;
  profile_url?: string | null;
  notes?: string | null;
};

export type IgAnalysisResult = {
  executive_summary: string;
  content_themes: string[];
  recurring_formats: string[];
  hook_patterns: string[];
  cta_patterns: string[];
  visual_style: string;
  posting_cadence: string;
  content_gaps: string[];
  opportunities: string[];
};

const ANALYST_TASK = `ЗАДАЧА: проанализировать список конкурентов Instagram-аккаунта и собрать стратегический отчёт.

Вход — JSON: {"niche":"...","my_account":"...","competitors":[{"username":"...","profile_url":"...","notes":"..."}, ...]}.

Что делаешь:
1. Используешь общие знания про Instagram-маркетинг и заметки клиента про каждого конкурента (notes). НЕ выдумывай конкретных постов или цифр, которых нет в данных.
2. Если notes пустой или короткий — опирайся на типовые паттерны ниши: какой контент обычно делают в этой нише, какие форматы работают.
3. Собираешь структурированный отчёт.

Поля отчёта:
• executive_summary — 2–3 предложения общего вывода: что делают конкуренты, в чём паттерн ниши
• content_themes — массив 5–8 ключевых тем
• recurring_formats — массив типовых форматов: "reel-tutorial", "carousel-checklist", "post-quote", "story-poll" и т.п.
• hook_patterns — массив 5–8 паттернов hook'ов: "Цифра + результат", "Вопрос к боли", "Антитеза", "Лайфхак"...
• cta_patterns — массив типовых CTA: "Сохрани пост", "Пиши в комментариях", "Переходи в шапку"...
• visual_style — короткое описание визуального паттерна ниши: типографика, цветовая палитра, обработка
• posting_cadence — оценка частоты: "ежедневно", "5 раз в неделю", "1 reel + 2 поста в неделю"...
• content_gaps — массив 3–5 тем, которые конкуренты упускают
• opportunities — массив 3–5 конкретных идей, чем можно отстроиться

Запреты:
- не выдумывай цифр и числовых метрик которых нет в notes
- не используй markdown
- никаких "сегодня", конкретных годов

Формат — строгий JSON одной строкой:
{"executive_summary":"...","content_themes":[...],"recurring_formats":[...],"hook_patterns":[...],"cta_patterns":[...],"visual_style":"...","posting_cadence":"...","content_gaps":[...],"opportunities":[...]}

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

function clampArr(a: any, maxItems: number, itemMax: number): string[] {
  if (!Array.isArray(a)) return [];
  return a.slice(0, maxItems).map((x) => clampStr(x, itemMax)).filter(Boolean);
}

export async function analyzeIgCompetitors(args: {
  client: Anthropic;
  niche?: string;
  myAccount?: string;
  competitors: CompetitorInput[];
  projectId: string;
  tgId: number;
}): Promise<{ result: IgAnalysisResult | null; cost: number }> {
  const { client, niche, myAccount, competitors, projectId, tgId } = args;

  const ctx = {
    niche: niche || "",
    my_account: myAccount || "",
    competitors: competitors.slice(0, 20).map((c) => ({
      username: c.username,
      profile_url: c.profile_url || "",
      notes: (c.notes || "").slice(0, 800),
    })),
  };

  const res = await client.messages.create({
    model: IG_ANALYST_MODEL,
    max_tokens: 1800,
    system: buildAgentSystem("nikolay", ANALYST_TASK),
    messages: [{ role: "user", content: sanitizeForAnthropic(JSON.stringify(ctx)) }],
  });

  const cost = await recordSpend({
    projectId,
    agentRole: "analyst",
    model: IG_ANALYST_MODEL,
    usage: res.usage as any,
    tgId,
  });

  const raw = res.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  const parsed = safeJson<IgAnalysisResult>(raw);
  if (!parsed || typeof parsed.executive_summary !== "string") {
    return { result: null, cost };
  }

  const norm: IgAnalysisResult = {
    executive_summary: clampStr(parsed.executive_summary, 600),
    content_themes: clampArr(parsed.content_themes, 8, 80),
    recurring_formats: clampArr(parsed.recurring_formats, 10, 80),
    hook_patterns: clampArr(parsed.hook_patterns, 8, 120),
    cta_patterns: clampArr(parsed.cta_patterns, 8, 120),
    visual_style: clampStr(parsed.visual_style, 300),
    posting_cadence: clampStr(parsed.posting_cadence, 200),
    content_gaps: clampArr(parsed.content_gaps, 5, 160),
    opportunities: clampArr(parsed.opportunities, 5, 200),
  };

  return { result: norm, cost };
}
