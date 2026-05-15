"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "../../components/Header";
import { loadRecent, type RecentTaskEntry } from "../../lib/recentTasks";
import { getAgent } from "../../lib/mockData";
import { tgFetch, getTgId } from "../../lib/telegram";

interface UsageStats {
  total: {
    calls: number;
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
    cost_usd: number;
    cache_hit_rate: number;
  };
  by_agent: Record<string, { input: number; output: number; calls: number }>;
}

function fmtTok(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>{label}</p>
      <p className="text-2xl mt-1" style={{ fontWeight: 200, color: "rgba(240,232,218,0.92)" }}>{value}</p>
      {hint && <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{hint}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [list, setList] = useState<RecentTaskEntry[]>([]);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [usageErr, setUsageErr] = useState<string | null>(null);

  useEffect(() => {
    setList(loadRecent());
    if (!getTgId()) return;
    tgFetch("/api/usage")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "failed");
        setUsage(d);
      })
      .catch((e) => setUsageErr(e.message));
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const today = list.filter((t) => now - t.createdAt < day).length;
    const week = list.filter((t) => now - t.createdAt < 7 * day).length;
    const up = list.filter((t) => t.feedback === "up").length;
    const down = list.filter((t) => t.feedback === "down").length;

    const byAgent: Record<string, number> = {};
    list.forEach((t) => {
      byAgent[t.agentId] = (byAgent[t.agentId] || 0) + 1;
    });
    const top = Object.entries(byAgent).sort((a, b) => b[1] - a[1]);
    const max = top[0]?.[1] ?? 0;

    return { total: list.length, today, week, up, down, top, max };
  }, [list]);

  const topAgent = stats.top[0] ? getAgent(stats.top[0][0]) : null;

  return (
    <>
      <Header title="Аналитика" accent="данных" subtitle="метрики команды" />
      <div className="pb-24" style={{ paddingLeft: 22, paddingRight: 22 }}>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Всего задач" value={String(stats.total)} />
          <Stat label="Сегодня" value={String(stats.today)} hint="за 24 часа" />
          <Stat label="За неделю" value={String(stats.week)} hint="последние 7 дней" />
          <Stat
            label="Качество"
            value={stats.up + stats.down > 0 ? `${Math.round((stats.up / (stats.up + stats.down)) * 100)}%` : "—"}
            hint={`👍 ${stats.up} · 👎 ${stats.down}`}
          />
        </div>

        {topAgent && (
          <div className="glass rounded-2xl p-4 flex items-center gap-3 mt-4">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-bg border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={topAgent.avatar} alt={topAgent.name} className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-xs text-muted">Самый активный агент</p>
              <p className="font-semibold">{topAgent.name}</p>
              <p className="text-xs text-muted">{stats.top[0][1]} задач</p>
            </div>
          </div>
        )}

        {stats.top.length > 0 && (
          <div className="glass rounded-2xl p-4 mt-4">
            <p className="text-xs text-muted mb-3">Распределение по агентам</p>
            <div className="space-y-2">
              {stats.top.map(([id, count]) => {
                const a = getAgent(id);
                const pct = stats.max > 0 ? (count / stats.max) * 100 : 0;
                return (
                  <div key={id} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-bg border border-white/10 shrink-0">
                      {a && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <span className="text-xs text-muted w-16 shrink-0">{a?.name ?? id}</span>
                    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #F0A020, #D05020)" }} />
                    </div>
                    <span className="text-xs text-muted w-6 text-right tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {usage && usage.total.calls > 0 && (
          <div className="glass rounded-2xl p-4 mt-4">
            <p className="text-xs text-muted mb-3">Расход токенов</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-muted">Стоимость</p>
                <p className="text-xl font-bold mt-0.5">${usage.total.cost_usd.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Запросов</p>
                <p className="text-xl font-bold mt-0.5">{usage.total.calls}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Input / Output</p>
                <p className="text-sm mt-0.5">{fmtTok(usage.total.input_tokens)} / {fmtTok(usage.total.output_tokens)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Cache hit</p>
                <p className="text-sm mt-0.5">{Math.round(usage.total.cache_hit_rate * 100)}%</p>
                <p className="text-[10px] text-muted/70">read {fmtTok(usage.total.cache_read_tokens)}</p>
              </div>
            </div>
          </div>
        )}

        {usageErr && (
          <p className="text-[11px] text-rose-400/70 mt-2 text-center">usage: {usageErr}</p>
        )}

        {list.length === 0 && (
          <p className="text-sm text-muted py-8 text-center">
            пока пусто — отправь первую задачу на главной
          </p>
        )}
      </div>
    </>
  );
}
