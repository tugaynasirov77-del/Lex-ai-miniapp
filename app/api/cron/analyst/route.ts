import { getSupabase } from "../../../../lib/supabase";
import { getChat, getChatMembersCount } from "../../../../lib/telegramBot";
import { fetchChannelPreview } from "../../../../lib/parseTmePreview";
import { syncCompetitor } from "../../../../lib/scoutSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DIGEST_CHAT_ID = 5825762433;

function authOk(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const x = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  return x === secret;
}

async function tgSend(text: string, chatId: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  }).catch(() => {});
}

type ProjectRow = {
  id: string;
  tg_id: number;
  title: string;
  channel_username: string;
  channel_id: number | null;
};

async function processProject(p: ProjectRow) {
  const sb = getSupabase();
  let subscribers = 0;
  try {
    if (p.channel_id) {
      subscribers = await getChatMembersCount(p.channel_id).catch(() => 0);
    } else {
      const chat = await getChat(p.channel_username);
      subscribers = await getChatMembersCount(chat.id).catch(() => 0);
    }
  } catch {}

  let posts: Awaited<ReturnType<typeof fetchChannelPreview>> = [];
  try {
    posts = await fetchChannelPreview(p.channel_username);
  } catch {}

  if (posts.length > 0) {
    await sb.from("channel_posts").upsert(
      posts.map((post) => ({
        project_id: p.id,
        message_id: post.message_id,
        text: post.text,
        views: post.views,
        has_media: post.has_media,
        published_at: post.published_at,
        fetched_at: new Date().toISOString(),
      })),
      { onConflict: "project_id,message_id" }
    );
  }

  await sb.from("channel_snapshots").insert({
    project_id: p.id,
    subscribers,
    posts_count: posts.length,
  });

  await sb
    .from("projects")
    .update({ channel_subscribers: subscribers, updated_at: new Date().toISOString() })
    .eq("id", p.id);

  await sb
    .from("project_agents")
    .update({ last_run_at: new Date().toISOString(), status: "active" })
    .eq("project_id", p.id)
    .eq("role", "analyst");

  const { data: competitors } = await sb
    .from("competitor_channels")
    .select("username")
    .eq("project_id", p.id);

  let competitorsSynced = 0;
  for (const c of competitors ?? []) {
    try {
      await syncCompetitor(p.id, c.username);
      competitorsSynced++;
    } catch {}
  }

  if ((competitors?.length ?? 0) > 0) {
    await sb
      .from("project_agents")
      .update({ last_run_at: new Date().toISOString(), status: "active" })
      .eq("project_id", p.id)
      .eq("role", "scout");
  }

  return {
    project_id: p.id,
    channel: p.channel_username,
    subscribers,
    posts: posts.length,
    competitors_synced: competitorsSynced,
  };
}

async function sendWeeklyReport(p: ProjectRow) {
  const sb = getSupabase();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: snaps } = await sb
    .from("channel_snapshots")
    .select("subscribers,snapshot_at")
    .eq("project_id", p.id)
    .gte("snapshot_at", fourteenAgo)
    .order("snapshot_at", { ascending: true });

  const week = snaps?.filter((s) => s.snapshot_at >= weekAgo) ?? [];
  const today = week.length > 0 ? week[week.length - 1].subscribers : 0;
  const sevenDaysAgo = week.length > 0 ? week[0].subscribers : today;
  const growthAbs = today - sevenDaysAgo;
  const growthPct = sevenDaysAgo > 0 ? (growthAbs / sevenDaysAgo) * 100 : 0;

  const { data: topPosts } = await sb
    .from("channel_posts")
    .select("text,views,message_id")
    .eq("project_id", p.id)
    .gte("published_at", weekAgo)
    .order("views", { ascending: false, nullsFirst: false })
    .limit(3);

  const lines: string[] = [];
  lines.push(`📊 <b>${p.title}</b> — отчёт за неделю`);
  lines.push(`<a href="https://t.me/${p.channel_username}">@${p.channel_username}</a>`);
  lines.push("");
  lines.push(`<b>Подписчики:</b> ${today.toLocaleString("ru-RU")}`);
  lines.push(
    `<b>Прирост за 7 дней:</b> ${growthAbs >= 0 ? "+" : ""}${growthAbs.toLocaleString("ru-RU")} (${growthPct >= 0 ? "+" : ""}${growthPct.toFixed(2)}%)`
  );
  lines.push("");
  if (topPosts && topPosts.length > 0) {
    lines.push(`<b>Топ-${topPosts.length} постов недели:</b>`);
    for (const post of topPosts) {
      const preview = (post.text || "(без текста)").replace(/\n+/g, " ").slice(0, 80);
      const link = `https://t.me/${p.channel_username}/${post.message_id}`;
      lines.push(`• <a href="${link}">${preview}</a> — 👁 ${(post.views ?? 0).toLocaleString("ru-RU")}`);
    }
  } else {
    lines.push(`<i>За неделю постов не нашлось</i>`);
  }

  await tgSend(lines.join("\n"), DIGEST_CHAT_ID);
}

export async function GET(req: Request) {
  if (!authOk(req)) return new Response("forbidden", { status: 403 });

  const url = new URL(req.url);
  const force = url.searchParams.get("force") || "";
  const mode = url.searchParams.get("mode") || "auto";

  const sb = getSupabase();
  const { data: projects } = await sb
    .from("projects")
    .select("id,tg_id,title,channel_username,channel_id")
    .not("channel_username", "is", null);

  const list = (projects ?? []) as ProjectRow[];
  const dailyResults = [];
  for (const p of list) {
    try {
      dailyResults.push(await processProject(p));
    } catch (e) {
      dailyResults.push({ project_id: p.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const now = new Date();
  const isSunday = now.getUTCDay() === 0;
  const isReportHour = now.getUTCHours() === 15;
  const sendWeekly = mode === "weekly" || force === "weekly" || (mode === "auto" && isSunday && isReportHour);

  if (sendWeekly) {
    for (const p of list) {
      try {
        await sendWeeklyReport(p);
      } catch {}
    }
  }

  return Response.json({
    ok: true,
    processed: dailyResults.length,
    weekly_sent: sendWeekly ? list.length : 0,
    results: dailyResults,
  });
}
