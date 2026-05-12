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
    <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur-xl border-b border-black/[0.06] px-5 pt-[calc(env(safe-area-inset-top)+12px)] pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-ink flex items-center justify-center">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L4 14H12L11 22L20 10H12L13 2Z" fill="#FAFAFA"/>
            </svg>
          </div>
          <div>
            <h1 className="text-[16px] font-bold tracking-tight leading-tight text-ink">LEX AI</h1>
            <p className="text-[11px] text-muted leading-tight tnum">{AGENTS.length} агентов · {online} онлайн</p>
          </div>
        </div>
        <div className="relative">
          <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-emerald bg-white flex items-center justify-center">
            {user?.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-semibold text-ink">{initial}</span>
            )}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald border-2 border-white" />
        </div>
      </div>
    </header>
  );
}
