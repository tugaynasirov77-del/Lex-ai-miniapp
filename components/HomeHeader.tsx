"use client";
import { useEffect, useState } from "react";
import { AGENTS, ACTIVE_TASKS } from "../lib/mockData";

interface TgUser { first_name?: string; photo_url?: string; }

export default function HomeHeader() {
  const [user, setUser] = useState<TgUser | null>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    const u = tg?.initDataUnsafe?.user as TgUser | undefined;
    if (u) setUser(u);
  }, []);

  const initial = (user?.first_name ?? "").slice(0, 1).toUpperCase() || "👤";
  const online = AGENTS.filter(a => a.status === "online").length;

  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl px-5 pt-[calc(env(safe-area-inset-top)+44px)] pb-3"
      style={{ background: "linear-gradient(to right, rgba(239,246,255,0.85), rgba(245,243,255,0.85))" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0EA5E9, #8B5CF6)", boxShadow: "0 4px 14px rgba(139,92,246,0.35)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L4 14H12L11 22L20 10H12L13 2Z" fill="white"/>
            </svg>
          </div>
          <div>
            <h1 className="text-[17px] font-bold tracking-tight leading-tight grad-text" style={{ backgroundImage: "linear-gradient(90deg, #0EA5E9, #8B5CF6)" }}>LEX AI</h1>
            <p className="text-[11px] text-muted leading-tight tnum">{AGENTS.length} агентов · {online} онлайн · {ACTIVE_TASKS.length} задач</p>
          </div>
        </div>
        <div className="relative">
          <div className="w-10 h-10 rounded-full overflow-hidden p-[2px]" style={{ background: "linear-gradient(135deg, #10B981, #0EA5E9)" }}>
            <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center">
              {user?.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-ink">{initial}</span>
              )}
            </div>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white" style={{ background: "linear-gradient(135deg, #10B981, #34D399)" }} />
        </div>
      </div>
      <div className="rainbow-line absolute bottom-0 left-0 right-0" />
    </header>
  );
}
