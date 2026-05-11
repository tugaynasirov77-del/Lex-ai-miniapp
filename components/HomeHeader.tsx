"use client";
import { useEffect, useState } from "react";

interface TgUser {
  first_name?: string;
  photo_url?: string;
}

export default function HomeHeader() {
  const [user, setUser] = useState<TgUser | null>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    const u = tg?.initDataUnsafe?.user as TgUser | undefined;
    if (u) setUser(u);
  }, []);

  const initial = (user?.first_name ?? "").slice(0, 1).toUpperCase() || "👤";

  return (
    <header className="px-4 pt-6 pb-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-accent-grad flex items-center justify-center shadow-glow">
          <span className="text-lg">⚡</span>
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight">LEX AI</h1>
          <p className="text-[11px] text-muted leading-tight">8 агентов на связи</p>
        </div>
      </div>
      <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 border border-white/10 flex items-center justify-center">
        {user?.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.photo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-base font-semibold">{initial}</span>
        )}
      </div>
    </header>
  );
}
