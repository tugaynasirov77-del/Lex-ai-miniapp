import { NextRequest } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyInitData } from "../../../lib/verifyTelegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Лента событий по всем проектам пользователя для главного экрана.
 *
 * Виды событий (поле type):
 *   pending_draft   — черновик ждёт твоего одобрения
 *   approved_soon   — одобренный пост уйдёт по расписанию
 *   published       — пост вышел в канал
 *   publish_failed  — попытки публикации провалились
 *   new_competitors — Милена нашла кандидатов
 *   channel_growth  — резкий прирост/падение подписчиков
 *
 * Сортировка: critical→pending→approved→published; внутри по времени desc.
 */

type EventKind =
  | "pending_draft"
  | "approved_soon"
  | "published"
  | "publish_failed"
  | "new_competitors"
  | "channel_growth";

type InboxEvent = {
  id: string;
  type: EventKind;
  project_id: string;
  project_title: string;
  channel_username: string | null;
  title: string;
  subtitle: string;
  at: string; // ISO для сортировки
  priority: number; // 0 = top, выше = ниже
  payload?: Record<string, any>;
};

const PRIORITY: Record<EventKind, number> = {
  publish_failed: 0,
  pending_draft: 1,
  new_competitors: 2,
  channel_growth: 3,
  approved_soon: 4,
  published: 5,
};

