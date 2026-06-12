/**
 * Тарифные планы и лимиты.
 * Подписка per-user (tg_id) — один план покрывает все проекты юзера.
 */

export type Tier = "free" | "pro" | "business";

export type TierConfig = {
  tier: Tier;
  label: string;
  priceStars: number;          // запасной способ оплаты (Telegram Stars)
  priceRub: number;            // primary способ оплаты через ЮKassa, рубли
  reelsPerMonth: number;
  carouselsPerMonth: number;
  plansPerWeek: number;         // регенерация content_plan
  analysesPerMonth: number;
  maxProjects: number;
  monthlyCapUsd: number;        // потолок Anthropic-расходов
  features: string[];           // короткие описания для UI
};

export const TIERS: Record<Tier, TierConfig> = {
  free: {
    tier: "free",
    label: "Free",
    priceStars: 0,
    priceRub: 0,
    reelsPerMonth: 3,
    carouselsPerMonth: 5,
    plansPerWeek: 1,
    analysesPerMonth: 3,
    maxProjects: 1,
    monthlyCapUsd: 1,
    features: [
      "1 проект",
      "3 Reels / мес",
      "5 каруселей / мес",
      "1 план в неделю",
      "3 анализа конкурентов / мес",
    ],
  },
  pro: {
    tier: "pro",
    label: "Pro",
    priceStars: 350,           // Stars-эквивалент ≈ 690₽
    priceRub: 690,
    reelsPerMonth: 30,
    carouselsPerMonth: 30,
    plansPerWeek: 4,
    analysesPerMonth: 20,
    maxProjects: 3,
    monthlyCapUsd: 10,
    features: [
      "До 3 проектов",
      "30 Reels / мес",
      "30 каруселей / мес",
      "4 плана в неделю",
      "20 анализов / мес",
      "Приоритетная очередь рендера",
    ],
  },
  business: {
    tier: "business",
    label: "Business",
    priceStars: 1000,          // Stars-эквивалент ≈ 1980₽
    priceRub: 1980,
    reelsPerMonth: 100,
    carouselsPerMonth: 100,
    plansPerWeek: 999,
    analysesPerMonth: 100,
    maxProjects: 10,
    monthlyCapUsd: 50,
    features: [
      "До 10 проектов",
      "100 Reels / мес",
      "100 каруселей / мес",
      "Безлимит планов",
      "100 анализов / мес",
      "Email-поддержка",
    ],
  },
};

export function tierFromString(v: any): Tier {
  return v === "pro" || v === "business" ? v : "free";
}
