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
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="max-w-xl mx-auto grid grid-cols-4">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center py-2.5 text-xs transition-colors ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <span className="text-xl leading-none mb-1">{t.icon}</span>
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
