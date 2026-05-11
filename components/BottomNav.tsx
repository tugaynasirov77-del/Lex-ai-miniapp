"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Команда", icon: "👥" },
  { href: "/projects", label: "Проекты", icon: "📁" },
  { href: "/history", label: "История", icon: "🕓" },
  { href: "/analytics", label: "Аналитика", icon: "📈" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-bg/80 border-t border-border">
      <div className="max-w-xl mx-auto grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center py-2.5 text-[11px] font-medium ${active ? "text-accent" : "text-muted"}`}
            >
              <span className="text-lg leading-none mb-1">{t.icon}</span>
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
