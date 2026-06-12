import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "./supabase";
import { fetchChannelMeta } from "./parseTmePreview";
import { canSpend, recordSpend } from "./projectBudget";
import { buildStrategyHint } from "./strategyAnalyzer";
import { buildAgentSystem } from "./agents";
import { sanitizeForAnthropic } from "./sanitize";
import { reviewDraft, ARKADIY_MODEL, type DraftJSON } from "./arkadiyEditor";

// Writer = Алина (копирайтер)
// Editor = Аркадий (критик-редактор): оценивает 1-10 + чистит. <7 → 1 retry к Алине.
//
// На Vercel Hobby (10s ceiling) Sonnet + Editor не помещается в writer-cron
// (504 timeout, посты не пишутся). Haiku 4.5 ~3× быстрее, для коротких
// TG-постов даёт приемлемое качество. На Vercel Pro (60s) — вернуть Sonnet.
const WRITER_MODEL = "claude-haiku-4-5-20251001";
const EDITOR_MODEL = ARKADIY_MODEL;

const WRITER_TASK = `ЗАДАЧА: пост для Telegram-канала.

Требования:
• Длина body: 500–800 символов. Жёсткий потолок 900. Лучше короче, чем длиннее.
• Hook в первой строке: цифра, неожиданное утверждение или вопрос
• ВЕЧНОЗЕЛЁНЫЙ контент: никаких конкретных годов и фраз "в этом году", "сегодня"
• Орфография и пунктуация — без ошибок. В сомнительных словах выбирай простой синоним.
• Без штампов, без воды, без LinkedIn-стиля
• Эмодзи: 1–3 штуки на пост, тематические (про деньги — 💸, про время — ⏳, про инсайт — 💡 и т.п.). НЕ ставь подряд несколько эмодзи. НЕ в каждой строке. Без перегруза.

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

const POLL_TASK = `ЗАДАЧА: создать ОПРОС для Telegram-канала.

Аудитория голосует — вопрос должен быть провокационным, заставлять выбрать сторону.

Требования:
• question: один короткий конкретный вопрос (≤ 200 символов). Не "что вы думаете о X", а "что важнее: А или Б?"
• options: 2–4 варианта ответа, каждый ≤ 100 символов. Без эмодзи в начале. Варианты должны быть взаимоисключающие и плюс-минус равнопривлекательные.
• type: "poll" (обычный опрос — голосуют без правильного ответа) или "quiz" (один правильный ответ + объяснение)
• Для quiz: correct_option_id — индекс правильного варианта (0..n-1), explanation — короткое объяснение почему именно этот, ≤ 200 символов
• Орфография — без ошибок

Формат ответа — ВСЕГДА строгий JSON одной строкой:
{"question":"вопрос?","options":["вариант 1","вариант 2"],"type":"poll","correct_option_id":null,"explanation":null}

