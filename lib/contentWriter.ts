import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "./supabase";
import { fetchChannelMeta } from "./parseTmePreview";
import { canSpend, recordSpend } from "./projectBudget";
import { buildStrategyHint } from "./strategyAnalyzer";
import { buildAgentSystem } from "./agents";

// Writer = Алина (копирайтер из команды 7 агентов)
// Editor = Аркадий (критик из команды 7 агентов)
const WRITER_MODEL = "claude-sonnet-4-6";
const EDITOR_MODEL = "claude-sonnet-4-6";

const WRITER_TASK = `ЗАДАЧА: пост для Telegram-канала.

Требования:
• Длина body: 500–800 символов. Жёсткий потолок 900. Лучше короче, чем длиннее.
• Hook в первой строке: цифра, неожиданное утверждение или вопрос
• ВЕЧНОЗЕЛЁНЫЙ контент: никаких конкретных годов и фраз "в этом году", "сегодня"
• Орфография и пунктуация — без ошибок. В сомнительных словах выбирай простой синоним.
• Без штампов, без воды, без LinkedIn-стиля

ФОРМАТИРОВАНИЕ (Telegram HTML):
Разрешены ТОЛЬКО эти теги, остальное — plain text:
• <b>...</b> — жирный (для подзаголовков и важных слов, 1–3 раза за пост)
• <i>...</i> — курсив (редко, по делу)
• <u>...</u> — подчёркивание (1 раз, для ключевой фразы)
• <blockquote>...</blockquote> — ОБЯЗАТЕЛЬНО ровно ОДИН раз за пост. Внутрь помещай главную мысль/цитату/гипотезу — то, что хочешь чтобы читатель запомнил. Текст внутри 1–3 коротких строки.

Списки — через символ • в начале строки (НЕ через <ul>).
Подзаголовки — отдельная строка, обёрнутая в <b>...</b>.
НИКАКИХ других тегов (<p>, <br>, <h1>, <ul>, <li>, <span>, <div>, <strong>, <em> и т.п.).
НИКАКОГО markdown (**, __, #, ~, > в начале строки).

ЭКРАНИРОВАНИЕ: если в тексте поста (вне тегов) встречаются символы & < > — заменяй их на &amp; &lt; &gt; соответственно. Внутри <blockquote>, <b>, <i>, <u> — те же правила.

Формат ответа — ВСЕГДА строгий JSON одной строкой:
{"titles":["вариант 1","вариант 2","вариант 3"],"body":"текст поста с HTML-тегами"}

titles — 3 разных A/B заголовка, 30–70 символов каждый, без эмодзи в начале, БЕЗ HTML-тегов внутри (plain text).
body — готовый пост с разметкой Telegram HTML.
Никакого текста до или после JSON.`;

const EDITOR_TASK = `ЗАДАЧА: отредактировать черновик поста (JSON) и вернуть улучшенную версию.

Что делаешь:
• Исправляешь все орфографические и пунктуационные ошибки — это приоритет №1
• Убираешь канцеляризмы, штампы, водянистые обороты
• Если body длиннее 800 символов — сокращаешь до 600–800, не теряя сути
• Сохраняешь голос автора, не переписываешь радикально
• УБИРАЕШЬ упоминания конкретных годов и фраз "в этом году", "сегодня"

РАЗМЕТКА (Telegram HTML) — обязательно сохрани и при необходимости приведи в порядок:
• Разрешены ТОЛЬКО теги: <b> <i> <u> <blockquote>. Все остальные удали, оставив содержимое.
• Markdown (**, __, #, ~) — заменяй на нужный тег или убирай.
• Ровно ОДИН <blockquote> за пост с ключевой фразой. Если автор забыл — выдели самую сильную мысль и оберни.
• Если тегов слишком много (>5 пар не считая blockquote) — оставь самые значимые.
• Спецсимволы &<> вне тегов должны быть как &amp; &lt; &gt;.

titles — оставь без HTML, plain text.

Формат вывода — тот же JSON, что на входе: {"titles":[...],"body":"..."}
Никакого текста до или после JSON.`;

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

export async function generateDraftForProject(
  projectId: string,
  seed?: { planId?: string; planDay?: string; topic?: string; hook?: string }
): Promise<{ draftId: string; cost: number } | { skipped: string }> {
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
  const seedHint = seed?.topic
    ? `КОНКРЕТНАЯ ТЕМА ДЛЯ ЭТОГО ПОСТА (из плана недели на ${seed.planDay ?? "день"}):\nТема: ${seed.topic}${seed.hook ? `\nЗатравочный hook: ${seed.hook}` : ""}\nПиши строго по этой теме, ничего не придумывай свежее.`
    : "";

  const parts = [strategyHint, seedHint, userContext].filter(Boolean);
  const finalContext = parts.join("\n\n");

  const client = new Anthropic({ apiKey });

  const writerRes = await client.messages.create({
    model: WRITER_MODEL,
    max_tokens: 700,
    system: buildAgentSystem("alina", WRITER_TASK),
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
    max_tokens: 700,
    system: buildAgentSystem("arkadiy", EDITOR_TASK),
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
      source: seed?.planId ? "plan" : "auto",
      model_writer: WRITER_MODEL,
      model_editor: EDITOR_MODEL,
      cost_usd: totalCost,
      status: "pending",
      plan_id: seed?.planId ?? null,
      plan_day: seed?.planDay ?? null,
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
