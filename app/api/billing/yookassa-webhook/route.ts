import { NextRequest } from "next/server";
import { getSupabase } from "../../../../lib/supabase";
import { getPayment } from "../../../../lib/yookassa";
import { TIERS, type Tier } from "../../../../lib/tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/billing/yookassa-webhook
 *
 * ЮKassa POST'ит сюда уведомления о статусе платежа.
 * Документация: https://yookassa.ru/developers/using-api/webhooks
 *
 * Безопасность:
 * - НЕ доверяем телу webhook'а напрямую (его можно подделать).
 * - Дёргаем ЮKassa REST `GET /payments/{id}` и сверяем актуальный статус.
 *   Если их API говорит «succeeded» — это реальный платёж.
 *   Если подделка — реальный API вернёт другой статус или 404, игнорируем.
 *
 * Идемпотентность:
 * - На один и тот же `payment_id` ЮKassa может прислать webhook несколько
 *   раз. Проверяем не активирована ли уже подписка по этому payment_id
 *   перед INSERT.
 */
export async function POST(req: NextRequest) {
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const event = String(payload?.event || "");
  const paymentId = String(payload?.object?.id || "");
  if (!paymentId) {
    return Response.json({ error: "no payment id" }, { status: 400 });
  }

  // Server-to-server verification
  let verified;
  try {
    verified = await getPayment(paymentId);
  } catch (e: any) {
    // Если verify не прошёл — webhook подделанный или payment ещё не
    // зарегистрирован. Логируем и говорим OK (чтобы ЮKassa не ретраил).
    console.error("[yookassa-webhook] verify failed:", e?.message);
    return Response.json({ ok: true, ignored: "verify failed" });
  }

  // Sanity-check: статус из payload должен совпадать с реальным.
  if (verified.status !== payload?.object?.status) {
    console.warn(
      `[yookassa-webhook] status mismatch: payload=${payload?.object?.status} real=${verified.status}`,
    );
    // Не ошибка — могла быть гонка. Опираемся на verified.
  }

  if (event === "payment.succeeded" && verified.status === "succeeded") {
    await activateSubscription(verified);
  } else if (
    event === "payment.canceled" ||
    verified.status === "canceled"
  ) {
    // Платёж отменён юзером или ЮKassa — ничего не активируем.
    return Response.json({ ok: true, action: "canceled" });
  }

  return Response.json({ ok: true });
}

async function activateSubscription(payment: {
  id: string;
  amount: { value: string };
  metadata?: Record<string, string>;
}): Promise<void> {
  const metadata = payment.metadata || {};
  const tgIdRaw = metadata.tg_id;
  const tier = metadata.tier as Tier | undefined;

  if (!tgIdRaw || !tier || !["pro", "business"].includes(tier)) {
    console.error("[yookassa-webhook] bad metadata:", metadata);
    return;
  }
  const tgId = Number(tgIdRaw);
  if (!Number.isFinite(tgId)) {
    console.error("[yookassa-webhook] bad tg_id:", tgIdRaw);
    return;
  }

  const sb = getSupabase();

  // Idempotence: если уже активировали по этому payment_id — выходим.
  const { data: existing } = await sb
    .from("subscriptions")
    .select("id")
    .eq("yookassa_payment_id", payment.id)
    .maybeSingle();
  if (existing) return;

  const cfg = TIERS[tier];
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await sb.from("subscriptions").insert({
    tg_id: tgId,
    plan: tier,
    status: "active",
    started_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    provider: "yookassa",
    yookassa_payment_id: payment.id,
    amount_rub: Number(payment.amount.value),
    amount_stars: cfg.priceStars, // справочно, для аналитики
  });

  // Если есть project_budget для юзера — обновляем tier синхронно.
  await sb
    .from("project_budget")
    .update({ tier })
    .eq("tg_id", tgId);

  // billing_event для аудита.
  await sb.from("billing_events").insert({
    tg_id: tgId,
    event: "payment_success",
    provider: "yookassa",
    payload: {
      payment_id: payment.id,
      tier,
      amount_rub: Number(payment.amount.value),
    },
  });
}

/** GET — health check для ручного теста curl'ом. */
export async function GET() {
  return Response.json({
    ok: true,
    info: "ЮKassa webhook endpoint. Принимает POST с уведомлениями о платежах.",
  });
}
