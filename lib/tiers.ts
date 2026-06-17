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

export type TierConfig = {
  tier: Tier;
  label: string;
  priceStars: number;          // запасной способ оплаты (Telegram Stars)
  priceRub: number;            // primary способ оплаты через ЮKassa, рубли
  limits: {
    post: LimitSpec;
    carousel: LimitSpec;
    reel: LimitSpec;
    reel_decode: LimitSpec;    // главный лимит — разборы Reels
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
      reel_decode: { count: 3,  period: "month" }, // только для теста
    },
    maxProjects: 1,
    monthlyCapUsd: 0.4,
    available: true,
    features: [
      "1 проект",
      "3 разбора Reels в месяц",
      "Базовая генерация контента",
    ],
  },
  pro: {
    tier: "pro",
    label: "Pro",
    priceStars: 290,
    priceRub: 490,
    limits: {
      post:        { count: UNLIMITED, period: "month" },
      carousel:    { count: UNLIMITED, period: "month" },
      reel:        { count: UNLIMITED, period: "month" },
      reel_decode: { count: 30, period: "month" },
    },
    maxProjects: 2,
    monthlyCapUsd: 12,
    available: false,
    features: [
      "30 разборов Reels в месяц",
      "Безлимит постов и сценариев Reels",
      "До 2 проектов",
      "Клонирование стиля по референсным постам",
      "Приоритет в очереди генерации",
    ],
  },
  business: {
    tier: "business",
    label: "Pro+",
    priceStars: 850,
    priceRub: 1490,
    limits: {
      post:        { count: UNLIMITED, period: "month" },
      carousel:    { count: UNLIMITED, period: "month" },
      reel:        { count: UNLIMITED, period: "month" },
      reel_decode: { count: 100, period: "month" },
    },
    maxProjects: 10,
    monthlyCapUsd: 40,
    available: false,
    features: [
      "100 разборов Reels в месяц",
      "Безлимит постов и сценариев Reels",
      "До 10 проектов",
      "Клонирование стиля по референсным постам",
      "Приоритетная поддержка в Telegram",
    ],
  },
};

export function tierFromString(v: any): Tier {
  return v === "pro" || v === "business" ? v : "free";
}

export function isUnlimited(count: number): boolean {
  return count >= UNLIMITED;
}
