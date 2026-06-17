import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  const token = process.env.BARTENDER_BOT_TOKEN;
  if (!token) return Response.json({ error: "BARTENDER_BOT_TOKEN missing" }, { status: 500 });

  const webhookUrl = `https://${url.host}/api/telegram/bartender-webhook`;
  const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message"],
      drop_pending_updates: true,
    }),
  });
  const data = await r.json();

  const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((x) => x.json());
  return Response.json({ setWebhook: data, getWebhookInfo: info, webhookUrl });
}
