import { getAgent } from "../lib/mockData";
import { AGENT_THEME, type AgentId } from "../lib/agentTheme";

const RESULTS = [
  { agentId: "alina" as AgentId, title: "3 поста для канала", time: "10 мин", likes: 12, bg: "linear-gradient(135deg, #FFFFFF, #F0FDF4)", border: "linear-gradient(180deg, #10B981, #0EA5E9)" },
  { agentId: "alexander" as AgentId, title: "Стратегия на Q2", time: "1 час", likes: 8, bg: "linear-gradient(135deg, #FFFFFF, #EEF2FF)", border: "linear-gradient(180deg, #6366F1, #8B5CF6)" },
  { agentId: "mikhail" as AgentId, title: "Код Telegram бота", time: "3 часа", likes: 15, bg: "linear-gradient(135deg, #FFFFFF, #FFF7ED)", border: "linear-gradient(180deg, #F97316, #EF4444)" },
];

export default function ResultsList() {
  return (
    <section className="px-4 mt-5 animate-fade-up" style={{ animationDelay: "320ms" }}>
      <p className="caption mb-3 grad-text" style={{ backgroundImage: "linear-gradient(90deg, #10B981, #0EA5E9)" }}>Готово сегодня</p>
      <div className="space-y-2">
        {RESULTS.map((r) => {
          const agent = getAgent(r.agentId);
          const theme = AGENT_THEME[r.agentId];
          return (
            <div key={r.title} className="relative rounded-2xl p-3 overflow-hidden flex items-center gap-3"
              style={{ background: r.bg, border: "1px solid rgba(0,0,0,0.04)", boxShadow: "0 4px 14px rgba(0,0,0,0.05)" }}>
              <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: r.border }} />
              <div className="w-10 h-10 rounded-full overflow-hidden p-[2px] shrink-0 ml-1" style={{ background: `linear-gradient(135deg, ${theme.ringFrom}, ${theme.ringTo})` }}>
                <div className="w-full h-full rounded-full overflow-hidden bg-white">
                  {agent && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #10B981, #0EA5E9)" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <span className="text-[14px] font-semibold text-ink truncate">{r.title}</span>
                </div>
                <p className="text-[11px] text-muted mt-0.5">{agent?.name} · {r.time} · 👍 {r.likes}</p>
              </div>
              <button className="text-[12px] font-semibold grad-text shrink-0" style={{ backgroundImage: "linear-gradient(90deg, #0EA5E9, #8B5CF6)" }}>Открыть →</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
