import { ACTIVE_TASKS, getAgent } from "../lib/mockData";

export default function ActiveTasks() {
  const empty = ACTIVE_TASKS.length === 0;
  return (
    <section className="px-4 mt-6 animate-fade-up" style={{ animationDelay: "180ms" }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white/90">Сейчас в работе</h2>
        {!empty && <span className="text-[11px] text-white/40">{ACTIVE_TASKS.length}</span>}
      </div>
      {empty ? (
        <div className="glass rounded-2xl p-5 text-center">
          <p className="text-sm text-white/70">Команда свободна. Дай задачу 👆</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ACTIVE_TASKS.map((t) => {
            const a = getAgent(t.agentId);
            return (
              <div key={t.id} className="glass rounded-2xl p-3 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center text-xl shrink-0 border border-white/10">
                  {a?.emoji ?? "🤖"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium">{a?.name}</span>
                    <span className="text-[11px] text-white/50">{t.progress}%</span>
                  </div>
                  <p className="text-xs text-white/70 truncate mb-1.5">{t.description}</p>
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-accent-grad rounded-full transition-all" style={{ width: `${t.progress}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
