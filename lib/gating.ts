import { getSupabase } from "./supabase";
import { TIERS, tierFromString, type Tier, type TierConfig } from "./tiers";

export type GateAction = "reel" | "carousel" | "plan" | "analysis";

function startOfMonthIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}
function startOfWeekIso(): string {
  const d = new Date();
  const day = d.getUTCDay() || 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 1));
  return monday.toISOString();
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
  // expired?
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return "free";
  return tierFromString(data.plan);
}

export type Usage = {
  reels: number;
  carousels: number;
  plans_this_week: number;
  analyses: number;
};

export async function getProjectUsage(projectId: string): Promise<Usage> {
  const sb = getSupabase();
  const monthIso = startOfMonthIso();
  const weekIso = startOfWeekIso();

  const [reels, carousels, plans, analyses] = await Promise.all([
    sb.from("content_drafts").select("id", { count: "exact", head: true })
      .eq("project_id", projectId).eq("content_type", "reel")
      .neq("status", "rejected").gte("created_at", monthIso),
    sb.from("content_drafts").select("id", { count: "exact", head: true })
      .eq("project_id", projectId).eq("content_type", "carousel")
      .neq("status", "rejected").gte("created_at", monthIso),
    sb.from("content_plans").select("id", { count: "exact", head: true })
      .eq("project_id", projectId).gte("created_at", weekIso),
    sb.from("ig_analyses").select("id", { count: "exact", head: true })
      .eq("project_id", projectId).gte("created_at", monthIso),
  ]);

  return {
    reels: reels.count ?? 0,
    carousels: carousels.count ?? 0,
    plans_this_week: plans.count ?? 0,
    analyses: analyses.count ?? 0,
  };
}

export type GateResult =
  | { ok: true; tier: Tier; config: TierConfig; usage: Usage }
  | { ok: false; tier: Tier; config: TierConfig; usage: Usage; reason: string; limit: number; used: number };

/** Проверка можно ли выполнить действие. Учитывает tier-лимиты + budget cap. */
export async function checkQuota(args: {
  projectId: string;
  tgId: number;
  action: GateAction;
}): Promise<GateResult> {
  const { projectId, tgId, action } = args;
  const tier = await getActiveTier(tgId);
  const cfg = TIERS[tier];
  const usage = await getProjectUsage(projectId);

  const map: Record<GateAction, { used: number; limit: number; label: string }> = {
    reel: { used: usage.reels, limit: cfg.reelsPerMonth, label: "Reels в месяц" },
    carousel: { used: usage.carousels, limit: cfg.carouselsPerMonth, label: "каруселей в месяц" },
    plan: { used: usage.plans_this_week, limit: cfg.plansPerWeek, label: "планов в неделю" },
    analysis: { used: usage.analyses, limit: cfg.analysesPerMonth, label: "анализов в месяц" },
  };
  const m = map[action];
  if (m.used >= m.limit) {
    // лог события
    try {
      const sb = getSupabase();
      await sb.from("billing_events").insert({
        project_id: projectId,
        tg_id: tgId,
        type: "gate_block",
        tier,
        meta: { action, used: m.used, limit: m.limit },
      });
    } catch {/* silent */}
    return {
      ok: false,
      tier,
      config: cfg,
      usage,
      reason: `Лимит ${cfg.label}: ${m.used}/${m.limit} ${m.label}. Апгрейд → Pro/Business.`,
      used: m.used,
      limit: m.limit,
    };
  }
  return { ok: true, tier, config: cfg, usage };
}

/** Хелпер для API: блокирует с 402, если квота превышена. */
export async function enforceQuota(args: {
  projectId: string;
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
        gate: { tier: r.tier, action: args.action, used: r.used, limit: r.limit, upgrade_required: true },
      },
      { status: 402 }
    ),
  };
}
