"use client";
import SectionLabel from "./SectionLabel";

const ACTIONS = [
  { emoji: "🚀", label: "Новый проект" },
  { emoji: "📋", label: "Контент-план" },
  { emoji: "🔍", label: "Анализ конкурентов" },
];

const ORCHESTRATOR = "orkestrator1_bot";

function open(label: string) {
  if (navigator.clipboard) navigator.clipboard.writeText(label).catch(() => {});
  const url = `https://t.me/${ORCHESTRATOR}`;
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, "_blank");
}

export default function QuickActions() {
  return (
    <section className="mt-8 animate-fade-up" style={{ animationDelay: "320ms" }}>
      <SectionLabel>Быстрые действия</SectionLabel>
      <div className="px-5 grid grid-cols-1 gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.label}
            onClick={() => open(a.label)}
            className="glass glass-hover rounded-2xl p-3.5 flex items-center gap-3 text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-border flex items-center justify-center text-base">{a.emoji}</div>
            <span className="text-[14px] font-medium flex-1">{a.label}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="opacity-40">
              <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ))}
      </div>
    </section>
  );
}
