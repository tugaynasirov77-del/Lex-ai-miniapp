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
 * Логика:
 *   1. Берём все проекты с непустым lex_insights.
 *   2. Группируем по tg_id → один юзер = одно сообщение/день.
 *   3. Для каждого юзера выбираем "primary" проект (свежий insights).
 *   4. Из playbook выбираем ОДНУ идею (ротация по дню года):
 *      IG → ready_hooks → carousel_themes → reel_formats
 *      TG → working_hooks → content_themes
 *   5. Шлём с web_app кнопкой «🚀 Сгенерить» (deep link).
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
  // UTC+3, без DST
  const now = new Date();
  return (now.getUTCHours() + 3) % 24;
}

function dayOfYear(): number {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const diff = now.getTime() - start;
  return Math.floor(diff / 86400000);
}

type Project = {
  id: string;
  tg_id: number;
  title: string | null;
  platform: string | null;
  lex_insights: any;
  lex_insights_updated_at: string | null;
  last_digest_sent_at: string | null;
};

type Idea = { kind: "hook" | "carousel" | "reel" | "theme"; text: string };

function pickIdea(p: Project): Idea | null {
  const ins = p.lex_insights || {};
  const doy = dayOfYear();
  const isIg = (p.platform || "").toLowerCase() === "instagram";

  if (isIg) {
    const hooks: string[] = Array.isArray(ins.ready_hooks) ? ins.ready_hooks : [];
    const carousels: { title: string; structure: string }[] = Array.isArray(
      ins.carousel_themes,
    )
      ? ins.carousel_themes
      : [];
    const reels: { format: string; example: string }[] = Array.isArray(
      ins.reel_formats,
    )
      ? ins.reel_formats
      : [];
    // Чередуем по дню: hooks → carousels → reels
    const cycle = doy % 3;
    if (cycle === 0 && hooks.length > 0) {
      return { kind: "hook", text: hooks[doy % hooks.length] };
    }
    if (cycle === 1 && carousels.length > 0) {
      const c = carousels[doy % carousels.length];
      return { kind: "carousel", text: c.title };
    }
    if (cycle === 2 && reels.length > 0) {
      const r = reels[doy % reels.length];
      return { kind: "reel", text: r.format };
    }
    // fallback
    if (hooks.length > 0) return { kind: "hook", text: hooks[doy % hooks.length] };
    if (carousels.length > 0)
      return { kind: "carousel", text: carousels[doy % carousels.length].title };
    if (reels.length > 0) return { kind: "reel", text: reels[doy % reels.length].format };
  }

  // TG fallback
  const wh: string[] = Array.isArray(ins.working_hooks) ? ins.working_hooks : [];
  const themes: string[] = Array.isArray(ins.content_themes) ? ins.content_themes : [];
  if (wh.length > 0) return { kind: "hook", text: wh[doy % wh.length] };
  if (themes.length > 0) return { kind: "theme", text: themes[doy % themes.length] };
  return null;
}

const KIND_LABEL: Record<Idea["kind"], string> = {
  hook: "хук",
  carousel: "карусель",
  reel: "Reels-формат",
  theme: "тема",
};

const KIND_EMOJI: Record<Idea["kind"], string> = {
  hook: "💡",
  carousel: "🎴",
  reel: "🎬",
  theme: "📌",
};

type Ctx = { project: Project; idea: Idea };

