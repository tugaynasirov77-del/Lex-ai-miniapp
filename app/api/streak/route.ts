import { NextRequest } from "next/server";
import { verifyInitData } from "../../../lib/verifyTelegram";
import { getSupabase } from "../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/streak — текущая и максимальная серия дней с ≥1 контентом.
 *
 * Логика (Duolingo-style):
 *   - Берём content_drafts за последние 90 дней по всем проектам юзера.
 *   - Группируем по дате (МСК).
 *   - current = подряд идущие дни, заканчивающиеся сегодня ИЛИ вчера (grace).
 *     Если ни сегодня, ни вчера нет — current = 0.
 *   - longest = максимальная серия за окно.
 */
export async function GET(req: NextRequest) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user)
    return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });

  const tgId = v.user.id;
  const sb = getSupabase();

  // Все проекты юзера
  const { data: projs } = await sb
    .from("projects")
    .select("id")
    .eq("tg_id", tgId);
  const projectIds = (projs || []).map((p: any) => p.id);
  if (projectIds.length === 0) {
    return Response.json({ current: 0, longest: 0, today: false });
  }

  // Драфты за 90 дней
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: drafts } = await sb
    .from("content_drafts")
    .select("created_at")
    .in("project_id", projectIds)
    .gte("created_at", since);

  // Уникальные дни в МСК (yyyy-mm-dd)
  const days = new Set<string>();
  for (const d of drafts || []) {
    const t = new Date((d as any).created_at).getTime();
    const msk = new Date(t + 3 * 3600 * 1000);
    const key = `${msk.getUTCFullYear()}-${String(msk.getUTCMonth() + 1).padStart(2, "0")}-${String(msk.getUTCDate()).padStart(2, "0")}`;
    days.add(key);
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
