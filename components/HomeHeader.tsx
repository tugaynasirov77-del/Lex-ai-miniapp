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
    <header className="sticky top-0 z-30 backdrop-blur-xl px-5 pt-[calc(env(safe-area-inset-top)+108px)] pb-3"
      style={{ background: "rgba(15,17,23,0.85)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #3B82F6, #6366F1)", boxShadow: "0 4px 14px rgba(59,130,246,0.45)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L4 14H12L11 22L20 10H12L13 2Z" fill="white"/>
            </svg>
          </div>
          <div>
            <h1 className="text-[18px] font-bold tracking-tight leading-tight text-ink">LEX AI</h1>
            <p className="text-[12px] text-muted leading-tight tnum">{AGENTS.length} агентов · {online} онлайн</p>
          </div>
        </div>
        <div className="relative">
          <div className="w-9 h-9 rounded-full overflow-hidden p-[2px]" style={{ background: "#10B981" }}>
            <div className="w-full h-full rounded-full overflow-hidden bg-bg flex items-center justify-center">
              {user?.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-ink">{initial}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
