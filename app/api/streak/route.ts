import { NextRequest } from "next/server";
import { verifyInitData } from "../../../lib/verifyTelegram";
import { getSupabase } from "../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/streak — серия дней с ПОЛЕЗНЫМ действием (бриф раздел 21).
 *
 * «Активный день» — день, когда юзер реально создавал/двигал контент,
 * а НЕ просто открыл приложение. Источники (объединяем):
 *   1. analytics_events с полезными событиями (предпочтительно, точнее):
 *      script_saved, script_added_to_plan, content_status_changed,
 *      content_marked_published, project_created.
 *   2. content_drafts (status != rejected) по проектам юзера — created_at
 *      и updated_at. Сохраняет историю до появления analytics_events.
 *
 * current = подряд идущие активные дни, заканчивающиеся сегодня ИЛИ вчера.
 * longest = максимальная серия за окно 90 дней.
 */
const USEFUL_EVENTS = [
  "script_saved",
  "script_added_to_plan",
  "content_status_changed",
  "content_marked_published",
  "project_created",
];

export async function GET(req: NextRequest) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user)
    return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });

  const tgId = v.user.id;
  const sb = getSupabase();

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Уникальные активные дни в МСК (yyyy-mm-dd)
  const days = new Set<string>();
  const addDay = (iso?: string | null) => {
    if (!iso) return;
    const t = new Date(iso).getTime();
    if (isNaN(t)) return;
    const msk = new Date(t + 3 * 3600 * 1000);
    days.add(
      `${msk.getUTCFullYear()}-${String(msk.getUTCMonth() + 1).padStart(2, "0")}-${String(msk.getUTCDate()).padStart(2, "0")}`,
    );
  };

  // 1. Полезные продуктовые события
  const { data: events } = await sb
    .from("analytics_events")
    .select("created_at")
    .eq("tg_id", tgId)
    .in("event", USEFUL_EVENTS)
    .gte("created_at", since);
  for (const e of events || []) addDay((e as any).created_at);

  // 2. content_drafts (не rejected) по проектам юзера — created_at + updated_at
  const { data: projs } = await sb
    .from("projects")
    .select("id")
    .eq("tg_id", tgId);
  const projectIds = (projs || []).map((p: any) => p.id);
  if (projectIds.length > 0) {
    const { data: drafts } = await sb
      .from("content_drafts")
      .select("created_at,updated_at")
      .in("project_id", projectIds)
      .neq("status", "rejected")
      .gte("updated_at", since);
    for (const d of drafts || []) {
      addDay((d as any).created_at);
      addDay((d as any).updated_at);
    }
  }

  if (days.size === 0) {
    return Response.json({ current: 0, longest: 0, today: false });
  }

  const dayKey = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  const nowMsk = new Date(Date.now() + 3 * 3600 * 1000);
  const todayKey = dayKey(nowMsk);
  const yesterdayMsk = new Date(nowMsk.getTime() - 86400000);
  const yesterdayKey = dayKey(yesterdayMsk);

  const hasToday = days.has(todayKey);
  const hasYesterday = days.has(yesterdayKey);

  let current = 0;
  if (hasToday || hasYesterday) {
    // Старт с сегодня или вчера, идём назад
    let cursor = new Date(hasToday ? nowMsk.getTime() : yesterdayMsk.getTime());
    while (days.has(dayKey(cursor))) {
      current++;
      cursor = new Date(cursor.getTime() - 86400000);
    }
  }

  // Longest: проходим все дни в окне
  const sorted = Array.from(days).sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of sorted) {
    if (prev) {
      const a = new Date(prev + "T00:00:00Z").getTime();
      const b = new Date(k + "T00:00:00Z").getTime();
      run = b - a === 86400000 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = k;
  }

  return Response.json({ current, longest, today: hasToday });
}
