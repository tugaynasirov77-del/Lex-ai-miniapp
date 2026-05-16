import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "./supabase";
import { fetchChannelMeta, fetchChannelPreview } from "./parseTmePreview";
import { canSpend, recordSpend } from "./projectBudget";
import { buildAgentSystem } from "./agents";

// Scout = Милена (маркетолог из команды 7 агентов — ниши и аудитории её зона)
const SCOUT_MODEL = "claude-haiku-4-5-20251001";

const SCOUT_TASK = `ЗАДАЧА: оценить каналы-кандидаты на роль конкурентов для канала пользователя.

Тебе дают:
1. Контекст моего канала (название, описание, темы)
2. Список кандидатов: @username, название, описание, подписчики

Твоя задача — для каждого кандидата выставить балл релевантности 0-10:
• 10 = прямой конкурент той же ниши с похожей аудиторией
• 6-9 = смежная ниша, частичное пересечение аудитории
• 3-5 = слабая связь, скорее всего бесполезно
• 0-2 = вообще не та тема (новости, спам, реклама, личный блог не по теме)

Формат вывода — строгий JSON одной строкой:
{"results":[{"username":"...","score":0-10,"reason":"одно предложение"}]}

Никакого текста до или после JSON. Только релевантные (>=6) важны, остальным ставь честные низкие баллы.`;

const USERNAME_RE = /(?:@|t\.me\/(?:s\/)?)([a-zA-Z][a-zA-Z0-9_]{3,30})\b/g;

function extractMentions(texts: string[]): string[] {
  const set = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    let m: RegExpExecArray | null;
    USERNAME_RE.lastIndex = 0;
    while ((m = USERNAME_RE.exec(t))) {
      const u = m[1].toLowerCase();
      set.add(u);
    }
  }
  return [...set];
}

