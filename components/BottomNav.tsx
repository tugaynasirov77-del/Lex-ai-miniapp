"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hapticSelection } from "../lib/telegram";

const TABS = [
  { href: "/", label: "Главная",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
  },
  { href: "/team", label: "Команда",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.8"/>
        <circle cx="17" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M3 18.5c0-2.5 2.7-4 6-4s6 1.5 6 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M15 16.5c.5-1.3 2.3-2 4-2 1.3 0 2.5.4 3 1.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  { href: "/projects", label: "Проекты",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 7.5C3 6.4 3.9 5.5 5 5.5h4.2c.5 0 1 .2 1.4.6L12 7.5h7c1.1 0 2 .9 2 2v8.5c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V7.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
  },
  { href: "/history", label: "История",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  { href: "/analytics", label: "Аналитика",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M5 19V11M12 19V6M19 19V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function BottomNav() {
  const path = usePathname();
  if (path === "/") return null;
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl"
      style={{ background: "rgba(10,7,5,0.85)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="max-w-xl mx-auto grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href}
              onClick={() => hapticSelection()}
              className="relative flex flex-col items-center pt-2.5 pb-2 text-[10px] font-medium"
              style={{ color: active ? "#F0A020" : "#475569" }}>
              <span className="mb-0.5">{t.icon}</span>
              <span>{t.label}</span>
              {active && <span className="absolute bottom-0 w-8 h-0.5 rounded-full" style={{ background: "linear-gradient(90deg, #F0A020, #D05020)" }} />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
