"use client";
import { AGENTS } from "../lib/mockData";

type Status = "online" | "busy" | "offline";

// Demo status overrides per spec (Alina busy, Arkadiy offline)
const STATUS_OVERRIDE: Record<string, Status> = {
  alina: "busy",
  arkadiy: "offline",
};

const STATUS_COLOR: Record<Status, { ring: string; glow: string; dot: string; pulse: string }> = {
  online:  { ring: "#10B981", glow: "0 0 14px rgba(16,185,129,0.35)", dot: "#10B981", pulse: "animate-pulse-dot" },
  busy:    { ring: "#F59E0B", glow: "0 0 14px rgba(245,158,11,0.35)", dot: "#F59E0B", pulse: "animate-pulse-dot-fast" },
  offline: { ring: "#475569", glow: "none", dot: "#475569", pulse: "" },
};

function openAgent(username: string) {
  const url = `https://t.me/${username}`;
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, "_blank");
}

export default function AgentsGrid() {
  const onlineCount = AGENTS.filter(a => (STATUS_OVERRIDE[a.id] ?? "online") === "online").length;
  return (
    <section className="px-4 mt-6 animate-fade-up" style={{ animationDelay: "120ms" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="caption">Команда</span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}>{onlineCount} онлайн</span>
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {AGENTS.map((a, i) => {
          const status = STATUS_OVERRIDE[a.id] ?? "online";
          const s = STATUS_COLOR[status];
          return (
            <button
              key={a.id}
              onClick={() => openAgent(a.botUsername)}
              className="rounded-2xl p-3 flex flex-col items-center text-center animate-fade-up"
              style={{
                animationDelay: `${140 + i * 40}ms`,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-full p-[2px]" style={{ background: s.ring, boxShadow: s.glow }}>
                  <div className="w-full h-full rounded-full overflow-hidden bg-bg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                  </div>
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg ${s.pulse}`}
                  style={{ background: s.dot }}
                />
              </div>
              <p className="text-[11px] font-semibold leading-tight mt-1.5 truncate max-w-full text-ink">{a.name}</p>
              <p className="text-[9px] leading-tight truncate max-w-full text-faint">{a.role.split(" — ")[0]}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
