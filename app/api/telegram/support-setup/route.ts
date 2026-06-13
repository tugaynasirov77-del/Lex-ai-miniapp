export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Одноразовая регистрация webhook для support-бота.
 * curl "https://lex-ai-miniapp.vercel.app/api/telegram/support-setup?secret=$CRON_SECRET"
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET missing", { status: 500 });

  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== secret)
    return new Response("forbidden", { status: 403 });

  const token = process.env.TELEGRAM_SUPPORT_BOT_TOKEN;
  if (!token)
    return Response.json({ error: "TELEGRAM_SUPPORT_BOT_TOKEN missing" }, { status: 500 });

  const webhookUrl = "https://lex-ai-miniapp.vercel.app/api/telegram/support-webhook";
  const webhookSecret = process.env.TELEGRAM_SUPPORT_WEBHOOK_SECRET || "";

  const params = new URLSearchParams({
    url: webhookUrl,
    drop_pending_updates: "true",
    max_connections: "20",
    allowed_updates: JSON.stringify(["message"]),
  });
  if (webhookSecret) params.set("secret_token", webhookSecret);

  const setData = await (
    await fetch(`https://api.telegram.org/bot${token}/setWebhook?${params}`)
  ).json();
  const info = await (
    await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
  ).json();
  const me = await (
    await fetch(`https://api.telegram.org/bot${token}/getMe`)
  ).json();

  return Response.json({
    set: setData,
    info,
    me,
    support_chat_id_env: process.env.SUPPORT_CHAT_ID ? "set" : "NOT SET (нужно задать)",
  });
}
