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


// ----- Шаблоны: тёплые, мотивирующие, с учётом активности -----

function pluralMaterials(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "материал";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "материала";
  return "материалов";
}

// Шаблоны для активного юзера (вчера ≥1 драфт).
// Тон: спокойный, партнёрский. Без снисхождения и калек.
const TEMPLATES_ACTIVE: Array<(idea: string, name: string, kind: Idea["kind"], n: number) => string> = [
  (i, _n, k, count) =>
    `☀️ <b>С добрым утром.</b>\n\nВчера в работе было ${count} ${pluralMaterials(count)} — хороший ритм. Сегодня держим:\n\n${KIND_EMOJI[k]} <i>${i}</i>`,

  (i, _n, k, count) =>
    `☀️ <b>Доброе утро.</b>\n\n${count} ${pluralMaterials(count)} за вчера — это уже система, а не случай. Свежая идея:\n\n${KIND_EMOJI[k]} <i>${i}</i>`,

  (i, _n, k) =>
    `☀️ <b>Утро.</b>\n\nТы в потоке — каждый день что-то выходит. Сегодняшняя идея:\n\n${KIND_EMOJI[k]} <i>${i}</i>`,

  (i, _n, k, count) =>
    `☕ <b>Доброе утро.</b>\n\nВчера получилось ${count} — уверенный темп. Не теряем:\n\n${KIND_EMOJI[k]} <i>${i}</i>`,

  (i, _n, k, count) =>
    `🌞 <b>С добрым утром.</b>\n\n+${count} ко вчерашнему — заметно. Продолжаем:\n\n${KIND_EMOJI[k]} <i>${i}</i>`,

  (i, _n, k) =>
    `☀️ <b>Привет.</b>\n\nТы выдерживаешь ритм — это уже половина успеха в контенте. На сегодня:\n\n${KIND_EMOJI[k]} <i>${i}</i>`,
];

// Шаблоны для неактивного юзера (0 драфтов вчера) — без снисхождения,
// без "ты молодец", без "ты справишься"
const TEMPLATES_INACTIVE: Array<(idea: string, name: string, kind: Idea["kind"]) => string> = [
  (i, _n, k) =>
    `☀️ <b>Доброе утро.</b>\n\nДень начинается лучше с одного небольшого дела. Готовая идея:\n\n${KIND_EMOJI[k]} <i>${i}</i>`,

  (i, _n, k) =>
    `☀️ <b>Привет.</b>\n\nПять минут — и в ленте новый пост. Без раздумий:\n\n${KIND_EMOJI[k]} <i>${i}</i>`,

  (i, _n, k) =>
    `☀️ <b>С добрым утром.</b>\n\nЕсли вчера было не до контента — это нормально. Возвращаемся без напряжения:\n\n${KIND_EMOJI[k]} <i>${i}</i>`,

  (i, _n, k) =>
    `☕ <b>Утро.</b>\n\nОдин пост в день складывается в 30 за месяц. Сегодняшний:\n\n${KIND_EMOJI[k]} <i>${i}</i>`,

  (i, _n, k) =>
    `☀️ <b>Доброе утро.</b>\n\nВсё уже подготовлено — нужен только тап:\n\n${KIND_EMOJI[k]} <i>${i}</i>`,

  (i, _n, k) =>
    `✨ <b>Утро.</b>\n\nХороший день вернуться к ленте. Свежая идея:\n\n${KIND_EMOJI[k]} <i>${i}</i>`,

  (i, _n, k) =>
    `🌞 <b>Привет.</b>\n\nЛента живёт ритмом — не идеальностью. Простая идея на сегодня:\n\n${KIND_EMOJI[k]} <i>${i}</i>`,
];

// Спец-понедельник
const TEMPLATE_MONDAY_ACTIVE = (i: string, _n: string, k: Idea["kind"], count: number) =>
  `🚀 <b>С понедельником.</b>\n\nЗа выходные накопилось ${count} ${pluralMaterials(count)} — сильный задел. Новую неделю начинаем так же:\n\n${KIND_EMOJI[k]} <i>${i}</i>`;

