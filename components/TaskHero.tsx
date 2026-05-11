"use client";
import { useState } from "react";

const TAGS = [
  { emoji: "✍️", label: "Написать пост" },
  { emoji: "🔍", label: "Анализ" },
  { emoji: "💻", label: "Код" },
  { emoji: "📊", label: "Стратегия" },
];

const ORCHESTRATOR = "orkestrator1_bot";

function openOrchestrator(text: string) {
  if (text && navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  const url = `https://t.me/${ORCHESTRATOR}`;
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, "_blank");
}

export default function TaskHero() {
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    openOrchestrator(text.trim());
  };

  return (
    <section className="px-4 mt-3 animate-fade-up" style={{ animationDelay: "60ms" }}>
      <div className="glass rounded-2xl p-4 shadow-glow">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="Какую задачу решаем сегодня?"
            className="flex-1 bg-transparent outline-none placeholder:text-white/40 text-[15px] py-1"
          />
          <button
            onClick={submit}
            aria-label="Отправить задачу"
            className="w-10 h-10 rounded-xl bg-accent-grad flex items-center justify-center shadow-glow active:scale-95 transition-transform"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 12L21 4L13 22L11 13L3 12Z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
          {TAGS.map((t) => (
            <button
              key={t.label}
              onClick={() => setText(t.label)}
              className="shrink-0 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/80 hover:bg-white/10 active:scale-95 transition"
            >
              <span className="mr-1">{t.emoji}</span>{t.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-white/40 mt-2 px-1">→ Задача уходит Андрею-Оркестратору</p>
    </section>
  );
}
