"use client";
import { AGENTS } from "../lib/mockData";
import Section from "./Section";

function openAgent(username: string) {
  const url = `https://t.me/${username}`;
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, "_blank");
}

export default function AgentsScroll() {
  return (
    <Section number={2} title="Команда" tone="blue" badge={AGENTS.length} delay={100}>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-2 px-2 py-2">
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
                <div className={`w-[52px] h-[52px] rounded-full overflow-hidden ring-2 ${online ? "ring-sky-400/70 shadow-[0_0_14px_rgba(56,189,248,0.45)]" : "ring-white/10"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-bg ${online ? "bg-success animate-pulse-dot" : "bg-white/25"}`} />
              </div>
              <p className="mt-2 text-[11px] font-semibold leading-tight truncate max-w-full">{a.name}</p>
              <p className="text-[10px] text-muted leading-tight truncate max-w-full">{a.role.split(" — ")[0]}</p>
            </button>
          );
        })}
      </div>
    </Section>
  );
}