const TEMPLATE_MONDAY_INACTIVE = (i: string, _n: string, k: Idea["kind"]) =>
  `🚀 <b>Новая неделя.</b>\n\nПонедельничный пост задаёт ритм всей семёрке дней. Идея уже готова:\n\n${KIND_EMOJI[k]} <i>${i}</i>`;

// Спец-пятница
const TEMPLATE_FRIDAY_ACTIVE = (i: string, _n: string, k: Idea["kind"], count: number) =>
  `🎉 <b>Пятница.</b>\n\nВчера +${count} — неделя в плюсе. Закрываем красиво:\n\n${KIND_EMOJI[k]} <i>${i}</i>`;

const TEMPLATE_FRIDAY_INACTIVE = (i: string, _n: string, k: Idea["kind"]) =>
  `🎉 <b>Пятница.</b>\n\nОдин пост — и неделя закрыта. Готовая идея:\n\n${KIND_EMOJI[k]} <i>${i}</i>`;

function formatMessage(p: Project, idea: Idea, yesterdayCount: number): string {
  const projectName = p.title || "твоего проекта";
  const safeIdea = escapeHtml(idea.text);
  const safeName = escapeHtml(projectName);
  const doy = dayOfYear();
  const mskNow = new Date(Date.now() + 3 * 3600 * 1000);
  const weekday = mskNow.getUTCDay(); // 0=вс ... 6=сб
  const active = yesterdayCount > 0;

  if (weekday === 1) {
    return active
      ? TEMPLATE_MONDAY_ACTIVE(safeIdea, safeName, idea.kind, yesterdayCount)
      : TEMPLATE_MONDAY_INACTIVE(safeIdea, safeName, idea.kind);
  }
  if (weekday === 5) {
    return active
      ? TEMPLATE_FRIDAY_ACTIVE(safeIdea, safeName, idea.kind, yesterdayCount)
      : TEMPLATE_FRIDAY_INACTIVE(safeIdea, safeName, idea.kind);
  }

  if (active) {
    const t = TEMPLATES_ACTIVE[doy % TEMPLATES_ACTIVE.length];
    return t(safeIdea, safeName, idea.kind, yesterdayCount);
  }
  const t = TEMPLATES_INACTIVE[doy % TEMPLATES_INACTIVE.length];
  return t(safeIdea, safeName, idea.kind);
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

  // Подтягиваем все project_id юзеров-кандидатов чтобы посчитать вчерашнюю
  // активность по ВСЕМ их проектам, а не только по primary.
  const userProjectIds = new Map<number, string[]>();
  {
    const tgIds = Array.from(byUser.keys());
    if (tgIds.length > 0) {
      const { data: allProjs } = await sb
        .from("projects")
        .select("id,tg_id")
        .in("tg_id", tgIds);
      for (const r of allProjs || []) {
        const tg = Number((r as any).tg_id);
        const list = userProjectIds.get(tg) || [];
        list.push((r as any).id);
        userProjectIds.set(tg, list);
      }
    }
  }

  // Вчерашние драфты (24ч окно МСК → грубо последние 24ч UTC, ок для retention)
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

  const targets: { project: Project; idea: Idea; yesterdayCount: number }[] = [];
  for (const [tg, p] of byUser) {
    if (recentSent.has(tg)) continue;
    const idea = pickIdea(p);
    if (!idea) continue;
    const projIds = userProjectIds.get(tg) || [p.id];
    let count = 0;
    for (const pid of projIds) count += draftCountByProject.get(pid) || 0;
    targets.push({ project: p, idea, yesterdayCount: count });
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
        yesterday: t.yesterdayCount,
      })),
    });
  }

  let sent = 0;
  let blocked = 0;
  let failed = 0;
  const errors: { tg_id: number; err: string }[] = [];
  const sentProjectIds: string[] = [];

  for (const { project, idea, yesterdayCount } of targets) {
    const text = formatMessage(project, idea, yesterdayCount);
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
