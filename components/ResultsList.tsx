import { getAgent } from "../lib/mockData";

const RESULTS = [
  { agentId: "alina", title: "3 поста для канала вайбкодинг", time: "10 мин", border: "#10B981", bg: "rgba(16,185,129,0.05)", ring: "linear-gradient(135deg, #F59E0B, #EF4444)" },
  { agentId: "alexander", title: "Контент-стратегия на Q2 2026", time: "1 час", border: "#6366F1", bg: "rgba(99,102,241,0.05)", ring: "linear-gradient(135deg, #8B5CF6, #6366F1)" },
  { agentId: "mikhail", title: "Telegram бот для записи", time: "3 часа", border: "#3B82F6", bg: "rgba(59,130,246,0.05)", ring: "linear-gradient(135deg, #10B981, #3B82F6)" },
];

export default function ResultsList() {
  return (
    <section className="px-4 mt-6 animate-fade-up" style={{ animationDelay: "260ms" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="caption grad-text" style={{ backgroundImage: "linear-gradient(90deg, #10B981, #3B82F6)" }}>Готово сегодня</span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}>{RESULTS.length} задач</span>
      </div>
      <div className="space-y-2">
        {RESULTS.map((r) => {
          const agent = getAgent(r.agentId);
          return (
            <div key={r.title} className="relative rounded-2xl p-3 overflow-hidden flex items-center gap-3"
              style={{ background: r.bg, border: "1px solid rgba(255,255,255,0.06)" }}>
              <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: r.border }} />
              <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 ml-1" style={{ background: r.border }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
              <div className="w-8 h-8 rounded-full p-[2px] shrink-0" style={{ background: r.ring }}>
                <div className="w-full h-full rounded-full overflow-hidden bg-bg">
                  {agent && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-ink truncate">{r.title}</p>
                <p className="text-[11px] text-muted mt-0.5">{r.time} · 👍 · <span style={{ color: "#3B82F6" }}>Открыть →</span></p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
