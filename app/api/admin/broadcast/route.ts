import { getSupabase } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Одноразовая рассылка update-сообщения всем юзерам, у которых есть проект.
 * Auth: CRON_SECRET.
 *
 * GET /api/admin/broadcast?secret=$CRON_SECRET&dry=1  — посчитать сколько
 * GET /api/admin/broadcast?secret=$CRON_SECRET        — реальная отправка
 */

const TEXT = `LEX AI обновился. Всё что было сломано — починили.

→ В 2 раза быстрее
→ 3 варианта поста на выбор
→ Карусели — готовый промпт для Midjourney
→ Reels — сценарий + раскадровка
→ Анализ конкурентов работает

Free расширен: 2 поста + 2 карусели + 2 Reels в неделю.

Заходи и проверь — займёт минуту.

P.S. Подпишись на @daniil_prim — туда пишу про обновления приложения и фичи. Чтобы не пропустить.`;

const KB = {
  inline_keyboard: [
    [{ text: "🚀 Открыть LEX AI", web_app: { url: "https://lex-ai-miniapp.vercel.app" } }],
    [{ text: "📣 Подписаться на канал", url: "https://t.me/daniil_prim" }],
  ],
};

async function tgSend(token: string, chatId: number): Promise<{ ok: boolean; err?: string }> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: TEXT,
        disable_web_page_preview: true,
        reply_markup: KB,
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
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  if (!secret || url.searchParams.get("secret") !== secret)
    return new Response("forbidden", { status: 403 });

  const dry = url.searchParams.get("dry") === "1";
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token && !dry)
    return Response.json({ error: "TELEGRAM_BOT_TOKEN missing" }, { status: 500 });

  // Тянем уникальные tg_id из projects
  const sb = getSupabase();
  const { data, error } = await sb
    .from("projects")
    .select("tg_id")
    .not("tg_id", "is", null);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const ids = Array.from(
    new Set((data || []).map((r: any) => Number(r.tg_id)).filter((n) => Number.isFinite(n)))
  );

  if (dry) {
    return Response.json({ dry: true, recipients: ids.length, sample: ids.slice(0, 5) });
  }

  // Rate limit: 25 msg/sec (TG hard limit 30/sec на бота)
  const SLEEP_MS = 50;
  let sent = 0;
  let blocked = 0;
  let failed = 0;
  const errors: { chat_id: number; err: string }[] = [];

  for (const chatId of ids) {
    const r = await tgSend(token!, chatId);
    if (r.ok) sent++;
    else {
      // 403 Forbidden = юзер заблокировал бота или не начал диалог
      if (/forbidden|blocked|deactivated|chat not found/i.test(r.err || "")) blocked++;
      else {
        failed++;
        if (errors.length < 20) errors.push({ chat_id: chatId, err: r.err || "" });
      }
    }
    await new Promise((res) => setTimeout(res, SLEEP_MS));
  }

  return Response.json({
    recipients: ids.length,
    sent,
    blocked,
    failed,
    errors,
  });
}