function safeJson<T>(s: string): T | null {
  try {
    const cleaned = s.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

export async function discoverCompetitorsForProject(
  projectId: string
): Promise<
  | { found: number; cost: number; suggestions: any[]; diagnostics?: any }
  | { skipped: string }
> {
  const sb = getSupabase();
  const { data: project } = await sb
    .from("projects")
    .select("id,tg_id,title,channel_username,channel_title")
    .eq("id", projectId)
    .single();
  if (!project || !project.channel_username) return { skipped: "no channel" };

  const budget = await canSpend(projectId);
  if (!budget.ok) return { skipped: budget.reason || "budget" };

  const [{ data: posts }, { data: existingComp }, { data: existingSug }, meta] = await Promise.all([
    sb.from("channel_posts").select("text,forwarded_from").eq("project_id", projectId).limit(100),
    sb.from("competitor_channels").select("username").eq("project_id", projectId),
    sb.from("scout_suggestions").select("username,status").eq("project_id", projectId),
    fetchChannelMeta(project.channel_username).catch(() => ({ title: null, description: null, subscribers: null })),
  ]);

  const dbForwards = (posts ?? []).map((p) => (p as any).forwarded_from).filter((x): x is string => !!x);
  const mentions = extractMentions((posts ?? []).map((p) => p.text || ""));

  let livePosts: Awaited<ReturnType<typeof fetchChannelPreview>> = [];
  try {
    livePosts = await fetchChannelPreview(project.channel_username);
  } catch {}
  const liveForwards = livePosts.map((p) => p.forwarded_from).filter((x): x is string => !!x);
  const liveMentions = extractMentions(livePosts.map((p) => p.text || ""));

  const competitorUsernames = (existingComp ?? []).map((c) => c.username);
  const competitorPosts = (
    await Promise.all(
      competitorUsernames.map((u) => fetchChannelPreview(u).catch(() => []))
    )
  ).flat();
  const compForwards = competitorPosts.map((p) => p.forwarded_from).filter((x): x is string => !!x);
  const compMentions = extractMentions(competitorPosts.map((p) => p.text || ""));

  const ownUsernameLower = project.channel_username.toLowerCase();
  const excludeForNiche = new Set<string>([ownUsernameLower]);
  for (const c of existingComp ?? []) excludeForNiche.add(c.username.toLowerCase());
  for (const s of existingSug ?? []) excludeForNiche.add(s.username.toLowerCase());

  // Niche search через web_search убран: $0.10/клик и нестабильно.
  // Источники: mentions/forwards твоих постов + viral expansion через постов добавленных конкурентов.
  void excludeForNiche;

  const allCandidates = [...new Set(
    [...mentions, ...dbForwards, ...liveForwards, ...liveMentions, ...compForwards, ...compMentions].map((s) => s.toLowerCase())
  )];

  const ownUsername = project.channel_username.toLowerCase();
  const blocked = new Set<string>([ownUsername]);
  for (const c of existingComp ?? []) blocked.add(c.username.toLowerCase());
  for (const s of existingSug ?? []) blocked.add(s.username.toLowerCase());

  const candidates = allCandidates
    .filter((u) => !blocked.has(u))
    .filter((u) => !u.endsWith("_bot") && !u.endsWith("bot"))
    .filter((u) => u.length >= 4 && /^[a-z][a-z0-9_]{3,30}$/.test(u))
    .slice(0, 15);

  if (candidates.length === 0) {
    return { skipped: "no new candidates in posts" };
  }

  const metas = await Promise.all(
    candidates.map(async (u) => {
      try {
        const m = await fetchChannelMeta(u);
        if (!m.title && !m.subscribers) return null;
        return { username: u, title: m.title, description: m.description, subscribers: m.subscribers };
      } catch {
        return null;
      }
    })
  );
  const liveCandidates = metas.filter((x): x is NonNullable<typeof x> => !!x);
  if (liveCandidates.length === 0) return { skipped: "no live candidates" };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

  const ctxLines: string[] = [];
  ctxLines.push(`Мой канал: @${project.channel_username}`);
  ctxLines.push(`Название: ${meta.title || project.channel_title || project.title}`);
  if (meta.description) ctxLines.push(`Описание: ${meta.description.slice(0, 400)}`);
  ctxLines.push(`Подписчики: ${meta.subscribers ?? "?"}`);
  ctxLines.push("");
  ctxLines.push("Кандидаты:");
  liveCandidates.forEach((c) => {
    ctxLines.push(
      `@${c.username} | ${c.title ?? "?"} | подписчиков: ${c.subscribers ?? "?"} | ${(c.description ?? "").slice(0, 200)}`
    );
  });

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: SCOUT_MODEL,
    max_tokens: 1024,
    system: buildAgentSystem("milena", SCOUT_TASK),
    messages: [{ role: "user", content: ctxLines.join("\n") }],
  });

  const cost = await recordSpend({
    projectId,
    agentRole: "scout",
    model: SCOUT_MODEL,
    usage: res.usage as any,
    tgId: project.tg_id,
  });

  const raw = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  const parsed = safeJson<{ results: { username: string; score: number; reason: string }[] }>(raw);
  const results = parsed?.results ?? [];

  const upserts: any[] = [];
  for (const r of results) {
    const cand = liveCandidates.find((c) => c.username.toLowerCase() === r.username.toLowerCase());
    if (!cand) continue;
    if (typeof r.score !== "number" || r.score < 6) continue;
    upserts.push({
      project_id: projectId,
      username: cand.username,
      title: cand.title,
      description: cand.description,
      subscribers: cand.subscribers,
      relevance_score: Math.round(r.score),
      reason: r.reason?.slice(0, 300) ?? null,
      status: "pending",
      fetched_at: new Date().toISOString(),
    });
  }

  if (upserts.length > 0) {
    await sb.from("scout_suggestions").upsert(upserts, { onConflict: "project_id,username" });
  }

  await sb
    .from("project_agents")
    .update({ status: "active", last_run_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("role", "scout");

  const diagnostics = {
    candidates_total: candidates.length,
    candidates_alive: liveCandidates.length,
    haiku_scored: results.length,
    saved_pending: upserts.length,
    low_score_rejected: results.filter((r) => typeof r.score === "number" && r.score < 6).map((r) => ({ username: r.username, score: r.score })),
  };

  return { found: upserts.length, cost, suggestions: upserts, diagnostics };
}
