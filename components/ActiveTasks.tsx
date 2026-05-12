import { ACTIVE_TASKS, getAgent } from "../lib/mockData";
import Section from "./Section";

function EmptyIllustration() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
      <circle cx="28" cy="28" r="27" stroke="rgba(48,164,108,0.45)" strokeDasharray="3 3" />
      <path d="M20 28L26 34L37 22" stroke="#30A46C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ActiveTasks() {
  const empty = ACTIVE_TASKS.length === 0;
  return (
    <Section number={3} title="В работе" tone="green" delay={200}>
      {empty ? (
        <div className="flex flex-col items-center text-center py-2">
          <EmptyIllustration />
          <p className="mt-3 text-[15px] font-medium">Команда свободна</p>
          <p className="mt-1 text-[13px] text-muted">Дай задачу — оркестратор раздаст её команде</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ACTIVE_TASKS.map((t) => {
            const a = getAgent(t.agentId);
            const online = a?.status === "online";
            return (
              <div key={t.id}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-12 h-12 rounded-full overflow-hidden shrink-0 ring-2 ${online ? "ring-success shadow-[0_0_18px_rgba(48,164,108,0.55)]" : "ring-white/10"}`}>
                    {a && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold">{a?.name}</span>
                        <span className="flex items-center gap-1 text-[11px] text-muted">
                          <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-success" : "bg-white/30"}`} />
                          {online ? "Онлайн" : "Офлайн"}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-success bg-success/15 border border-success/30 rounded-full px-2 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-success" /> Активно
                      </span>
                    </div>
                    <p className="text-[14px] mt-1">{t.description}</p>
                    <p className="text-[12px] text-muted mt-0.5">Срок: сегодня, 18:00</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-success rounded-full" style={{ width: `${t.progress}%` }} />
                  </div>
                  <span className="text-[14px] font-bold text-success tnum">{t.progress}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