// Каждый шаблон возвращает готовый HTML. Аргумент idea-text уже escaped.
const TEMPLATES: Array<(c: Ctx, ideaHtml: string, projectName: string) => string> = [
  // 0 — Классика
  (c, i, n) =>
    `🌅 <b>Доброе утро!</b>\n\n${KIND_EMOJI[c.idea.kind]} <b>${cap(KIND_LABEL[c.idea.kind])} дня</b> для «${n}»:\n\n<i>${i}</i>\n\nОдин тап — и LEX соберёт пост.`,

  // 1 — Челлендж
  (c, i, n) =>
    `⚡ Слабо запостить до обеда?\n\nВот ${KIND_LABEL[c.idea.kind]} для «${n}»:\n\n<i>${i}</i>\n\n5 минут — и готово.`,

  // 2 — Инсайт
  (c, i) =>
    `🔍 <b>Подсмотрел закономерность</b>\n\nВ твоей нише такие ${pluralKind(c.idea.kind)} стабильно дают охваты. Сегодняшний:\n\n<i>${i}</i>`,

  // 3 — Тренд
  (c, i) =>
    `📈 <b>Что сегодня залетит</b>\n\nЭтот ${KIND_LABEL[c.idea.kind]} попадает в текущий вайб ниши:\n\n<i>${i}</i>\n\nЛови момент.`,

  // 4 — Кофе
  (c, i) =>
    `☕ Пока ты пьёшь кофе, я подобрал тебе ${KIND_LABEL[c.idea.kind]}:\n\n<i>${i}</i>\n\nНе остывай — жми кнопку.`,

  // 5 — Цифра
  (c, i) =>
    `📊 <b>Хочешь лайфхак?</b>\n\nЮзеры с таким ${KIND_LABEL[c.idea.kind]} в среднем получают в 2× больше реакций. Бери:\n\n<i>${i}</i>`,

  // 6 — Дружеский пинок
  (c, i) =>
    `👋 Не выдумывай с нуля сегодня.\n\nГотовый ${KIND_LABEL[c.idea.kind]} уже здесь:\n\n<i>${i}</i>\n\nЖми — соберу за минуту.`,

  // 7 — Интрига
  (c, i, n) =>
    `🎯 <b>Один ${KIND_LABEL[c.idea.kind]}</b>, на который аудитория «${n}» реагирует сильнее всего сегодня:\n\n<i>${i}</i>`,

  // 8 — Время
  (c, i) =>
    `⏱ <b>5 минут до готового поста</b>\n\nИдея:\n\n<i>${i}</i>\n\nЖми и проверь сам.`,

  // 9 — Voice of LEX
  (c, i, n) =>
    `🧠 LEX на связи.\n\nДля «${n}» подобрал ${KIND_LABEL[c.idea.kind]}:\n\n<i>${i}</i>\n\nЕсли заходит — соберу полный пост.`,

  // 10 — Понедельник
  (c, i) =>
    `🚀 <b>Новая неделя — новая серия</b>\n\nСтартуй с этого ${KIND_LABEL[c.idea.kind]}:\n\n<i>${i}</i>\n\nЗадай темп с понедельника.`,

  // 11 — Пятница
  (c, i) =>
    `🎁 <b>Лёгкая победа до выходных</b>\n\nЕщё один ${KIND_LABEL[c.idea.kind]} — и закроешь неделю:\n\n<i>${i}</i>`,
];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pluralKind(k: Idea["kind"]): string {
  return k === "hook"
    ? "хуки"
    : k === "carousel"
    ? "карусели"
    : k === "reel"
    ? "Reels-форматы"
    : "темы";
}

function formatMessage(p: Project, idea: Idea): string {
  const projectName = p.title || "твоего проекта";
  const ideaHtml = `<i>${escapeHtml(idea.text)}</i>`.replace(/<\/?i>/g, ""); // text без обёртки, обёрнем в шаблоне
  const safeIdea = escapeHtml(idea.text);
  const doy = dayOfYear();
  const weekday = new Date().getUTCDay(); // 0=вс ... 6=сб (UTC; +3ч МСК не критично для дня)

  // Спец-шаблоны: пн = 10, пт = 11. Иначе ротация 0..9 по дню года.
  let tpl: number;
  if (weekday === 1) tpl = 10;
  else if (weekday === 5) tpl = 11;
  else tpl = doy % 10;

  void ideaHtml;
  return TEMPLATES[tpl]({ project: p, idea }, safeIdea, projectName);
}

const CTA_TEXTS_POST = ["🚀 Сгенерить пост", "✍️ Написать за 1 тап", "⚡ Готово за минуту", "🎯 Взять идею"];
const CTA_TEXTS_CAROUSEL = ["🎴 Собрать карусель", "🎴 Сделать карусель за минуту", "🎴 Готовая карусель в 1 тап"];
const CTA_TEXTS_REEL = ["🎬 Написать сценарий", "🎬 Готовый сценарий", "🎬 Раскадровка за минуту"];

