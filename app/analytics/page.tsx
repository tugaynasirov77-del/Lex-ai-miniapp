"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "../../components/Header";
import { loadRecent, type RecentTaskEntry } from "../../lib/recentTasks";
import { getAgent } from "../../lib/mockData";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {hint && <p className="text-[11px] text-muted mt-0.5">{hint}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [list, setList] = useState<RecentTaskEntry[]>([]);

  useEffect(() => {
    setList(loadRecent());
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
      <Header title="Аналитика" subtitle="Метрики команды" />
      <div className="px-4 pb-24">
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
                    <div className="flex-1 h-1.5 bg-bg rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted w-6 text-right tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
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
