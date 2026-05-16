import { getSupabase } from "./supabase";

export const ANTHROPIC_PRICE = {
  "claude-sonnet-4-6": { input: 3 / 1_000_000, output: 15 / 1_000_000, cache_read: 0.30 / 1_000_000, cache_creation: 3.75 / 1_000_000 },
  "claude-haiku-4-5-20251001": { input: 0.80 / 1_000_000, output: 4 / 1_000_000, cache_read: 0.08 / 1_000_000, cache_creation: 1 / 1_000_000 },
} as const;

export type AnthropicModel = keyof typeof ANTHROPIC_PRICE;

type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

export function calcCost(model: AnthropicModel, u: TokenUsage): number {
  const p = ANTHROPIC_PRICE[model];
  return (
    (u.input_tokens || 0) * p.input +
    (u.output_tokens || 0) * p.output +
    (u.cache_read_input_tokens || 0) * p.cache_read +
    (u.cache_creation_input_tokens || 0) * p.cache_creation
  );
}

export async function getProjectBudget(projectId: string) {
  const sb = getSupabase();
  const { data } = await sb.from("project_budget").select("*").eq("project_id", projectId).maybeSingle();
  return data;
}

export async function canSpend(projectId: string): Promise<{ ok: boolean; reason?: string; spent: number; cap: number }> {
  const b = await getProjectBudget(projectId);
  if (!b) return { ok: true, spent: 0, cap: 1 };

  const period = new Date(b.period_start);
  const now = new Date();
  const monthsPassed =
    now.getUTCFullYear() * 12 + now.getUTCMonth() - (period.getUTCFullYear() * 12 + period.getUTCMonth());
  if (monthsPassed >= 1) {
    const sb = getSupabase();
    await sb
      .from("project_budget")
      .update({ spent_usd_current_month: 0, period_start: new Date().toISOString() })
      .eq("project_id", projectId);
    return { ok: true, spent: 0, cap: Number(b.monthly_cap_usd) };
  }

  const spent = Number(b.spent_usd_current_month);
  const cap = Number(b.monthly_cap_usd);
  if (b.auto_pause_on_exceed && spent >= cap) {
    return { ok: false, reason: `бюджет $${cap} на месяц исчерпан ($${spent.toFixed(4)} потрачено)`, spent, cap };
  }
  return { ok: true, spent, cap };
}

export async function recordSpend(opts: {
  projectId: string;
  agentRole: string;
  model: AnthropicModel;
  usage: TokenUsage;
  tgId?: number;
}) {
  const cost = calcCost(opts.model, opts.usage);
  const sb = getSupabase();

  await sb.from("project_usage").insert({
    project_id: opts.projectId,
    agent_role: opts.agentRole,
    cost_usd: cost,
    input_tokens: opts.usage.input_tokens ?? 0,
    output_tokens: opts.usage.output_tokens ?? 0,
    cache_read_tokens: opts.usage.cache_read_input_tokens ?? 0,
    cache_creation_tokens: opts.usage.cache_creation_input_tokens ?? 0,
    model: opts.model,
  });

  await sb.rpc("incr_project_spent", { p_project_id: opts.projectId, p_amount: cost }).then(
    () => {},
    async () => {
      const b = await getProjectBudget(opts.projectId);
      const cur = Number(b?.spent_usd_current_month ?? 0);
      await sb
        .from("project_budget")
        .update({ spent_usd_current_month: cur + cost, updated_at: new Date().toISOString() })
        .eq("project_id", opts.projectId);
    }
  );

  if (opts.tgId) {
    await sb.from("usage_log").insert({
      tg_id: opts.tgId,
      agent_id: opts.agentRole,
      endpoint: "project-bg",
      input_tokens: opts.usage.input_tokens ?? 0,
      output_tokens: opts.usage.output_tokens ?? 0,
      cache_creation_tokens: opts.usage.cache_creation_input_tokens ?? 0,
      cache_read_tokens: opts.usage.cache_read_input_tokens ?? 0,
    });
  }

  return cost;
}
