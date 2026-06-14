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
  name: string | null;
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

function formatMessage(p: Project, idea: Idea): string {
  const projectName = p.name || "твоего проекта";
  const kindEmoji: Record<Idea["kind"], string> = {
    hook: "💡",
    carousel: "🎴",
    reel: "🎬",
    theme: "📌",
  };
  const kindLabel: Record<Idea["kind"], string> = {
    hook: "Хук дня",
    carousel: "Карусель дня",
    reel: "Reels-формат дня",
    theme: "Тема дня",
  };
  const lines: string[] = [];
  lines.push(`🌅 <b>Доброе утро!</b>`);
  lines.push("");
  lines.push(`${kindEmoji[idea.kind]} <b>${kindLabel[idea.kind]}</b> для «${projectName}»:`);
  lines.push("");
  lines.push(`<i>${escapeHtml(idea.text)}</i>`);
  lines.push("");
  lines.push(`Один тап — и LEX AI соберёт пост.`);
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildKeyboard(p: Project, idea: Idea) {
  const topic = encodeURIComponent(idea.text.slice(0, 200));
  const kind = idea.kind === "carousel" ? "carousel" : idea.kind === "reel" ? "reel" : "post";
  const url = `${APP_URL}/?p=${p.id}&topic=${topic}&kind=${kind}`;
  const ctaText =
    idea.kind === "carousel"
      ? "🎴 Собрать карусель"
      : idea.kind === "reel"
      ? "🎬 Написать сценарий"
      : "🚀 Сгенерить пост";
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
      "id,tg_id,name,platform,lex_insights,lex_insights_updated_at,last_digest_sent_at",
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
