import { NextRequest } from "next/server";
import { verifyInitData } from "../../../../lib/verifyTelegram";
import { getSupabase } from "../../../../lib/supabase";
import { TIERS, tierFromString } from "../../../../lib/tiers";

export const runtime = "nodejs";
export const maxDuration = 30;

/** POST /api/billing/upgrade { tier: 'pro'|'business' }
 *  Создаёт Telegram Stars invoice link через Bot API createInvoiceLink.
 *  Возвращает { invoice_url } — Mini App открывает через Telegram.WebApp.openInvoice.
 */
export async function POST(req: NextRequest) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return Response.json({ error: "TELEGRAM_BOT_TOKEN missing" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const tier = tierFromString(body.tier);
  if (tier === "free") return Response.json({ error: "invalid tier" }, { status: 400 });

  const cfg = TIERS[tier];
  if (cfg.priceStars <= 0) return Response.json({ error: "tier not purchasable" }, { status: 400 });

  // Уникальный payload — будет в successful_payment, по нему матчим
  const payload = `tier:${tier}:tg:${v.user.id}:${Date.now()}`;

  // createInvoiceLink — Telegram Stars (currency XTR)
  const tgRes = await fetch(`https://api.telegram.org/bot${token}/createInvoiceLink`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: `LEX AI ${cfg.label}`,
      description: `Подписка ${cfg.label} на 30 дней. ${cfg.features.slice(0, 3).join(", ")}.`,
      payload,
      currency: "XTR",
      prices: [{ label: cfg.label, amount: cfg.priceStars }],
    }),
  });
  const tgData = await tgRes.json();
  if (!tgData.ok) {
    return Response.json(
      { error: "telegram createInvoiceLink failed", detail: tgData },
      { status: 502 }
    );
  }

  // Логируем намерение
  const sb = getSupabase();
  await sb.from("billing_events").insert({
    tg_id: v.user.id,
    type: "upgrade_intent",
    tier,
    amount_stars: cfg.priceStars,
    meta: { payload, invoice_url: tgData.result },
  });

  return Response.json({ ok: true, invoice_url: tgData.result, payload, tier, price_stars: cfg.priceStars });
}
