import { getSupabase } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Утренний дайджест юзерам в 9:00 МСК.
 *
 * Триггерится через /api/cron/tick (UptimeRobot каждые 15 мин) →
 * самогейт на час МСК = 9. Анти-дубль через projects.last_digest_sent_at
 * (skip если отправлено < 20ч назад).
 *
 * Текст универсальный, без зависимости от playbook. Две ветки:
 *   active   (вчера ≥1 драфт) — спокойное «продолжаем»
 *   inactive (вчера 0)        — мягкий пинок без снисхождения
 * + спец пн/пт.
 *
 * Force-режим (для теста): ?force=1 — игнорирует час МСК.
 *                          ?only=<tg_id> — отправить только этому юзеру.
 *                          ?dry=1 — посчитать получателей без отправки.
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

function pluralMaterials(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "материал";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "материала";
  return "материалов";
}

// ----- Шаблоны -----

const TEMPLATES_ACTIVE: Array<(n: number) => string> = [
  (n) => `☀️ <b>С добрым утром!</b>\n\nВчера ты сделал ${n} ${pluralMaterials(n)} — кайф. Готов на ещё один?`,
  (n) => `☕ <b>Доброе утро!</b>\n\nВижу, вчера было ${n} ${pluralMaterials(n)}. Ты в форме — давай ещё.`,
  (n) => `🌞 <b>Привет!</b>\n\n${n} ${pluralMaterials(n)} за вчера — сильно. Идём дальше?`,
  (n) => `☀️ <b>Доброе утро!</b>\n\nВчера ${n}. Сегодня сделаем один — и будет уже привычка.`,
  () => `☕ <b>С добрым утром!</b>\n\nТы вчера был в потоке — продолжим сегодня?`,
  (n) => `🌞 <b>Доброе утро!</b>\n\nХороший вчерашний день: ${n} ${pluralMaterials(n)}. Не теряем настрой?`,
];

const TEMPLATES_INACTIVE: Array<() => string> = [
  () => `☀️ <b>Доброе утро!</b>\n\nЕсли есть 5 минут — давай сделаем один пост. Я всё подготовил.`,
  () => `☕ <b>С добрым утром!</b>\n\nОдин пост сегодня — и ты возвращаешься в игру.`,
  () => `🌞 <b>Привет!</b>\n\nЛента ждёт. Идём?`,
  () => `☀️ <b>Доброе утро!</b>\n\nДавай сделаем пост — это правда быстро. Я уже всё подобрал.`,
  () => `☕ <b>Привет!</b>\n\nОдин маленький пост сегодня — и день уже не зря.`,
  () => `🌞 <b>Доброе утро!</b>\n\nГотов попробовать? Без давления, без идеальности — просто пост.`,
  () => `☀️ <b>Привет!</b>\n\nКак настрой? Если есть силы — один пост, и я помогу.`,
];

const TEMPLATE_MONDAY_ACTIVE = (n: number) =>
  `🚀 <b>С понедельником!</b>\n\nЗа вчера ${n} ${pluralMaterials(n)} — топ. Ставим тон на новую неделю?`;

const TEMPLATE_MONDAY_INACTIVE = () =>
  `🚀 <b>С понедельником!</b>\n\nОдин пост сегодня — и неделя пойдёт правильно.`;

const TEMPLATE_FRIDAY_ACTIVE = (n: number) =>
  `🎉 <b>Пятница!</b>\n\nВчера ${n} — неделя в плюсе. Закроем красиво?`;

const TEMPLATE_FRIDAY_INACTIVE = () =>
  `🎉 <b>Пятница!</b>\n\nОдин пост — и выходные с чистой совестью.`;

function formatMessage(yesterdayCount: number): string {
  const mskNow = new Date(Date.now() + 3 * 3600 * 1000);
  const weekday = mskNow.getUTCDay(); // 0=вс
  const active = yesterdayCount > 0;
  const doy = dayOfYear();

  if (weekday === 1) {
    return active ? TEMPLATE_MONDAY_ACTIVE(yesterdayCount) : TEMPLATE_MONDAY_INACTIVE();
  }
  if (weekday === 5) {
    return active ? TEMPLATE_FRIDAY_ACTIVE(yesterdayCount) : TEMPLATE_FRIDAY_INACTIVE();
  }
  if (active) {
    return TEMPLATES_ACTIVE[doy % TEMPLATES_ACTIVE.length](yesterdayCount);
  }
  return TEMPLATES_INACTIVE[doy % TEMPLATES_INACTIVE.length]();
}

function buildKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🚀 Открыть LEX AI", web_app: { url: APP_URL } }],
    ],
  };
}

async function tgSend(
  token: string,
  chatId: number,
  text: string,
): Promise<{ ok: boolean; err?: string }> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: buildKeyboard(),
      }),
    });
    const j = await r.json();
    if (j.ok) return { ok: true };
    return { ok: false, err: j.description || `HTTP ${r.status}` };
  } catch (e: any) {
    return { ok: false, err: e?.message || "fetch failed" };
  }
}

export async function GET(req: Request) {
  if (!authOk(req)) return new Response("forbidden", { status: 403 });

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const dry = url.searchParams.get("dry") === "1";
  const only = url.searchParams.get("only");
  const onlyId = only ? Number(only) : null;

  if (!force && mskHour() !== 9) {
    return Response.json({ skipped: "not 9 MSK", hour_msk: mskHour() });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token && !dry)
    return Response.json({ error: "TELEGRAM_BOT_TOKEN missing" }, { status: 500 });

  const sb = getSupabase();

  // Все юзеры с хотя бы одним проектом
  const { data: projs, error } = await sb
    .from("projects")
    .select("id,tg_id,last_digest_sent_at")
    .not("tg_id", "is", null);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Группируем по tg_id, собираем все project_id и cutoff для анти-спама
  const cutoff = Date.now() - 20 * 60 * 60 * 1000;
  const userProjectIds = new Map<number, string[]>();
  const recentSent = new Set<number>();
  for (const r of projs || []) {
    const tg = Number((r as any).tg_id);
    if (!Number.isFinite(tg)) continue;
    if (onlyId && tg !== onlyId) continue;
    const list = userProjectIds.get(tg) || [];
    list.push((r as any).id);
    userProjectIds.set(tg, list);
    const ts = (r as any).last_digest_sent_at;
    if (!force && ts && new Date(ts).getTime() > cutoff) recentSent.add(tg);
  }

  // Вчерашние драфты
  const yesterdayFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const draftCountByProject = new Map<string, number>();
  {
    const allProjIds = Array.from(new Set(Array.from(userProjectIds.values()).flat()));
    if (allProjIds.length > 0) {
      const { data: drafts } = await sb
        .from("content_drafts")
        .select("project_id")
        .in("project_id", allProjIds)
        .gte("created_at", yesterdayFrom);
      for (const d of drafts || []) {
        const pid = (d as any).project_id as string;
        draftCountByProject.set(pid, (draftCountByProject.get(pid) || 0) + 1);
      }
    }
  }

  const targets: { tg_id: number; projectIds: string[]; yesterdayCount: number }[] = [];
  for (const [tg, projectIds] of userProjectIds) {
    if (recentSent.has(tg)) continue;
    let count = 0;
    for (const pid of projectIds) count += draftCountByProject.get(pid) || 0;
    targets.push({ tg_id: tg, projectIds, yesterdayCount: count });
  }

  if (dry) {
    const previewActive = formatMessage(3);
    const previewInactive = formatMessage(0);
    return Response.json({
      dry: true,
      candidates: userProjectIds.size,
      ready: targets.length,
      skipped_recent: recentSent.size,
      preview_active: previewActive,
      preview_inactive: previewInactive,
      sample: targets.slice(0, 5).map((t) => ({
        tg_id: t.tg_id,
        yesterday: t.yesterdayCount,
      })),
    });
  }

  let sent = 0;
  let blocked = 0;
  let failed = 0;
  const errors: { tg_id: number; err: string }[] = [];
  const sentProjectIds: string[] = [];

  for (const { tg_id, projectIds, yesterdayCount } of targets) {
    const text = formatMessage(yesterdayCount);
    const r = await tgSend(token!, tg_id, text);
    if (r.ok) {
      sent++;
      sentProjectIds.push(...projectIds);
    } else {
      if (/forbidden|blocked|deactivated|chat not found/i.test(r.err || "")) blocked++;
      else {
        failed++;
        if (errors.length < 20) errors.push({ tg_id, err: r.err || "" });
      }
    }
    await new Promise((res) => setTimeout(res, 50));
  }

  if (sentProjectIds.length > 0) {
    await sb
      .from("projects")
      .update({ last_digest_sent_at: new Date().toISOString() })
      .in("id", sentProjectIds);
  }

  return Response.json({
    candidates: userProjectIds.size,
    targets: targets.length,
    sent,
    blocked,
    failed,
    errors,
  });
}
