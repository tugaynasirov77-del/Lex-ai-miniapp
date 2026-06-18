/**
 * Тарифные планы и лимиты.
 * Подписка per-user (tg_id) — один план покрывает все проекты юзера.
 *
 * Главный лимит = reel_decode (разборы Reels по ссылке) — флагман продукта.
 * post/carousel/reel-сценарии на Pro+ безлимитны (count=9999).
 */

export type Tier = "free" | "pro" | "business";

export type LimitPeriod = "week" | "month";

export type LimitSpec = {
  count: number;
  period: LimitPeriod;
};

export type BillingPeriod = "monthly" | "yearly";

export type TierConfig = {
  tier: Tier;
  label: string;
  priceStars: number;          // запасной способ оплаты (Telegram Stars)
  priceRub: number;            // месячная цена через ЮKassa, рубли
  priceRubYearly?: number;     // годовая цена со скидкой (если есть)
  limits: {
    post: LimitSpec;
    carousel: LimitSpec;
    reel: LimitSpec;
    reel_decode: LimitSpec;    // главный лимит — разборы Reels
    caption: LimitSpec;        // генерация подписей под Reels/посты
  };
  maxProjects: number;
  monthlyCapUsd: number;       // потолок Anthropic-расходов на проект
  available: boolean;
  features: string[];
};

// Условный безлимит — UI рендерит как «Безлимит»
export const UNLIMITED = 9999;

export const TIERS: Record<Tier, TierConfig> = {
  free: {
    tier: "free",
    label: "Free",
    priceStars: 0,
    priceRub: 0,
    limits: {
      post:        { count: 2,  period: "week" },
      carousel:    { count: 2,  period: "week" },
      reel:        { count: 2,  period: "week" },
      reel_decode: { count: 3,  period: "month" },
      caption:     { count: 5,  period: "month" },
    },
    maxProjects: 1,
    monthlyCapUsd: 0.4,
    available: true,
    features: [
      "1 Instagram-проект",
      "3 разбора Reels в месяц",
      "Базовая генерация подписей и карусели",
    ],
  },
  pro: {
    tier: "pro",
    label: "Pro",
    priceStars: 290,
    priceRub: 490,
    priceRubYearly: 3990, // 332₽/мес эффективно, -32%
    limits: {
      post:        { count: UNLIMITED, period: "month" },
      carousel:    { count: UNLIMITED, period: "month" },
      reel:        { count: UNLIMITED, period: "month" },
      reel_decode: { count: 30, period: "month" },
      caption:     { count: UNLIMITED, period: "month" },
    },
    maxProjects: 2,
    monthlyCapUsd: 12,
    available: false,
    features: [
      "30 разборов Reels в месяц",
      "Сценарии Reels с нуля под твою нишу",
      "Безлимит карусели и подписей",
      "Контент-план на неделю по архиву разборов",
      "До 2 Instagram-проектов",
      "Приоритет в очереди генерации",
    ],
  },
  business: {
    tier: "business",
    label: "Pro+",
    priceStars: 850,
    priceRub: 1490,
    priceRubYearly: 11900, // 992₽/мес эффективно, -33%
    limits: {
      post:        { count: UNLIMITED, period: "month" },
      carousel:    { count: UNLIMITED, period: "month" },
      reel:        { count: UNLIMITED, period: "month" },
      reel_decode: { count: 100, period: "month" },
      caption:     { count: UNLIMITED, period: "month" },
    },
    maxProjects: 10,
    monthlyCapUsd: 40,
    available: false,
    features: [
      "100 разборов Reels в месяц",
      "Сценарии Reels с нуля + генерация серий (5 вариаций)",
      "Безлимит карусели и подписей",
      "Контент-план + AI-сводка ниши",
      "До 10 Instagram-проектов",
      "Приоритетная поддержка",
    ],
  },
};

export function tierFromString(v: any): Tier {
  return v === "pro" || v === "business" ? v : "free";
}

export function isUnlimited(count: number): boolean {
  return count >= UNLIMITED;
}
