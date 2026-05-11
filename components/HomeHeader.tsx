"use client";
import { useEffect, useState } from "react";
import { AGENTS } from "../lib/mockData";

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
    <header className="sticky top-0 z-30 px-5 pt-5 pb-4 backdrop-blur-xl bg-bg/70 border-b border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-accentGrad flex items-center justify-center shadow-glowBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M13 2L4 14H12L11 22L20 10H12L13 2Z" fill="white" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight leading-tight">LEX AI</h1>
            <p className="text-[11px] text-muted leading-tight tnum">{AGENTS.length} агентов · {online} онлайн</p>
          </div>
        </div>
        <div className="w-9 h-9 rounded-full overflow-hidden border border-border bg-surface flex items-center justify-center">
          {user?.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-semibold">{initial}</span>
          )}
        </div>
      </div>
    </header>
  );
}
