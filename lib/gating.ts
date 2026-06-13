import { getSupabase } from "./supabase";
import { TIERS, tierFromString, type Tier, type TierConfig, type LimitSpec } from "./tiers";

export type GateAction = "post" | "carousel" | "reel";

/**
 * Quota epoch — драфты созданные ДО этой даты не учитываются в лимитах.
 * Используется при relaunch (новые условия) — даёт всем чистый счётчик.
 * Текущее значение — момент перехода на LEX AI (13 июня 2026, 09:00 UTC).
 */
const QUOTA_EPOCH = new Date("2026-06-13T09:00:00Z").getTime();

function startOfMonthIso(): string {
  const d = new Date();
  const ms = Math.max(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1),
    QUOTA_EPOCH
  );
  return new Date(ms).toISOString();
}

function startOfWeekIso(): string {
  const d = new Date();
  const day = d.getUTCDay() || 7;
  const monday = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - day + 1
  );
  const ms = Math.max(monday, QUOTA_EPOCH);
  return new Date(ms).toISOString();
}

/** Текущий активный tier для tg_id юзера. */
export async function getActiveTier(tgId: number): Promise<Tier> {
  const sb = getSupabase();
  const { data } = await sb
    .from("subscriptions")
    .select("plan,status,expires_at")
    .eq("tg_id", tgId)
    .eq("status", "active")
    .order("expires_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!data) return "free";
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return "free";
  return tierFromString(data.plan);
}

/**
 * Считает использование action'а юзера (по всем проектам) за период,
 * который задаётся в TierConfig.limits[action].period.
 */
export async function countUsage(
  tgId: number,
  action: GateAction,
  period: "week" | "month",
): Promise<number> {
  const sb = getSupabase();
  const since = period === "week" ? startOfWeekIso() : startOfMonthIso();

  // Считаем по всем проектам юзера — подписка per-user.
  const { count } = await sb
    .from("content_drafts")
    .select("id, projects!inner(tg_id)", { count: "exact", head: true })
    .eq("content_type", action)
    .neq("status", "rejected")
    .gte("created_at", since)
    .eq("projects.tg_id", tgId);

  return count ?? 0;
}

export type GateResult =
  | { ok: true; tier: Tier; config: TierConfig; limit: LimitSpec; used: number }
  | {
      ok: false;
      tier: Tier;
      config: TierConfig;
      limit: LimitSpec;
      used: number;
      reason: string;
    };

/** Проверка можно ли выполнить action. */
export async function checkQuota(args: {
  tgId: number;
  action: GateAction;
}): Promise<GateResult> {
  const { tgId, action } = args;
  const tier = await getActiveTier(tgId);
  const cfg = TIERS[tier];
  const limit = cfg.limits[action];
  const used = await countUsage(tgId, action, limit.period);

  if (used >= limit.count) {
    const periodLabel = limit.period === "week" ? "за эту неделю" : "за этот месяц";
    return {
      ok: false,
      tier,
      config: cfg,
      limit,
      used,
      reason: `Лимит ${cfg.label}: ${used}/${limit.count} ${actionLabel(action)} ${periodLabel}.`,
    };
  }
  return { ok: true, tier, config: cfg, limit, used };
}

function actionLabel(a: GateAction): string {
  return a === "post" ? "постов" : a === "carousel" ? "каруселей" : "сценариев Reels";
}

/** Хелпер для API: блокирует с 402, если квота превышена. */
export async function enforceQuota(args: {
  tgId: number;
  action: GateAction;
}): Promise<{ pass: true; tier: Tier } | { pass: false; response: Response }> {
  const r = await checkQuota(args);
  if (r.ok) return { pass: true, tier: r.tier };
  return {
    pass: false,
    response: Response.json(
      {
        error: r.reason,
        gate: {
          tier: r.tier,
          action: args.action,
          used: r.used,
          limit: r.limit.count,
          period: r.limit.period,
          upgrade_required: false, // ЮKassa ещё не верифицирована
        },
      },
      { status: 402 }
    ),
  };
}
