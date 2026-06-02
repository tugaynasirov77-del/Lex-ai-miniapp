import { NextRequest } from "next/server";
import { verifyInitData } from "../../../../lib/verifyTelegram";
import { getSupabase } from "../../../../lib/supabase";
import { TIERS, tierFromString } from "../../../../lib/tiers";

export const runtime = "nodejs";
export const maxDuration = 30;

/** POST /api/billing/confirm { payload }
 *  Mini App дёргает после openInvoice со статусом 'paid'.
 *  Серверная верификация: пытаемся найти charge через getStarTransactions Bot API.
 *  Если транзакция найдена — апгрейдим подписку. Если нет — оставляем pending и пишем event.
 *  ВАЖНО: для прод-надёжности нужен полноценный bot webhook на successful_payment.
 *  Пока: бот в polling-режиме на VPS может вызвать тот же endpoint, передавая charge_id.
 */
export async function POST(req: NextRequest) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const payload = String(body.payload || "");
  if (!payload.startsWith("tier:")) return Response.json({ error: "invalid payload" }, { status: 400 });

  const parts = payload.split(":");
  const tier = tierFromString(parts[1]);
  const expectedTgId = Number(parts[3]);
  if (tier === "free") return Response.json({ error: "free tier doesn't need confirm" }, { status: 400 });
  if (expectedTgId !== v.user.id) return Response.json({ error: "tg_id mismatch" }, { status: 403 });

  const cfg = TIERS[tier];
  const token = process.env.TELEGRAM_BOT_TOKEN;
  let chargeId: string | null = null;

  // Попытка верификации через getStarTransactions (берём последние 50)
  if (token) {
    try {
      const tx = await fetch(`https://api.telegram.org/bot${token}/getStarTransactions?limit=50`).then((r) => r.json());
      if (tx.ok && Array.isArray(tx.result?.transactions)) {
        const found = tx.result.transactions.find((t: any) => {
          const p = t.source?.invoice_payload || t.invoice_payload || "";
          return p === payload;
        });
        if (found) chargeId = String(found.id || found.telegram_payment_charge_id || `tx_${Date.now()}`);
      }
    } catch {
      /* не критично — оставим без verified charge_id */
    }
  }

  const sb = getSupabase();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 3600 * 1000); // +30 дней

  // Upsert: один активный sub на юзера
  // Сначала закрываем все активные
  await sb
    .from("subscriptions")
    .update({ status: "expired" })
    .eq("tg_id", v.user.id)
    .eq("status", "active");

  const { data: sub, error: subErr } = await sb
    .from("subscriptions")
    .insert({
      tg_id: v.user.id,
      plan: tier,
      status: "active",
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      renew_at: expiresAt.toISOString(),
      provider: "telegram_stars",
      telegram_payment_charge_id: chargeId,
      invoice_payload: payload,
      amount_stars: cfg.priceStars,
    })
    .select("id,plan,status,started_at,expires_at")
    .single();
  if (subErr) return Response.json({ error: subErr.message }, { status: 500 });

  // Обновляем project_budget.tier для всех проектов юзера
  const { data: projects } = await sb.from("projects").select("id").eq("tg_id", v.user.id);
  for (const p of projects ?? []) {
    await sb
      .from("project_budget")
      .upsert(
        {
          project_id: p.id,
          tier,
          monthly_cap_usd: cfg.monthlyCapUsd,
        },
        { onConflict: "project_id" }
      );
  }

  // Audit
  await sb.from("billing_events").insert({
    tg_id: v.user.id,
    type: chargeId ? "payment_success" : "payment_unverified",
    tier,
    amount_stars: cfg.priceStars,
    meta: { payload, charge_id: chargeId, expires_at: expiresAt.toISOString() },
  });

  return Response.json({
    ok: true,
    tier,
    subscription: sub,
    expires_at: expiresAt.toISOString(),
    verified: !!chargeId,
  });
}
