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
    <section className="mt-6 animate-fade-up" style={{ animationDelay: "120ms" }}>
      <h2 className="px-4 text-sm font-semibold text-white/90 mb-3">Агенты</h2>
      <div className="flex gap-3 px-4 overflow-x-auto no-scrollbar pb-1">
        {AGENTS.map((a) => (
          <button
            key={a.id}
            onClick={() => openAgent(a.botUsername)}
            className="shrink-0 w-[88px] group"
          >
            <div className="relative w-[88px] h-[88px] rounded-2xl overflow-hidden glass transition-all group-active:scale-95 group-hover:shadow-glowStrong">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.avatar} alt={a.name} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-accent-grad opacity-0 group-hover:opacity-20 group-active:opacity-30 transition-opacity" />
              <span className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 border-bg ${a.status === "online" ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-red-400"}`} />
            </div>
            <p className="text-center text-xs mt-2 font-medium truncate">{a.name}</p>
            <p className="text-center text-[10px] text-white/40 truncate">{a.role.split(" — ")[0]}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
