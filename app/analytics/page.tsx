import Header from "../../components/Header";
import { ANALYTICS, getAgent } from "../../lib/mockData";

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
  const top = getAgent(ANALYTICS.topAgentId);
  return (
    <>
      <Header title="Аналитика" subtitle="Метрики команды" />
      <div className="px-4 grid grid-cols-2 gap-3">
        <Stat label="Всего задач" value={String(ANALYTICS.totalTasks)} />
        <Stat label="Сегодня" value={String(ANALYTICS.todayTasks)} hint="за 24 часа" />
        <Stat label="За неделю" value={String(ANALYTICS.weekTasks)} hint="последние 7 дней" />
        <Stat label="Среднее время" value={`${ANALYTICS.avgResponseSec}с`} hint="ответ агента" />
      </div>

      <div className="px-4 mt-4">
        <div className="glass rounded-2xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-bg border border-white/10">
            {top ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={top.avatar} alt={top.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">🏆</div>
            )}
          </div>
          <div>
            <p className="text-xs text-muted">Самый активный агент</p>
            <p className="font-semibold">{top?.name ?? "—"}</p>
            <p className="text-xs text-muted">{top?.role}</p>
          </div>
        </div>
      </div>
    </>
  );
}
