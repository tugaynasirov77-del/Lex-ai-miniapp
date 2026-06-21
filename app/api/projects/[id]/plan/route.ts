import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../lib/supabase";
import { verifyInitData } from "../../../../../lib/verifyTelegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authProject(req: NextRequest, projectId: string) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user)
    return { err: Response.json({ error: v.error ?? "unauthorized" }, { status: 401 }) };
  const sb = getSupabase();
  const { data } = await sb
    .from("projects")
    .select("id, title")
    .eq("id", projectId)
    .eq("tg_id", v.user.id)
    .maybeSingle();
  if (!data) return { err: Response.json({ error: "проект не найден" }, { status: 404 }) };
  return { tgId: v.user.id, project: data };
}

/** Понедельник недели по дате (МСК, локальная неделя). YYYY-MM-DD. */
function mondayOf(d: Date): string {
  // d в UTC; считаем по МСК (+3)
  const msk = new Date(d.getTime() + 3 * 3600 * 1000);
  const day = msk.getUTCDay() || 7; // вс=7
  const monday = new Date(msk.getTime() - (day - 1) * 86400000);
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, "0")}-${String(monday.getUTCDate()).padStart(2, "0")}`;
}

function addDays(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

// Статусы, считающиеся «готовым» материалом (для прогресс-бара недели).
const READY_STATUSES = ["ready_to_shoot", "shot", "ready_to_publish", "scheduled"];
const PUBLISHED_STATUSES = ["published"];

/**
 * GET /api/projects/[id]/plan?week_start=YYYY-MM-DD
 *
 * Недельный контент-план. Берёт content_drafts с planned_for_date в пределах
 * недели (пн-вс), группирует по дням, считает сводку.
 *
 * Если week_start не задан — текущая неделя (понедельник по МСК).
 *
 * Ответ:
 * {
 *   project: { id, title },
 *   week_start: "YYYY-MM-DD",
 *   summary: { total, planned, ready, published, progress_pct },
 *   days: [
 *     { date, weekday, items: [{ id, title, content_type, status, planned_for_date }] },
 *     ... 7 дней
 *   ]
 * }
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const param = req.nextUrl.searchParams.get("week_start");
  const weekStart =
    param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : mondayOf(new Date());
  const weekEnd = addDays(weekStart, 6);

  const sb = getSupabase();
  const { data } = await sb
    .from("content_drafts")
    .select("id, chosen_title, body, content_type, status, planned_for_date, source_topic, scenario_data, idea_text, caption, created_at")
    .eq("project_id", id)
    .gte("planned_for_date", weekStart)
    .lte("planned_for_date", weekEnd)
    .neq("status", "rejected")
    .neq("status", "archived")
    .order("planned_for_date", { ascending: true });

  const items = data ?? [];

  // Группировка по дням
  const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const days = WEEKDAYS.map((wd, i) => {
    const date = addDays(weekStart, i);
    const dayItems = items
      .filter((it) => it.planned_for_date === date)
      .map((it) => ({
        id: it.id,
        title:
          (it as any).chosen_title ||
          (it as any).scenario_data?.title ||
          it.source_topic ||
          (it as any).idea_text ||
          ((it as any).body ? String((it as any).body).split("\n")[0].slice(0, 80) : "") ||
          "Без названия",
        content_type: it.content_type,
        status: it.status,
        planned_for_date: it.planned_for_date,
      }));
    return { date, weekday: wd, items: dayItems };
  });

  const total = items.length;
  const ready = items.filter((it) => READY_STATUSES.includes(it.status)).length;
  const published = items.filter((it) => PUBLISHED_STATUSES.includes(it.status)).length;
  const planned = total - ready - published; // idea/draft/scenario_ready

  return Response.json({
    project: { id: a.project.id, title: a.project.title },
    week_start: weekStart,
    week_end: weekEnd,
    summary: {
      total,
      planned: Math.max(0, planned),
      ready,
      published,
      progress_pct: total > 0 ? Math.round(((ready + published) / total) * 100) : 0,
    },
    days,
  });
}