function pickCta(kind: Idea["kind"]): string {
  const doy = dayOfYear();
  const arr =
    kind === "carousel" ? CTA_TEXTS_CAROUSEL : kind === "reel" ? CTA_TEXTS_REEL : CTA_TEXTS_POST;
  return arr[doy % arr.length];
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildKeyboard(p: Project, idea: Idea) {
  const topic = encodeURIComponent(idea.text.slice(0, 200));
  const kind = idea.kind === "carousel" ? "carousel" : idea.kind === "reel" ? "reel" : "post";
  const url = `${APP_URL}/?p=${p.id}&topic=${topic}&kind=${kind}`;
  const ctaText = pickCta(idea.kind);
  return {
    inline_keyboard: [
      [{ text: ctaText, web_app: { url } }],
      [{ text: "Открыть LEX AI", web_app: { url: APP_URL } }],
    ],
  };
}

async function tgSend(
  token: string,
  chatId: number,
  text: string,
  kb: any,
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
        reply_markup: kb,
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

  // Гейт: только в 9:00 МСК (час == 9), tick пинг каждые 15 мин,
  // поэтому окно — один час раз в день. Анти-дубль через last_digest_sent_at.
  if (!force && mskHour() !== 9) {
    return Response.json({ skipped: "not 9 MSK", hour_msk: mskHour() });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token && !dry)
    return Response.json({ error: "TELEGRAM_BOT_TOKEN missing" }, { status: 500 });

  const sb = getSupabase();
  const { data, error } = await sb
    .from("projects")
    .select(
      "id,tg_id,title,platform,lex_insights,lex_insights_updated_at,last_digest_sent_at",
    )
    .not("lex_insights", "is", null)
    .not("tg_id", "is", null)
    .order("lex_insights_updated_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Группируем по tg_id, оставляем самый свежий проект
  const byUser = new Map<number, Project>();
  for (const r of (data || []) as Project[]) {
    const tg = Number(r.tg_id);
    if (!Number.isFinite(tg)) continue;
    if (onlyId && tg !== onlyId) continue;
    if (!byUser.has(tg)) byUser.set(tg, r);
  }

  // Анти-спам: если у юзера ЛЮБОЙ проект имеет last_digest_sent_at < 20ч,
  // пропускаем (force-флаг это снимает).
  const cutoff = Date.now() - 20 * 60 * 60 * 1000;
  const recentSent = new Set<number>();
  if (!force) {
    for (const r of (data || []) as Project[]) {
      if (!r.last_digest_sent_at) continue;
      const t = new Date(r.last_digest_sent_at).getTime();
      if (t > cutoff) recentSent.add(Number(r.tg_id));
    }
  }

  const targets: { project: Project; idea: Idea }[] = [];
  for (const [tg, p] of byUser) {
    if (recentSent.has(tg)) continue;
    const idea = pickIdea(p);
    if (!idea) continue;
    targets.push({ project: p, idea });
  }

  if (dry) {
    return Response.json({
      dry: true,
      candidates: byUser.size,
      ready: targets.length,
      skipped_recent: recentSent.size,
      sample: targets.slice(0, 5).map((t) => ({
        tg_id: t.project.tg_id,
        kind: t.idea.kind,
        text: t.idea.text.slice(0, 80),
      })),
    });
  }

  let sent = 0;
  let blocked = 0;
  let failed = 0;
  const errors: { tg_id: number; err: string }[] = [];
  const sentProjectIds: string[] = [];

  for (const { project, idea } of targets) {
    const text = formatMessage(project, idea);
    const kb = buildKeyboard(project, idea);
    const r = await tgSend(token!, Number(project.tg_id), text, kb);
    if (r.ok) {
      sent++;
      sentProjectIds.push(project.id);
    } else {
      if (/forbidden|blocked|deactivated|chat not found/i.test(r.err || "")) blocked++;
      else {
        failed++;
        if (errors.length < 20) errors.push({ tg_id: project.tg_id, err: r.err || "" });
      }
    }
    await new Promise((res) => setTimeout(res, 50));
  }

  // Помечаем отправленные проекты
  if (sentProjectIds.length > 0) {
    await sb
      .from("projects")
      .update({ last_digest_sent_at: new Date().toISOString() })
      .in("id", sentProjectIds);
  }

  return Response.json({
    candidates: byUser.size,
    targets: targets.length,
    sent,
    blocked,
    failed,
    errors,
  });
}
