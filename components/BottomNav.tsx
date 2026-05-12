"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Команда",
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
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl"
      style={{ background: "linear-gradient(to right, rgba(239,246,255,0.92), rgba(245,243,255,0.92))" }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, #BAE6FD, #C4B5FD, #A7F3D0)" }} />
      <div className="max-w-xl mx-auto grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative flex flex-col items-center pt-2.5 pb-2 text-[11px] font-medium ${active ? "" : "text-faint hover:text-ink"}`}
              style={active ? { color: "transparent" } : undefined}
            >
              <span className={active ? "grad-text" : ""} style={active ? { color: "#0EA5E9" } : undefined}>
                {/* icon uses currentColor; wrap with gradient on active via parent */}
              </span>
              <span className="mb-0.5" style={active ? { color: "#0EA5E9" } : undefined}>{t.icon}</span>
              <span style={active ? { backgroundImage: "linear-gradient(90deg, #0EA5E9, #8B5CF6)" } : undefined} className={active ? "grad-text font-semibold" : ""}>{t.label}</span>
              {active && (
                <span className="absolute -bottom-0 w-8 h-1 rounded-full" style={{ background: "linear-gradient(90deg, #0EA5E9, #8B5CF6)" }} />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
