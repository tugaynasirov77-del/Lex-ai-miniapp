import { getSupabase } from "../../../../lib/supabase";
import {
  renderReminder,
  type ReminderTrigger,
} from "../../../../lib/reminderTexts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Триггерные напоминания. Запускается ежечасно через /api/cron/tick.
 *
 * Логика на юзера:
 *   1. Загружаем user_prefs.frequency (off → skip)
 *   2. Считаем самый приоритетный триггер:
 *        draft_unfinished > streak_kept|streak_broken > after_publish > inactive_2d
 *   3. Если триггер есть и rate-limit ок → шлём, обновляем last_reminder_sent_at
 *
 * Rate-limit зависит от frequency:
 *   daily   — 1 msg / 22ч
 *   medium  — 1 msg / 48ч (≈ 3 раза в неделю)
 *   rare    — 1 msg / 96ч AND только inactive_2d или draft_unfinished
 *   off     — никогда
 *
 * Окно тишины: 22:00–08:00 МСК (не будим юзеров ночью).
 *
 * Дебаг: ?force=1 игнорирует тишину/rate-limit. ?only=<tg_id> — только один.
 *        ?dry=1 — показать что бы отправилось.
 */

const APP_URL = "https://lex-ai-miniapp.vercel.app";

function authOk(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const x =
    req.headers.get("x-cron-secret") ||
    new URL(req.url).searchParams.get("secret");
  return x === secret;
}

function mskHour(): number {
  return (new Date().getUTCHours() + 3) % 24;
}

function dayOfYear(): number {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  return Math.floor((now.getTime() - start) / 86400000);
}

type Frequency = "daily" | "medium" | "rare" | "off";

const FREQ_COOLDOWN_HOURS: Record<Frequency, number> = {
  daily: 22,
  medium: 48,
  rare: 96,
  off: 0,
};

// Какие триггеры разрешены для rare-режима
const RARE_ALLOWED: ReminderTrigger[] = ["draft_unfinished", "inactive_2d"];

function withinQuietHours(): boolean {
  const h = mskHour();
  return h < 8 || h >= 22;
}

type UserState = {
  tg_id: number;
  projectIds: string[];
  freq: Frequency;
  lastReminderAt: number | null;
  lastDraftAt: number | null; // ms
  lastDraftPendingId: string | null; // незавершённый > 12ч
  lastPublishedAt: number | null;
  streakDays: number; // подряд идущих дней с драфтом, заканчивающихся сегодня/вчера
  streakActiveToday: boolean;
};

function dayKeyMsk(d: Date): string {
  const m = new Date(d.getTime() + 3 * 3600 * 1000);
  return `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}-${String(m.getUTCDate()).padStart(2, "0")}`;
}

function computeStreak(dates: Set<string>): { len: number; today: boolean } {
  if (dates.size === 0) return { len: 0, today: false };
  const now = new Date(Date.now() + 3 * 3600 * 1000);
  const todayKey = dayKeyMsk(new Date());
  const yesterdayMs = new Date(now.getTime() - 86400000);
  const yKey = dayKeyMsk(new Date(yesterdayMs.getTime() - 3 * 3600 * 1000));
  const hasToday = dates.has(todayKey);
  if (!hasToday && !dates.has(yKey)) return { len: 0, today: false };
  let cur = new Date(hasToday ? now.getTime() : yesterdayMs.getTime());
  let len = 0;
  while (dates.has(dayKeyMsk(new Date(cur.getTime() - 3 * 3600 * 1000)))) {
    len++;
    cur = new Date(cur.getTime() - 86400000);
  }
  return { len, today: hasToday };
}

function pickTrigger(s: UserState): ReminderTrigger | null {
  const now = Date.now();

  // 1. Незавершённый черновик 12ч+
  if (s.lastDraftPendingId) return "draft_unfinished";

  // 2. Стрик: если ≥3, не закрыт сегодня — streak_kept; если был и прервался ~1 день назад — streak_broken
  if (s.streakDays >= 3 && !s.streakActiveToday) return "streak_kept";

  // 3. После публикации: 22-26ч назад
  if (s.lastPublishedAt) {
    const ago = now - s.lastPublishedAt;
    if (ago >= 22 * 3600 * 1000 && ago <= 26 * 3600 * 1000) return "after_publish";
  }

  // 4. Неактивность 2+ дня
  if (!s.lastDraftAt || now - s.lastDraftAt > 48 * 3600 * 1000) return "inactive_2d";

  return null;
}

