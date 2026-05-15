import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "./supabase";
import { fetchChannelMeta } from "./parseTmePreview";
import { canSpend, recordSpend } from "./projectBudget";

const NICHE_MODEL = "claude-sonnet-4-6";

const NICHE_SYSTEM = `Ты — Разведчик ниши в команде LEX AI. Твоя задача — найти 8–15 РЕАЛЬНЫХ публичных Telegram-каналов, релевантных нише пользователя.

Используй инструмент web_search чтобы искать запросы вида:
• "telegram канал [тема]" site:t.me
• [тема] tgstat
• [тема] подборка telegram каналов

В выводе верни СТРОГИЙ JSON одной строкой:
{"channels":["username1","username2",...],"queries_used":["..."]}

В channels — только username без @ и без https://t.me/. Не выдумывай — если не нашёл, верни пустой массив. Никаких пояснений, только JSON.`;

function safeJson<T>(s: string): T | null {
  try {
    const cleaned = s.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

export async function searchNicheChannels(opts: {
  projectId: string;
  channelTitle: string;
  channelDescription: string | null;
  recentPostSamples: string[];
  excludeUsernames: Set<string>;
}): Promise<{
  candidates: { username: string; title: string | null; subscribers: number | null; description: string | null }[];
  cost: number;
  raw_returned: string[];
  validated_dead: string[];
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

  const sample = opts.recentPostSamples.slice(0, 3).map((s) => s.replace(/\n+/g, " ").slice(0, 200)).join("\n\n");

  const userMsg = [
    `Канал: ${opts.channelTitle}`,
    opts.channelDescription ? `Описание: ${opts.channelDescription.slice(0, 500)}` : null,
    sample ? `Примеры постов:\n${sample}` : null,
    `Найди публичные Telegram-каналы той же или смежной ниши. ${opts.excludeUsernames.size > 0 ? `Исключи: ${[...opts.excludeUsernames].slice(0, 20).join(", ")}.` : ""}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: NICHE_MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: NICHE_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 } as any],
    messages: [{ role: "user", content: userMsg }],
  } as any);

  const cost = await recordSpend({
    projectId: opts.projectId,
    agentRole: "scout",
    model: NICHE_MODEL,
    usage: res.usage as any,
  });

  const text = res.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  const parsed = safeJson<{ channels: string[] }>(text);
  const raw = parsed?.channels ?? [];

  const cleaned = raw
    .map((u) => u.replace(/^@/, "").replace(/^https?:\/\/t\.me\/(?:s\/)?/, "").replace(/\/$/, "").toLowerCase().trim())
    .filter((u) => /^[a-z][a-z0-9_]{3,30}$/.test(u))
    .filter((u) => !u.endsWith("_bot") && !u.endsWith("bot"))
    .filter((u) => !opts.excludeUsernames.has(u))
    .slice(0, 15);

  const dedup = [...new Set(cleaned)];

  const validatedResults = await Promise.all(
    dedup.map(async (u) => {
      try {
        const m = await fetchChannelMeta(u);
        if (!m.title && !m.subscribers) return { username: u, dead: true, candidate: null };
        return {
          username: u,
          dead: false,
          candidate: { username: u, title: m.title, subscribers: m.subscribers, description: m.description },
        };
      } catch {
        return { username: u, dead: true, candidate: null };
      }
    })
  );

  return {
    candidates: validatedResults.flatMap((v) => (v.candidate ? [v.candidate] : [])),
    cost,
    raw_returned: dedup,
    validated_dead: validatedResults.filter((v) => v.dead).map((v) => v.username),
  };
}
