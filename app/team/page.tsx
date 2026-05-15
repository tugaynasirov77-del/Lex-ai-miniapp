"use client";

import Header from "../../components/Header";
import { AGENTS } from "../../lib/mockData";

export default function TeamPage() {
  const onOpenBot = (username: string) => {
    const url = `https://t.me/${username}`;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, "_blank");
  };

  return (
    <>
      <Header title="Команда" subtitle={`${AGENTS.length} агентов в сети`} />
      <div className="px-4 grid grid-cols-2 gap-3 pb-24">
        {AGENTS.map((a) => (
          <button
            key={a.id}
            onClick={() => onOpenBot(a.botUsername)}
            className="glass rounded-2xl p-3 text-left flex flex-col gap-2 active:scale-[0.98] transition"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-bg border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
              </div>
              <span className="relative flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${a.status === "online" ? "bg-emerald-400 animate-pulse" : "bg-white/20"}`} />
                <span className="text-[10px] text-muted">{a.status === "online" ? "онлайн" : "офлайн"}</span>
              </span>
            </div>
            <div>
              <p className="text-sm font-medium leading-tight">{a.name}</p>
              <p className="text-[11px] text-muted mt-0.5 line-clamp-2">{a.role}</p>
            </div>
            <p className="text-[10px] text-muted/70 mt-auto">{a.lastActive}</p>
          </button>
        ))}
      </div>
    </>
  );
}
