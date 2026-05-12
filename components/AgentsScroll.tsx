"use client";
import { AGENTS } from "../lib/mockData";

function openAgent(username: string) {
  const url = `https://t.me/${username}`;
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, "_blank");
}

export default function AgentsScroll() {
  return (
    <section className="mt-8 animate-fade-up" style={{ animationDelay: "100ms" }}>
      <div className="px-5 mb-3 flex items-center justify-between">
        <span className="caption">Команда</span>
        <span className="caption tnum">{AGENTS.length}</span>
      </div>
      <div className="flex gap-3 px-5 overflow-x-auto no-scrollbar pb-1">
        {AGENTS.map((a, i) => {
          const online = a.status === "online";
          return (
            <button
              key={a.id}
              onClick={() => openAgent(a.botUsername)}
              className="shrink-0 w-[64px] flex flex-col items-center group animate-fade-up"
              style={{ animationDelay: `${120 + i * 40}ms` }}
            >
              <div className="relative">
                <div className={`w-[48px] h-[48px] rounded-full overflow-hidden ${online ? "shadow-ringOn" : "ring-2 ring-white/10"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-[10px] h-[10px] rounded-full border-2 border-bg ${online ? "bg-success animate-pulse-dot" : "bg-white/25"}`}
                />
              </div>
              <p className="mt-2 text-[11px] font-semibold leading-tight truncate max-w-full">{a.name}</p>
              <p className="text-[10px] text-muted leading-tight truncate max-w-full">{a.role.split(" — ")[0]}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
