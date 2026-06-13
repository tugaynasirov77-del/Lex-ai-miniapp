export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Одноразовый endpoint регистрации Telegram webhook.
 * Использует CRON_SECRET для auth (тот же что и у cron'ов).
 *
 * curl "https://lex-ai-miniapp.vercel.app/api/telegram/setup-webhook?secret=$CRON_SECRET"
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET missing", { status: 500 });

  const url = new URL(req.url);
  const provided = url.searchParams.get("secret");
  if (provided !== secret) return new Response("forbidden", { status: 403 });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return Response.json({ error: "TELEGRAM_BOT_TOKEN missing" }, { status: 500 });

  const webhookUrl = "https://lex-ai-miniapp.vercel.app/api/telegram/webhook";
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || "";

  const params = new URLSearchParams({
    url: webhookUrl,
    drop_pending_updates: "true",
    max_connections: "40",
  });
  if (webhookSecret) params.set("secret_token", webhookSecret);

  const setRes = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook?${params.toString()}`
  );
  const setData = await setRes.json();

  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const infoData = await infoRes.json();

  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const meData = await meRes.json();

  return Response.json({
    set: setData,
    info: infoData,
    me: meData,
  });
}