Для quiz: type="quiz", correct_option_id=число, explanation=строка.
Никакого текста до или после JSON.`;

type Draft = DraftJSON;
type PollDraft = {
  question: string;
  options: string[];
  type: "poll" | "quiz";
  correct_option_id?: number | null;
  explanation?: string | null;
};

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
  seed?: { planId?: string; planDay?: string; topic?: string; hook?: string; format?: "text" | "poll" | "quiz" }
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

  // Ветка для опросов: один запрос к Алине, без Editor (формат строгий и короткий)
  const isPoll = seed?.format === "poll" || seed?.format === "quiz";
  if (isPoll) {
    return await generatePollDraft({
      sb, client, projectId, project, finalContext, seed,
    });
  }

  const writerRes = await client.messages.create({
    model: WRITER_MODEL,
    max_tokens: 700,
    system: buildAgentSystem("alina", WRITER_TASK),
    messages: [{ role: "user", content: sanitizeForAnthropic(finalContext) }],
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

  // Аркадий-редактор: оценка 1-10 + чистка
  let totalCost = writerCost;
  const firstReview = await reviewDraft({ client, draft, projectId, tgId: project.tg_id });
  totalCost += firstReview.cost;

  let review = firstReview.review;
  if (review?.cleaned) draft = review.cleaned;

  // Если Аркадий вернул rewrite — один retry к Алине с его комментариями
  let retried = false;
  if (review && review.verdict === "rewrite") {
    retried = true;
    const retryContext = `${sanitizeForAnthropic(finalContext)}\n\nПРЕДЫДУЩАЯ ВЕРСИЯ НЕ ПРОШЛА РЕДАКТУРУ (Аркадий, балл ${review.score}/10).\nЗамечания: ${review.comments}\n${review.errors.length ? "Косяки: " + review.errors.join("; ") : ""}\nПерепиши пост, устранив всё перечисленное. Сохрани JSON-формат.`;

    const retryRes = await client.messages.create({
      model: WRITER_MODEL,
      max_tokens: 700,
      system: buildAgentSystem("alina", WRITER_TASK),
      messages: [{ role: "user", content: retryContext }],
    });
    totalCost += await recordSpend({
      projectId,
      agentRole: "writer",
      model: WRITER_MODEL,
      usage: retryRes.usage as any,
      tgId: project.tg_id,
    });
    const retryText = retryRes.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    const retryDraft = safeJson<Draft>(retryText);
    if (retryDraft && Array.isArray(retryDraft.titles) && retryDraft.body) {
      const secondReview = await reviewDraft({ client, draft: retryDraft, projectId, tgId: project.tg_id });
      totalCost += secondReview.cost;
      if (secondReview.review?.cleaned) {
        draft = secondReview.review.cleaned;
        review = secondReview.review;
      }
    }
  }

  const needsReview = !review || review.score < 7;

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
      editor_score: review?.score ?? null,
      editor_verdict: review?.verdict ?? null,
      editor_comments: review?.comments ?? null,
      editor_errors: review?.errors ?? null,
      editor_retried: retried,
      needs_review: needsReview,
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

async function generatePollDraft(args: {
  sb: ReturnType<typeof getSupabase>;
  client: Anthropic;
  projectId: string;
  project: { tg_id: number };
  finalContext: string;
  seed?: { planId?: string; planDay?: string; format?: "text" | "poll" | "quiz" };
}): Promise<{ draftId: string; cost: number } | { skipped: string }> {
  const { sb, client, projectId, project, finalContext, seed } = args;
  const typeHint = seed?.format === "quiz" ? "Сделай QUIZ (type=\"quiz\") с одним правильным ответом и explanation." : "Сделай обычный POLL (type=\"poll\") без правильного ответа.";
  const ctx = `${finalContext}\n\n${typeHint}`;

  const res = await client.messages.create({
    model: WRITER_MODEL,
    max_tokens: 500,
    system: buildAgentSystem("alina", POLL_TASK),
    messages: [{ role: "user", content: sanitizeForAnthropic(ctx) }],
  });

  const cost = await recordSpend({
    projectId,
    agentRole: "writer",
    model: WRITER_MODEL,
    usage: res.usage as any,
    tgId: project.tg_id,
  });

  const raw = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  const poll = safeJson<PollDraft>(raw);
  if (!poll || !poll.question || !Array.isArray(poll.options) || poll.options.length < 2 || poll.options.length > 4) {
    return { skipped: "writer returned invalid poll JSON" };
  }

  const pollType: "poll" | "quiz" = poll.type === "quiz" ? "quiz" : "poll";
  const pollData = {
    question: poll.question.slice(0, 300),
    options: poll.options.map((o) => o.slice(0, 100)),
    type: pollType,
    correct_option_id: pollType === "quiz" && typeof poll.correct_option_id === "number" ? poll.correct_option_id : null,
    explanation: pollType === "quiz" && poll.explanation ? poll.explanation.slice(0, 200) : null,
  };

  // body хранит превью-текст для UI; title_variants пустой
  const previewBody = `${pollData.question}\n${pollData.options.map((o, i) => `${i + 1}. ${o}`).join("\n")}`;

  const { data: insertedRows, error } = await sb
    .from("content_drafts")
    .insert({
      project_id: projectId,
      title_variants: [],
      body: previewBody,
      source: seed?.planId ? "plan" : "auto",
      model_writer: WRITER_MODEL,
      cost_usd: cost,
      status: "pending",
      plan_id: seed?.planId ?? null,
      plan_day: seed?.planDay ?? null,
      poll_data: pollData,
    })
    .select("id")
    .single();
  if (error || !insertedRows) throw new Error(error?.message || "insert failed");

  return { draftId: insertedRows.id, cost };
}
