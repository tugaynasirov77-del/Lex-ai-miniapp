"use client";
import { AGENTS } from "../lib/mockData";
import { AGENT_THEME, type AgentId } from "../lib/agentTheme";

function openAgent(username: string) {
  const url = `https://t.me/${username}`;
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, "_blank");
}

export default function AgentsGrid() {
  return (
    <section className="px-4 mt-5 animate-fade-up" style={{ animationDelay: "120ms" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="caption grad-text" style={{ backgroundImage: "linear-gradient(90deg, #6366F1, #8B5CF6)" }}>Команда</p>
        <span className="text-[11px] text-muted tnum">{AGENTS.length}</span>
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {AGENTS.map((a, i) => {
          const theme = AGENT_THEME[a.id as AgentId];
          const online = a.status === "online";
          return (
            <button
              key={a.id}
              onClick={() => openAgent(a.botUsername)}
              className="rounded-2xl p-2.5 flex flex-col items-center text-center animate-fade-up"
              style={{
                animationDelay: `${140 + i * 40}ms`,
                background: theme.bg,
                border: "1px solid rgba(0,0,0,0.05)",
                boxShadow: theme.shadow,
              }}
            >
              <div className="relative">
                <div className="w-11 h-11 rounded-full p-[2px]" style={{ background: `linear-gradient(135deg, ${theme.ringFrom}, ${theme.ringTo})` }}>
                  <div className="w-full h-full rounded-full overflow-hidden bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                  </div>
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${online ? "animate-pulse-dot" : ""}`}
                  style={{ background: online ? "linear-gradient(135deg, #10B981, #34D399)" : "#9CA3AF" }}
                />
              </div>
              <p className="text-[11px] font-bold leading-tight mt-1.5 truncate max-w-full text-ink">{a.name}</p>
              <p className="text-[9px] leading-tight truncate max-w-full" style={{ color: theme.text }}>{a.role.split(" — ")[0]}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
