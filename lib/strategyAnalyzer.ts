import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "./supabase";
import { fetchChannelPreview } from "./parseTmePreview";
import { canSpend, recordSpend } from "./projectBudget";
import { buildAgentSystem } from "./agents";
import { sanitizeForAnthropic } from "./sanitize";

// Strategy Analyzer = Николай (аналитик из команды 7 агентов)
// Haiku для Hobby. На Vercel Pro вернуть Sonnet.
const ANALYZER_MODEL = "claude-haiku-4-5-20251001";

const ANALYZER_TASK = `ЗАДАЧА: проанализировать корпус постов топ-5 каналов одной ниши с количеством просмотров и найти ВЫИГРЫШНЫЕ паттерны — что общего у постов с большими просмотрами, что отличает их от обычных.

Анализируй:
• Оптимальная длина body (в символах)
• Частота постов в неделю (по датам)
• Типы постов: insight | case | listicle | story | opinion | news | meta
• Паттерны hooks (первая строка): провокация, цифра, вопрос, неожиданное утверждение
• Использование эмодзи (минимум/умеренно/много)
• ЗАГЛАВНЫЕ подзаголовки внутри текста (часто/редко)
• Темы которые стабильно выстреливают

Формат вывода — строгий JSON одной строкой:
{"patterns":{"optimal_length_chars":[min,max],"posts_per_week":number,"top_types":["type1","type2"],"hook_patterns":["pattern1","pattern2","pattern3"],"emoji_usage":"none|low|moderate|heavy","caps_subheaders":"often|sometimes|rare","winning_topics":["topic1","topic2","topic3"]},"summary":"3-4 предложения о том как успешные каналы ниши пишут и что работает","based_on":["@chan1","@chan2"]}

Никакого текста до или после JSON.`;

type Patterns = {
  optimal_length_chars: [number, number];
  posts_per_week: number;
  top_types: string[];
  hook_patterns: string[];
  emoji_usage: string;
  caps_subheaders: string;
  winning_topics: string[];
};

type AnalyzerOutput = { patterns: Patterns; summary: string; based_on: string[] };

function safeJson<T>(s: string): T | null {
  try {
    const cleaned = s.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

export async function analyzeNicheStrategy(projectId: string): Promise<{ cost: number; posts: number; competitors: string[] } | { skipped: string }> {
  const sb = getSupabase();
  const { data: project } = await sb
    .from("projects")
    .select("id,tg_id,channel_username,channel_title")
    .eq("id", projectId)
    .single();
  if (!project) return { skipped: "no project" };

  const budget = await canSpend(projectId);
  if (!budget.ok) return { skipped: budget.reason || "budget" };

  const { data: competitors } = await sb
    .from("competitor_channels")
    .select("username,subscribers")
    .eq("project_id", projectId)
    .order("subscribers", { ascending: false, nullsFirst: false })
    .limit(5);

  const list = competitors ?? [];
  if (list.length < 2) {
    return { skipped: "нужно минимум 2 конкурента для анализа стратегии" };
  }

  const corpora = await Promise.all(
    list.map(async (c) => {
      try {
        const posts = await fetchChannelPreview(c.username);
        return { channel: c.username, subscribers: c.subscribers ?? 0, posts: posts.slice(0, 20) };
      } catch {
        return { channel: c.username, subscribers: c.subscribers ?? 0, posts: [] };
      }
    })
  );

  const totalPosts = corpora.reduce((s, c) => s + c.posts.length, 0);
  if (totalPosts < 10) {
    return { skipped: "слишком мало постов для анализа" };
  }

  const lines: string[] = [];
  for (const c of corpora) {
    if (c.posts.length === 0) continue;
    lines.push(`=== @${c.channel} (${c.subscribers.toLocaleString("ru-RU")} подписчиков) ===`);
    for (const p of c.posts) {
      const views = p.views ?? 0;
      const len = (p.text || "").length;
      const txt = (p.text || "").replace(/\n+/g, " ").slice(0, 280);
      lines.push(`[${p.published_at?.slice(0, 10) ?? "?"} • ${len}ch • 👁${views}] ${txt}`);
    }
    lines.push("");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: ANALYZER_MODEL,
    max_tokens: 2048,
    system: buildAgentSystem("nikolay", ANALYZER_TASK),
    messages: [{ role: "user", content: sanitizeForAnthropic(lines.join("\n")) }],
  });

  const cost = await recordSpend({
    projectId,
    agentRole: "strategy-analyzer",
    model: ANALYZER_MODEL,
    usage: res.usage as any,
    tgId: project.tg_id,
  });

  const raw = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  const parsed = safeJson<AnalyzerOutput>(raw);
  if (!parsed || !parsed.patterns) return { skipped: "analyzer returned invalid JSON" };

  await sb.from("niche_strategy").upsert(
    {
      project_id: projectId,
      patterns: parsed.patterns,
      summary: parsed.summary,
      based_on_competitors: parsed.based_on?.length ? parsed.based_on : list.map((c) => `@${c.username}`),
      posts_analyzed: totalPosts,
      model: ANALYZER_MODEL,
      cost_usd: cost,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id" }
  );

  return { cost, posts: totalPosts, competitors: list.map((c) => c.username) };
}

export function buildStrategyHint(patterns: any | null, summary: string | null): string {
  if (!patterns) return "";
  const parts: string[] = [];
  parts.push("СТРАТЕГИЯ НИШИ (выведена из топ-каналов):");
  if (patterns.optimal_length_chars) parts.push(`• Длина: ${patterns.optimal_length_chars[0]}–${patterns.optimal_length_chars[1]} символов`);
  if (patterns.posts_per_week) parts.push(`• Частота: ~${patterns.posts_per_week} постов/неделю`);
  if (Array.isArray(patterns.top_types) && patterns.top_types.length) parts.push(`• Топ-типы постов: ${patterns.top_types.join(", ")}`);
  if (Array.isArray(patterns.hook_patterns) && patterns.hook_patterns.length) parts.push(`• Hooks: ${patterns.hook_patterns.join(" / ")}`);
  if (patterns.emoji_usage) parts.push(`• Эмодзи: ${patterns.emoji_usage}`);
  if (patterns.caps_subheaders) parts.push(`• ЗАГЛАВНЫЕ подзаголовки: ${patterns.caps_subheaders}`);
  if (Array.isArray(patterns.winning_topics) && patterns.winning_topics.length) parts.push(`• Темы что выстреливают: ${patterns.winning_topics.join(", ")}`);
  if (summary) parts.push(`Суть: ${summary}`);
  parts.push("Применяй эти паттерны при генерации.");
  return parts.join("\n");
}
