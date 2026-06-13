/**
 * Тарифные планы и лимиты.
 * Подписка per-user (tg_id) — один план покрывает все проекты юзера.
 *
 * После перехода на LEX AI лимиты считаются по форматам контента
 * (post / carousel / reel). Free — недельные лимиты, Pro/Business — месячные.
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
  };
  maxProjects: number;
  monthlyCapUsd: number;       // потолок Anthropic-расходов на проект
  available: boolean;          // показывать ли в магазине (ЮKassa ещё не верифицирована)
  features: string[];
};

export const TIERS: Record<Tier, TierConfig> = {
  free: {
    tier: "free",
    label: "Free",
    priceStars: 0,
    priceRub: 0,
    limits: {
      post:     { count: 1, period: "week" },
      carousel: { count: 1, period: "week" },
      reel:     { count: 1, period: "week" },
    },
    maxProjects: 1,
    monthlyCapUsd: 0.5,
    available: true,
    features: [
      "1 проект",
      "1 пост в неделю",
      "1 карусель в неделю",
      "1 сценарий Reels в неделю",
      "Анализ конкурентов",
    ],
  },
  pro: {
    tier: "pro",
    label: "Pro",
    priceStars: 350,
    priceRub: 690,
    limits: {
      post:     { count: 60,  period: "month" },
      carousel: { count: 30,  period: "month" },
      reel:     { count: 30,  period: "month" },
    },
    maxProjects: 3,
    monthlyCapUsd: 10,
    available: false,   // ЮKassa на верификации
    features: [
      "До 3 проектов",
      "60 постов в месяц",
      "30 каруселей в месяц",
      "30 сценариев Reels в месяц",
      "Полный анализ конкурентов",
      "Приоритет в очереди",
    ],
  },
  business: {
    tier: "business",
    label: "Business",
    priceStars: 1000,
    priceRub: 1980,
    limits: {
      post:     { count: 200, period: "month" },
      carousel: { count: 100, period: "month" },
      reel:     { count: 100, period: "month" },
    },
    maxProjects: 10,
    monthlyCapUsd: 50,
    available: false,   // ЮKassa на верификации
    features: [
      "До 10 проектов",
      "200 постов в месяц",
      "100 каруселей в месяц",
      "100 сценариев Reels в месяц",
      "Анализ без лимитов",
      "Email-поддержка",
    ],
  },
};

export function tierFromString(v: any): Tier {
  return v === "pro" || v === "business" ? v : "free";
}
