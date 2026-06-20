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

  // Идемпотентность: если уже зафиксировали этот payment_id — выходим.
  // (subscription_purchases.payment_id — единственное место с привязкой к платежу.)
  const { data: existing } = await sb
    .from("subscription_purchases")
    .select("id")
    .eq("payment_id", payment.id)
    .maybeSingle();
  if (existing) return;

  const cfg = TIERS[tier];
  const period = metadata.period === "yearly" ? "yearly" : "monthly";
  const now = new Date();
  const durationDays = period === "yearly" ? 365 : 30;
  const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  // Подписки: PK = tg_id, у юзера уже есть free-строка → upsert, а не insert.
  const { error: upErr } = await sb.from("subscriptions").upsert(
    {
      tg_id: tgId,
      plan: tier,
      status: "active",
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      provider: "yookassa",
      invoice_payload: payment.id, // храним payment_id (отдельной колонки нет)
      amount_stars: cfg.priceStars, // справочно
      updated_at: now.toISOString(),
    },
    { onConflict: "tg_id" },
  );
  if (upErr) {
    console.error("[yookassa-webhook] subscription upsert failed:", upErr.message);
    throw new Error(upErr.message);
  }

  // Фиксируем покупку (идемпотентность + аудит).
  await sb
    .from("subscription_purchases")
    .insert({ tg_id: tgId, plan_id: tier, payment_id: payment.id });

  // project_budget привязан к project_id, не к tg_id — обновляем все проекты юзера.
  const { data: projs } = await sb.from("projects").select("id").eq("tg_id", tgId);
  const projectIds = (projs || []).map((p: any) => p.id);
  if (projectIds.length) {
    await sb.from("project_budget").update({ tier }).in("project_id", projectIds);
  }

  // billing_events для аудита (best-effort, не блокирует активацию).
  try {
    await sb.from("billing_events").insert({
      project_id: projectIds[0] ?? null,
      type: "payment_success",
      tier,
      amount_stars: cfg.priceStars,
      meta: {
        provider: "yookassa",
        payment_id: payment.id,
        tg_id: tgId,
        amount_rub: Number(payment.amount.value),
        period,
      },
    });
  } catch (e: any) {
    console.warn("[yookassa-webhook] billing_events insert skipped:", e?.message);
  }
}

/** GET — health check для ручного теста curl'ом. */
export async function GET() {
  return Response.json({
    ok: true,
    info: "ЮKassa webhook endpoint. Принимает POST с уведомлениями о платежах.",
  });
}
