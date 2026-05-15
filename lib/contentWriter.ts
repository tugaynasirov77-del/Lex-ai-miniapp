import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "./supabase";
import { fetchChannelMeta } from "./parseTmePreview";
import { canSpend, recordSpend } from "./projectBudget";
import { buildStrategyHint } from "./strategyAnalyzer";

const WRITER_MODEL = "claude-sonnet-4-6";
const EDITOR_MODEL = "claude-haiku-4-5-20251001";

const WRITER_SYSTEM = `Ты — Контентщик в команде LEX AI. Пишешь посты для Telegram-каналов.

Правила стиля (для ВСЕХ каналов LEX):
• plain text без markdown (никаких **, __, #, ~, > и т.п.)
• ЗАГЛАВНЫМИ — короткие подзаголовки (не более 5 слов)
• Списки — через символ • (а не - или *)
• Длина основного текста: 600-1200 символов
• Без воды, без штампов "в современном мире", без LinkedIn-стиля
• Hook в первой строке: цифра, неожиданное утверждение или вопрос
• ВЕЧНОЗЕЛЁНЫЙ контент: никаких конкретных годов (2023, 2024, 2025, 2026 и т.п.), никаких "в этом году", "сегодня в наши дни". Темы вне времени.

Формат ответа — ВСЕГДА строгий JSON одной строкой:
{"titles":["вариант 1","вариант 2","вариант 3"],"body":"текст поста"}

titles — 3 разных A/B заголовка, длина 30-70 символов каждый, без эмодзи в начале.
body — готовый пост.
Никакого текста до или после JSON.`;

const EDITOR_SYSTEM = `Ты — Редактор. Получаешь черновик поста (JSON), возвращаешь его улучшенную версию.
Что делаешь:
• Исправляешь грамматику и пунктуацию
• Убираешь канцеляризмы и штампы
• Сохраняешь голос автора, не переписываешь радикально
• Длина body не должна вырасти
• Markdown оставляй очищенным (никаких ** или #)
• УБИРАЕШЬ все упоминания конкретных годов (2023, 2024, 2025, 2026...) и фраз "в этом году", "сегодня в наши дни" — контент должен быть вечнозелёным

Формат вывода — тот же JSON, что на входе: {"titles":[...],"body":"..."}`;

type Draft = { titles: string[]; body: string };

function safeJson<T>(s: string): T | null {
  try {
    const cleaned = s.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

function buildUserContext(opts: {
  channelTitle: string;
  channelDescription: string | null;
  myTopPosts: { text: string; views: number | null }[];
  competitorTopPosts: { text: string; views: number | null; channel: string }[];
}) {
  const lines: string[] = [];
  lines.push(`Канал: ${opts.channelTitle}`);
  if (opts.channelDescription) lines.push(`Описание: ${opts.channelDescription.slice(0, 300)}`);
  lines.push("");
  if (opts.myTopPosts.length > 0) {
    lines.push("Топ моих постов (для тона):");
    opts.myTopPosts.slice(0, 3).forEach((p) => {
      lines.push(`— [👁 ${p.views ?? 0}] ${p.text.replace(/\n+/g, " ").slice(0, 200)}`);
    });
    lines.push("");
  }
  if (opts.competitorTopPosts.length > 0) {
    lines.push("Топ постов конкурентов (для тем/идей):");
    opts.competitorTopPosts.slice(0, 3).forEach((p) => {
      lines.push(`— @${p.channel} [👁 ${p.views ?? 0}] ${p.text.replace(/\n+/g, " ").slice(0, 200)}`);
    });
    lines.push("");
  }
  lines.push("Напиши новый пост на интересную для аудитории тему. Не копируй буквально — придумай свежий угол.");
  return lines.join("\n");
}

export async function generateDraftForProject(projectId: string): Promise<{ draftId: string; cost: number } | { skipped: string }> {
  const sb = getSupabase();
  const { data: project } = await sb
    .from("projects")
    .select("id,tg_id,title,channel_username,channel_title")
    .eq("id", projectId)
    .single();
  if (!project || !project.channel_username) return { skipped: "no channel" };

  const budget = await canSpend(projectId);
  if (!budget.ok) return { skipped: budget.reason || "budget" };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

  const [{ data: myPosts }, { data: competitors }, meta, { data: niche }] = await Promise.all([
    sb.from("channel_posts").select("text,views").eq("project_id", projectId).order("views", { ascending: false, nullsFirst: false }).limit(3),
    sb.from("competitor_channels").select("username,top_post_text,top_post_views").eq("project_id", projectId).limit(3),
    fetchChannelMeta(project.channel_username).catch(() => ({ title: null, description: null, subscribers: null })),
    sb.from("niche_strategy").select("patterns,summary").eq("project_id", projectId).maybeSingle(),
  ]);

  const userContext = buildUserContext({
    channelTitle: meta.title || project.channel_title || project.title,
    channelDescription: meta.description,
    myTopPosts: (myPosts ?? []).filter((p) => p.text).map((p) => ({ text: p.text as string, views: p.views })),
    competitorTopPosts: (competitors ?? [])
      .filter((c) => c.top_post_text)
      .map((c) => ({ text: c.top_post_text as string, views: c.top_post_views, channel: c.username })),
  });

  const strategyHint = buildStrategyHint(niche?.patterns, niche?.summary ?? null);
  const finalContext = strategyHint ? `${strategyHint}\n\n${userContext}` : userContext;

  const client = new Anthropic({ apiKey });

  const writerRes = await client.messages.create({
    model: WRITER_MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: WRITER_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: finalContext }],
  });

  const writerCost = await recordSpend({
    projectId,
    agentRole: "writer",
    model: WRITER_MODEL,
    usage: writerRes.usage as any,
    tgId: project.tg_id,
  });

  const writerText = writerRes.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  let draft = safeJson<Draft>(writerText);
  if (!draft || !Array.isArray(draft.titles) || !draft.body) {
    return { skipped: "writer returned invalid JSON" };
  }

  const editorRes = await client.messages.create({
    model: EDITOR_MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: EDITOR_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: JSON.stringify(draft) }],
  });

  const editorCost = await recordSpend({
    projectId,
    agentRole: "editor",
    model: EDITOR_MODEL,
    usage: editorRes.usage as any,
    tgId: project.tg_id,
  });

  const editorText = editorRes.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  const edited = safeJson<Draft>(editorText);
  if (edited && Array.isArray(edited.titles) && edited.body) draft = edited;

  const totalCost = writerCost + editorCost;

  const { data: insertedRows, error } = await sb
    .from("content_drafts")
    .insert({
      project_id: projectId,
      title_variants: draft.titles.slice(0, 3),
      body: draft.body,
      source: "auto",
      model_writer: WRITER_MODEL,
      model_editor: EDITOR_MODEL,
      cost_usd: totalCost,
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !insertedRows) throw new Error(error?.message || "insert failed");

  await sb
    .from("project_agents")
    .update({ status: "active", last_run_at: new Date().toISOString() })
    .in("role", ["writer", "editor"])
    .eq("project_id", projectId);

  return { draftId: insertedRows.id, cost: totalCost };
}