function ctaForTrigger(trigger: ReminderTrigger): string {
  switch (trigger) {
    case "draft_unfinished":
      return "📝 Открыть черновик";
    case "after_publish":
      return "🚀 Сделать следующий";
    case "streak_kept":
      return "🔥 Не прерывать серию";
    case "streak_broken":
      return "✨ Начать заново";
    case "inactive_2d":
    default:
      return "🚀 Открыть LEX AI";
  }
}

function buildKeyboard(trigger: ReminderTrigger) {
  return {
    inline_keyboard: [
      [{ text: ctaForTrigger(trigger), web_app: { url: APP_URL } }],
      [{ text: "🔕 Отключить напоминания", callback_data: "reminders:off" }],
    ],
  };
}

async function tgSend(token: string, chatId: number, text: string, kb: any) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: kb,
      }),
    });
    const j = await r.json();
    if (j.ok) return { ok: true } as const;
    return { ok: false, err: j.description || `HTTP ${r.status}` } as const;
  } catch (e: any) {
    return { ok: false, err: e?.message || "fetch failed" } as const;
  }
}

export async function GET(req: Request) {
  if (!authOk(req)) return new Response("forbidden", { status: 403 });

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const dry = url.searchParams.get("dry") === "1";
  const only = url.searchParams.get("only");
  const onlyId = only ? Number(only) : null;

  if (!force && withinQuietHours()) {
    return Response.json({ skipped: "quiet hours", hour_msk: mskHour() });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token && !dry)
    return Response.json({ error: "TELEGRAM_BOT_TOKEN missing" }, { status: 500 });

  const sb = getSupabase();

  // Все юзеры с проектами
  const { data: projs, error } = await sb
    .from("projects")
    .select("id,tg_id")
    .not("tg_id", "is", null);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const userProjectIds = new Map<number, string[]>();
  for (const r of projs || []) {
    const tg = Number((r as any).tg_id);
    if (!Number.isFinite(tg)) continue;
    if (onlyId && tg !== onlyId) continue;
    const list = userProjectIds.get(tg) || [];
    list.push((r as any).id);
    userProjectIds.set(tg, list);
  }

  const tgIds = Array.from(userProjectIds.keys());
  if (tgIds.length === 0) return Response.json({ candidates: 0 });

  // user_prefs
  const { data: prefs } = await sb
    .from("user_prefs")
    .select("tg_id,reminder_frequency,last_reminder_sent_at")
    .in("tg_id", tgIds);
  const prefMap = new Map<number, { freq: Frequency; lastAt: number | null }>();
  for (const p of prefs || []) {
    prefMap.set(Number((p as any).tg_id), {
      freq: (p as any).reminder_frequency as Frequency,
      lastAt: (p as any).last_reminder_sent_at
        ? new Date((p as any).last_reminder_sent_at).getTime()
        : null,
    });
  }

  // Драфты за 60 дней (для стрика, последнего поста, незавершённого)
  const since60 = new Date(Date.now() - 60 * 86400000).toISOString();
  const allProjIds = Array.from(new Set(Array.from(userProjectIds.values()).flat()));
  const { data: drafts } = await sb
    .from("content_drafts")
    .select("id,project_id,status,created_at,updated_at")
    .in("project_id", allProjIds)
    .gte("created_at", since60)
    .order("created_at", { ascending: false });

  // Реверс-индекс project → tg_id
  const proj2tg = new Map<string, number>();
  for (const [tg, ids] of userProjectIds) for (const id of ids) proj2tg.set(id, tg);

  // Группируем драфты по юзеру
  type DraftRow = { id: string; project_id: string; status: string; created_at: string; updated_at: string | null };
  const byUser = new Map<number, DraftRow[]>();
  for (const d of (drafts || []) as DraftRow[]) {
    const tg = proj2tg.get(d.project_id);
    if (!tg) continue;
    const list = byUser.get(tg) || [];
    list.push(d);
    byUser.set(tg, list);
  }

  const now = Date.now();
  const targets: { tg_id: number; trigger: ReminderTrigger; text: string; freq: Frequency }[] = [];
  const skips: Record<string, number> = {};

  for (const tg of tgIds) {
    const pref = prefMap.get(tg);
    const freq: Frequency = pref?.freq ?? "medium";
    if (freq === "off") {
      skips.off = (skips.off || 0) + 1;
      continue;
    }
    // Rate-limit
    if (!force && pref?.lastAt) {
      const cooldown = FREQ_COOLDOWN_HOURS[freq] * 3600 * 1000;
      if (now - pref.lastAt < cooldown) {
        skips.cooldown = (skips.cooldown || 0) + 1;
        continue;
      }
    }

    const userDrafts = byUser.get(tg) || [];

    // Вычисляем состояние
    const lastDraftAt = userDrafts.length > 0 ? new Date(userDrafts[0].created_at).getTime() : null;
    // Последний "pending" старше 12ч и моложе 7 дней — незавершённый
    let lastDraftPendingId: string | null = null;
    for (const d of userDrafts) {
      if (d.status !== "pending") continue;
      const age = now - new Date(d.created_at).getTime();
      if (age > 12 * 3600 * 1000 && age < 7 * 86400000) {
        lastDraftPendingId = d.id;
        break;
      }
    }
    // Последняя публикация
    let lastPublishedAt: number | null = null;
    for (const d of userDrafts) {
      if (d.status === "published") {
        lastPublishedAt = new Date(d.updated_at || d.created_at).getTime();
        break;
      }
    }
    // Стрик по дням МСК (любой драфт идёт в зачёт)
    const dates = new Set<string>();
    for (const d of userDrafts) dates.add(dayKeyMsk(new Date(d.created_at)));
    const { len: streakDays, today: streakActiveToday } = computeStreak(dates);

    const state: UserState = {
      tg_id: tg,
      projectIds: userProjectIds.get(tg) || [],
      freq,
      lastReminderAt: pref?.lastAt ?? null,
      lastDraftAt,
      lastDraftPendingId,
      lastPublishedAt,
      streakDays,
      streakActiveToday,
    };

    const trigger = pickTrigger(state);
    if (!trigger) {
      skips.no_trigger = (skips.no_trigger || 0) + 1;
      continue;
    }
    // rare-режим разрешает только подмножество триггеров
    if (freq === "rare" && !RARE_ALLOWED.includes(trigger)) {
      skips.rare_filter = (skips.rare_filter || 0) + 1;
      continue;
    }

    const text = renderReminder(trigger, { N: streakDays }, dayOfYear());
    targets.push({ tg_id: tg, trigger, text, freq });
  }

  if (dry) {
    return Response.json({
      dry: true,
      candidates: tgIds.length,
      targets: targets.length,
      skips,
      sample: targets.slice(0, 8).map((t) => ({
        tg_id: t.tg_id,
        trigger: t.trigger,
        freq: t.freq,
        text: t.text,
      })),
    });
  }

  let sent = 0;
  let blocked = 0;
  let failed = 0;
  const errors: { tg_id: number; err: string }[] = [];
  const successTgIds: { tg_id: number; trigger: ReminderTrigger }[] = [];

  for (const { tg_id, trigger, text } of targets) {
    const kb = buildKeyboard(trigger);
    const r = await tgSend(token!, tg_id, text, kb);
    if (r.ok) {
      sent++;
      successTgIds.push({ tg_id, trigger });
    } else {
      if (/forbidden|blocked|deactivated|chat not found/i.test(r.err || "")) blocked++;
      else {
        failed++;
        if (errors.length < 20) errors.push({ tg_id, err: r.err || "" });
      }
    }
    await new Promise((res) => setTimeout(res, 50));
  }

  // Upsert user_prefs.last_reminder_sent_at для отправленных
  if (successTgIds.length > 0) {
    const rows = successTgIds.map((s) => ({
      tg_id: s.tg_id,
      last_reminder_sent_at: new Date().toISOString(),
      last_reminder_trigger: s.trigger,
      updated_at: new Date().toISOString(),
    }));
    await sb.from("user_prefs").upsert(rows, { onConflict: "tg_id" });
  }

  return Response.json({
    candidates: tgIds.length,
    targets: targets.length,
    sent,
    blocked,
    failed,
    skips,
    errors,
  });
}