export async function GET(req: NextRequest) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });
  const tgId = v.user.id;

  const sb = getSupabase();
  const { data: projects } = await sb
    .from("projects")
    .select("id,title,channel_title,channel_username")
    .eq("tg_id", tgId);

  if (!projects || projects.length === 0) {
    return Response.json({ events: [], projects_count: 0 });
  }

  const ids = projects.map((p) => p.id);
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: pending }, { data: approved }, { data: published }, { data: failed }, { data: scoutNew }, { data: snaps }] = await Promise.all([
    sb.from("content_drafts").select("id,project_id,body,created_at,plan_id,plan_day,poll_data,photo_url,title_variants,editor_score,editor_comments,needs_review").eq("status", "pending").in("project_id", ids).order("created_at", { ascending: false }).limit(30),
    sb.from("content_drafts").select("id,project_id,body,scheduled_at,plan_id,plan_day,poll_data,photo_url,title_variants,editor_score,editor_comments,needs_review").eq("status", "approved").is("published_message_id", null).in("project_id", ids).order("scheduled_at", { ascending: true }).limit(20),
    sb.from("content_drafts").select("id,project_id,published_at,published_message_id,chosen_title,body,poll_data").not("published_message_id", "is", null).gte("published_at", dayAgo).in("project_id", ids).order("published_at", { ascending: false }).limit(15),
    sb.from("content_drafts").select("id,project_id,publish_error,publish_attempts,scheduled_at,body").gte("publish_attempts", 1).not("publish_error", "is", null).is("published_message_id", null).in("project_id", ids).limit(10),
    sb.from("scout_suggestions").select("project_id,username,title,relevance_score,fetched_at").eq("status", "pending").gte("fetched_at", weekAgo).in("project_id", ids).order("relevance_score", { ascending: false }).limit(15),
    sb.from("channel_snapshots").select("project_id,subscribers,snapshot_at").in("project_id", ids).gte("snapshot_at", weekAgo).order("snapshot_at", { ascending: false }),
  ]);

  const events: InboxEvent[] = [];

  // pending_draft
  for (const d of pending ?? []) {
    const p = projectMap.get(d.project_id);
    if (!p) continue;
    const isPoll = !!d.poll_data;
    events.push({
      id: `pending_${d.id}`,
      type: "pending_draft",
      project_id: d.project_id,
      project_title: p.channel_title || p.title,
      channel_username: p.channel_username,
      title: isPoll ? "Опрос ждёт одобрения" : "Черновик ждёт одобрения",
      subtitle: previewText(d.body, isPoll),
      at: d.created_at,
      priority: PRIORITY.pending_draft,
      payload: {
        draft_id: d.id,
        plan_id: d.plan_id,
        plan_day: d.plan_day,
        body: d.body,
        photo_url: d.photo_url,
        poll_data: d.poll_data,
        title: (d.title_variants as string[] | null)?.[0] ?? null,
        editor_score: (d as any).editor_score ?? null,
        editor_comments: (d as any).editor_comments ?? null,
        needs_review: (d as any).needs_review ?? false,
      },
    });
  }

  // approved_soon: ВСЕ одобренные, ещё не опубликованные (без 72-часового лимита).
  // Раньше посты, запланированные дальше чем через 3 дня, "терялись" — теперь
  // они остаются видны во вкладке История и их можно удалить.
  for (const d of approved ?? []) {
    const p = projectMap.get(d.project_id);
    if (!p) continue;
    events.push({
      id: `approved_${d.id}`,
      type: "approved_soon",
      project_id: d.project_id,
      project_title: p.channel_title || p.title,
      channel_username: p.channel_username,
      title: d.poll_data ? "Опрос в работе" : "Пост в работе",
      subtitle: previewText(d.body, !!d.poll_data),
      at: d.scheduled_at ?? new Date().toISOString(),
      priority: PRIORITY.approved_soon,
      payload: {
        draft_id: d.id,
        plan_id: d.plan_id,
        plan_day: d.plan_day,
        body: d.body,
        photo_url: d.photo_url,
        poll_data: d.poll_data,
        title: (d.title_variants as string[] | null)?.[0] ?? null,
        editor_score: (d as any).editor_score ?? null,
        editor_comments: (d as any).editor_comments ?? null,
        needs_review: (d as any).needs_review ?? false,
      },
    });
  }

  // published за 24ч
  for (const d of published ?? []) {
    const p = projectMap.get(d.project_id);
    if (!p) continue;
    events.push({
      id: `published_${d.id}`,
      type: "published",
      project_id: d.project_id,
      project_title: p.channel_title || p.title,
      channel_username: p.channel_username,
      title: d.poll_data ? "Опрос вышел" : "Пост вышел",
      subtitle: d.chosen_title || previewText(d.body, !!d.poll_data),
      at: d.published_at!,
      priority: PRIORITY.published,
      payload: { message_id: d.published_message_id },
    });
  }

  // publish_failed
  for (const d of failed ?? []) {
    const p = projectMap.get(d.project_id);
    if (!p) continue;
    events.push({
      id: `failed_${d.id}`,
      type: "publish_failed",
      project_id: d.project_id,
      project_title: p.channel_title || p.title,
      channel_username: p.channel_username,
      title: "Ошибка публикации",
      subtitle: (d.publish_error || "").slice(0, 140),
      at: d.scheduled_at || new Date().toISOString(),
      priority: PRIORITY.publish_failed,
      payload: { draft_id: d.id, attempts: d.publish_attempts },
    });
  }

  // new_competitors (группируем по проекту)
  const scoutByProj = new Map<string, typeof scoutNew>();
  for (const s of scoutNew ?? []) {
    if (!scoutByProj.has(s.project_id)) scoutByProj.set(s.project_id, []);
    scoutByProj.get(s.project_id)!.push(s);
  }
  for (const [pid, arr] of scoutByProj.entries()) {
    const p = projectMap.get(pid);
    if (!p || !arr || arr.length === 0) continue;
    const top = arr.slice(0, 3);
    events.push({
      id: `scout_${pid}`,
      type: "new_competitors",
      project_id: pid,
      project_title: p.channel_title || p.title,
      channel_username: p.channel_username,
      title: `Найдено ${arr.length} ${plural(arr.length, "конкурент", "конкурента", "конкурентов")}`,
      subtitle: top.map((s) => `@${s.username} (${s.relevance_score}/10)`).join(", "),
      at: top[0].fetched_at,
      priority: PRIORITY.new_competitors,
      payload: { count: arr.length },
    });
  }

  // channel_growth: сравниваем последний снапшот с тем что 24ч назад в том же проекте
  const snapByProj = new Map<string, { subscribers: number; snapshot_at: string }[]>();
  for (const s of snaps ?? []) {
    if (!snapByProj.has(s.project_id)) snapByProj.set(s.project_id, []);
    snapByProj.get(s.project_id)!.push(s);
  }
  for (const [pid, arr] of snapByProj.entries()) {
    if (arr.length < 2) continue;
    const p = projectMap.get(pid);
    if (!p) continue;
    const latest = arr[0];
    // ищем снапшот ~24ч назад
    const target = arr.find((s) => new Date(s.snapshot_at).getTime() <= Date.now() - 22 * 60 * 60 * 1000);
    if (!target) continue;
    const delta = latest.subscribers - target.subscribers;
    if (latest.subscribers === 0) continue;
    const pct = (delta / latest.subscribers) * 100;
    // Триггер только если рост > 0.5% или падение > 0.3%
    if (Math.abs(pct) < 0.3) continue;
    const isGrowth = delta > 0;
    events.push({
      id: `growth_${pid}`,
      type: "channel_growth",
      project_id: pid,
      project_title: p.channel_title || p.title,
      channel_username: p.channel_username,
      title: isGrowth ? `+${delta} ${plural(delta, "подписчик", "подписчика", "подписчиков")} за сутки` : `${delta} ${plural(Math.abs(delta), "подписчик", "подписчика", "подписчиков")} за сутки`,
      subtitle: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% к базе ${latest.subscribers}`,
      at: latest.snapshot_at,
      priority: PRIORITY.channel_growth,
      payload: { delta, pct, total: latest.subscribers },
    });
  }

  events.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return new Date(b.at).getTime() - new Date(a.at).getTime();
  });

  return Response.json({
    events: events.slice(0, 50),
    projects_count: projects.length,
  });
}

function previewText(body: string | null | undefined, isPoll: boolean): string {
  if (!body) return "";
  // вырезаем HTML-теги для превью
  const plain = body.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const limit = isPoll ? 120 : 140;
  return plain.length > limit ? plain.slice(0, limit) + "…" : plain;
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
