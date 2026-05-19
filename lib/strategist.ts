import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "./supabase";
import { canSpend, recordSpend } from "./projectBudget";
import { buildStrategyHint } from "./strategyAnalyzer";
import { buildAgentSystem } from "./agents";
import { sanitizeForAnthropic } from "./sanitize";

// Strategist = Александр (стратег из команды 7 агентов)
const STRATEGIST_MODEL = "claude-sonnet-4-6";

const STRATEGIST_TASK = `ЗАДАЧА: составить недельный контент-план для Telegram-канала.

На входе: данные канала, метрики недели, топ-посты канала и конкурентов.
На выходе: план на 7 дней — по одному посту в день.

Правила:
• Каждый пост — отдельная тема, без повторов
• Hook должен быть конкретный, не общий
• Темы основаны на том что зашло у автора и у конкурентов, плюс свежий угол
• Не копируй буквально посты конкурентов — придумай свой поворот
• ВЕЧНОЗЕЛЁНЫЕ темы — никаких "тренды 2026 года" и т.п. Без привязки к конкретным годам.

РАЗНООБРАЗИЕ ФОРМАТОВ для прогрева:
Помимо обычных постов, добавляй интерактив:
• 1 день — опрос (format:"poll"): вопрос + 2–4 варианта ответа, аудитория голосует.
• Опционально 1 quiz (format:"quiz"): тот же опрос с правильным ответом.
• Остальные 5–6 дней — обычные текстовые посты (format:"text").
НЕ ставь опросы 2 дня подряд. Опрос обычно — вт или чт.

Формат вывода — строгий JSON одной строкой:
{"summary":"что сработало неделю и куда двигать дальше, 2-3 предложения","items":[{"day":"пн","topic":"короткая тема","hook":"первая строка поста","why":"почему зайдёт","type":"insight|case|listicle|story|opinion","format":"text|poll|quiz"},...]}

Ровно 7 объектов в items, дни: пн, вт, ср, чт, пт, сб, вс.
Никакого текста до или после JSON.`;

type PlanItem = {
  day: string;
  topic: string;
  hook: string;
  why: string;
  type: string;
};

type Plan = { summary: string; items: PlanItem[] };

function safeJson<T>(s: string): T | null {
  try {
    const cleaned = s.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

function weekStartUTC(d: Date = new Date()): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() - (day - 1));
  return dt.toISOString().slice(0, 10);
}

export async function generatePlanForProject(
  projectId: string,
  opts: { force?: boolean } = {}
): Promise<{ planId: string; cost: number } | { skipped: string }> {
  const sb = getSupabase();
  const { data: project } = await sb
    .from("projects")
    .select("id,tg_id,title,channel_username,channel_title")
    .eq("id", projectId)
    .single();
  if (!project || !project.channel_username) return { skipped: "no channel" };

  const wk = weekStartUTC();
  if (!opts.force) {
    const { data: existing } = await sb
      .from("content_plans")
      .select("id")
      .eq("project_id", projectId)
      .eq("week_start", wk)
      .maybeSingle();
    if (existing) return { skipped: "plan already exists for this week" };
  }
  // При force=true НЕ удаляем — будем upsert по (project_id, week_start),
  // чтобы id плана не менялся и привязанные черновики не теряли ссылку.

  const budget = await canSpend(projectId);
  if (!budget.ok) return { skipped: budget.reason || "budget" };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: myPosts }, { data: competitors }, { data: snapshots }, { data: niche }] = await Promise.all([
    sb.from("channel_posts").select("text,views").eq("project_id", projectId).gte("published_at", weekAgo).order("views", { ascending: false, nullsFirst: false }).limit(5),
    sb.from("competitor_channels").select("username,top_post_text,top_post_views").eq("project_id", projectId).limit(5),
    sb.from("channel_snapshots").select("subscribers,snapshot_at").eq("project_id", projectId).gte("snapshot_at", fourteenAgo).order("snapshot_at", { ascending: true }),
    sb.from("niche_strategy").select("patterns,summary").eq("project_id", projectId).maybeSingle(),
  ]);

  const snaps = snapshots ?? [];
  const today = snaps.length > 0 ? snaps[snaps.length - 1].subscribers : 0;
  const weekFirst = snaps.find((s) => s.snapshot_at >= weekAgo);
  const growth = weekFirst ? today - weekFirst.subscribers : 0;
  const growthPct = weekFirst && weekFirst.subscribers > 0 ? (growth / weekFirst.subscribers) * 100 : 0;

  const lines: string[] = [];
  lines.push(`Канал: ${project.channel_title || project.title}`);
  lines.push(`Подписчики: ${today.toLocaleString("ru-RU")}, прирост за 7д: ${growth >= 0 ? "+" : ""}${growth} (${growthPct.toFixed(1)}%)`);
  lines.push("");
  if (myPosts && myPosts.length > 0) {
    lines.push("Топ моих постов недели:");
    myPosts.forEach((p) => {
      if (p.text) lines.push(`— [👁 ${p.views ?? 0}] ${p.text.replace(/\n+/g, " ").slice(0, 200)}`);
    });
    lines.push("");
  }
  if (competitors && competitors.length > 0) {
    lines.push("Что выстрелило у конкурентов:");
    competitors.forEach((c) => {
      if (c.top_post_text) lines.push(`— @${c.username} [👁 ${c.top_post_views ?? 0}] ${c.top_post_text.replace(/\n+/g, " ").slice(0, 200)}`);
    });
    lines.push("");
  }
  const strategyHint = buildStrategyHint(niche?.patterns, niche?.summary ?? null);
  if (strategyHint) {
    lines.push(strategyHint);
    lines.push("");
  }
  lines.push("Составь план на следующую неделю.");

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: STRATEGIST_MODEL,
    max_tokens: 2048,
    system: buildAgentSystem("alexander", STRATEGIST_TASK),
    messages: [{ role: "user", content: sanitizeForAnthropic(lines.join("\n")) }],
  });

  const cost = await recordSpend({
    projectId,
    agentRole: "strategist",
    model: STRATEGIST_MODEL,
    usage: res.usage as any,
    tgId: project.tg_id,
  });

  const raw = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  const plan = safeJson<Plan>(raw);
  if (!plan || !Array.isArray(plan.items) || plan.items.length === 0) {
    return { skipped: "strategist returned invalid JSON" };
  }

  const { data: inserted, error } = await sb
    .from("content_plans")
    .upsert(
      {
        project_id: projectId,
        week_start: wk,
        items: plan.items,
        summary: plan.summary,
        cost_usd: cost,
        model: STRATEGIST_MODEL,
      },
      { onConflict: "project_id,week_start" }
    )
    .select("id")
    .single();
  if (error || !inserted) throw new Error(error?.message || "upsert plan failed");

  await sb
    .from("project_agents")
    .update({ status: "active", last_run_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("role", "strategist");

  return { planId: inserted.id, cost };
}
