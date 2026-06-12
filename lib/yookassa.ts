/**
 * ЮKassa REST API клиент.
 *
 * Документация: https://yookassa.ru/developers/api
 *
 * ENV:
 *   YOOKASSA_SHOP_ID       — числовой идентификатор магазина
 *   YOOKASSA_SECRET_KEY    — секретный ключ магазина (test_* или live_*)
 *
 * Без обеих переменных модуль молча возвращает isYooKassaConfigured()=false —
 * биллинг автоматически использует Telegram Stars как fallback. Это значит
 * что код можно мерджить и деплоить ДО получения верифицированного магазина,
 * не сломав текущих юзеров.
 */

const API_BASE = "https://api.yookassa.ru/v3";

export function isYooKassaConfigured(): boolean {
  return !!(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY);
}

function authHeader(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secret = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secret) throw new Error("YOOKASSA_SHOP_ID/SECRET_KEY missing");
  // Web Crypto / Buffer недоступны в edge runtime — этот модуль только nodejs.
  const token = Buffer.from(`${shopId}:${secret}`).toString("base64");
  return `Basic ${token}`;
}

function idempotenceKey(): string {
  // Криптографически надёжная случайность не нужна — этот ключ только
  // защищает от двойного списания при ретраях fetch.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export type CreatePaymentArgs = {
  amountRub: number;
  description: string;
  returnUrl: string;
  /** tg_id, tier, и любые другие хвосты — попадают в callback. */
  metadata: Record<string, string>;
  /** Email для чека. Если не передан — соберём placeholder из tg_id. */
  customerEmail?: string;
};

export type YooKassaPayment = {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  amount: { value: string; currency: string };
  confirmation?: {
    type: string;
    confirmation_url: string;
  };
  payment_method?: { id: string; type: string; saved?: boolean };
  metadata?: Record<string, string>;
  created_at: string;
  description?: string;
};

export async function createPayment(
  args: CreatePaymentArgs,
): Promise<YooKassaPayment> {
  // Чек для самозанятого. ЮKassa требует email или phone в receipt.customer,
  // но у нас Telegram-юзеры без верифицированного email. Используем
  // placeholder — ЮKassa примет, чек уйдёт в «Мой налог» через интеграцию.
  // Когда юзер реально оставит email при следующих платежах — заменим.
  const email =
    args.customerEmail || `${args.metadata.tg_id || "user"}@telegram.lex-ai`;

  const body = {
    amount: {
      value: args.amountRub.toFixed(2),
      currency: "RUB",
    },
    capture: true,
    confirmation: {
      type: "redirect",
      return_url: args.returnUrl,
    },
    description: args.description.slice(0, 128),
    metadata: args.metadata,
    receipt: {
      customer: { email },
      items: [
        {
          description: args.description.slice(0, 128),
          quantity: "1.00",
          amount: {
            value: args.amountRub.toFixed(2),
            currency: "RUB",
          },
          // 1 = «Без НДС» — режим для самозанятого (НПД).
          vat_code: 1,
          // service = услуга (не товар). Для подписок именно это.
          payment_subject: "service",
          payment_mode: "full_payment",
        },
      ],
    },
  };

  const res = await fetch(`${API_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      "Idempotence-Key": idempotenceKey(),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`YooKassa create failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as YooKassaPayment;
}

/**
 * Server-to-server проверка платежа. Используется в webhook'е чтобы убедиться,
 * что входящее уведомление не подделано — мы дёргаем ЮKassa напрямую и
 * читаем актуальный статус. Подделанный webhook на этом отвалится.
 */
export async function getPayment(paymentId: string): Promise<YooKassaPayment> {
  const res = await fetch(`${API_BASE}/payments/${paymentId}`, {
    headers: { Authorization: authHeader() },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`YooKassa get failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as YooKassaPayment;
}
