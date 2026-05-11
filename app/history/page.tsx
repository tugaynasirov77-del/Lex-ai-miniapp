import Header from "../../components/Header";
import { HISTORY, getAgent } from "../../lib/mockData";

export default function HistoryPage() {
  return (
    <>
      <Header title="История задач" subtitle={`${HISTORY.length} последних`} />
      <div className="px-4 space-y-2">
        {HISTORY.map((t) => {
          const a = getAgent(t.agentId);
          return (
            <div key={t.id} className="bg-card rounded-2xl p-3 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-bg border border-white/10">
                {a ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl">🤖</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{a?.name ?? "—"}</span>
                  <span className="text-[11px] text-muted shrink-0">{t.finishedAt}</span>
                </div>
                <p className="text-sm text-muted mt-0.5">{t.description}</p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-muted">
                  <span>⏱ {t.durationMin} мин</span>
                  {t.feedback === "up" && <span>👍</span>}
                  {t.feedback === "down" && <span>👎</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
