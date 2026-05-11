import { ACTIVE_TASKS, getAgent } from "../lib/mockData";
import SectionLabel from "./SectionLabel";

function EmptyIllustration() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
      <circle cx="28" cy="28" r="27" stroke="rgba(110,86,207,0.4)" strokeDasharray="3 3" />
      <path d="M20 28L26 34L37 22" stroke="#6E56CF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ActiveTasks() {
  const empty = ACTIVE_TASKS.length === 0;
  return (
    <section className="mt-8 animate-fade-up" style={{ animationDelay: "200ms" }}>
      <SectionLabel>В работе{!empty && ` · ${ACTIVE_TASKS.length}`}</SectionLabel>
      <div className="px-5">
        {empty ? (
          <div className="glass rounded-2xl p-6 flex flex-col items-center text-center">
            <EmptyIllustration />
            <p className="mt-3 text-[15px] font-medium">Команда свободна</p>
            <p className="mt-1 text-[13px] text-muted">Дай задачу — оркестратор раздаст её команде</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ACTIVE_TASKS.map((t) => {
              const a = getAgent(t.agentId);
              return (
                <div key={t.id} className="glass glass-hover rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 ring-2 ring-accent/40">
                    {a && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[14px] font-semibold">{a?.name}</span>
                      <span className="text-[11px] text-muted tnum">{t.progress}%</span>
                    </div>
                    <p className="text-[13px] text-muted truncate mb-2">{t.description}</p>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-accentGrad rounded-full" style={{ width: `${t.progress}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
