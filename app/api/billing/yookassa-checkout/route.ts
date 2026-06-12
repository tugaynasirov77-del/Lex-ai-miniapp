import { NextRequest } from "next/server";
import { verifyInitData } from "../../../../lib/verifyTelegram";
import { TIERS, type Tier } from "../../../../lib/tiers";
import { createPayment, isYooKassaConfigured } from "../../../../lib/yookassa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/billing/yookassa-checkout
 * Body: { tier: "pro" | "business" }
 * Resp: { ok, payment_id, confirmation_url }
 *
 * Frontend открывает confirmation_url через Telegram.WebApp.openLink —
 * ЮKassa redirect-страница откроется поверх Mini App, юзер платит,
 * после успеха redirect на return_url (Mini App с startapp=billing_success).
 *
 * Активация подписки происходит в webhook (yookassa-webhook), не здесь.
 */
export async function POST(req: NextRequest) {
  if (!isYooKassaConfigured()) {
    return Response.json(
      { error: "ЮKassa ещё не подключена. Пока используйте оплату через Telegram Stars." },
      { status: 503 },
    );
  }

  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) {
    return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { tier?: string };
  const tier = body.tier;
  if (tier !== "pro" && tier !== "business") {
    return Response.json({ error: "tier must be pro|business" }, { status: 400 });
  }

  const cfg = TIERS[tier as Tier];
  if (!cfg.priceRub) {
    return Response.json({ error: "no RUB price for tier" }, { status: 400 });
  }

  // Возврат — Mini App с маркером успеха. Frontend подхватит startapp
  // и перерисует BillingScreen с подтянутой свежей подпиской.
  const returnUrl = "https://t.me/Lex_app_bot/lex?startapp=billing_success";

  try {
    const payment = await createPayment({
      amountRub: cfg.priceRub,
      description: `Подписка LEX AI ${cfg.label} на 30 дней`,
      returnUrl,
      metadata: {
        tg_id: String(v.user.id),
        tier,
      },
    });

    if (!payment.confirmation?.confirmation_url) {
      return Response.json(
        { error: "ЮKassa не вернула confirmation_url" },
        { status: 502 },
      );
    }

    return Response.json({
      ok: true,
      payment_id: payment.id,
      confirmation_url: payment.confirmation.confirmation_url,
    });
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "checkout failed" },
      { status: 500 },
    );
  }
}
