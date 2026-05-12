"use client";
import { useState } from "react";

const TAGS = [
  { emoji: "✍️", label: "Контент", prefix: "Напиши пост для канала про " },
  { emoji: "🔍", label: "Анализ", prefix: "Проанализируй конкурентов в нише " },
  { emoji: "💻", label: "Код", prefix: "Напиши код для " },
  { emoji: "📊", label: "Стратегия", prefix: "Составь стратегию для " },
];

const ORCHESTRATOR = "orkestrator1_bot";

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function openOrchestrator(text: string) {
  const trimmed = text.trim();
  if (trimmed && navigator.clipboard) navigator.clipboard.writeText(trimmed).catch(() => {});
  const payload = trimmed ? toBase64Url(trimmed) : "";
  // Telegram limits start param to 64 chars, alphanum + _ -. Skip if longer.
  const useStart = payload && payload.length <= 64;
  const url = useStart
    ? `https://t.me/${ORCHESTRATOR}?start=${payload}`
    : `https://t.me/${ORCHESTRATOR}`;
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, "_blank");
}

export default function TaskHero() {
  const [text, setText] = useState("");
  const submit = () => { if (text.trim()) openOrchestrator(text.trim()); };

  return (
    <section className="px-5 pt-6 animate-fade-up" style={{ animationDelay: "40ms" }}>
      <h2 className="h1 mb-4">Какую задачу<br/>решаем сегодня?</h2>
      <div className="glass glass-hover rounded-2xl p-2 pl-4 flex items-center gap-2">
        <span className="text-base opacity-60">💬</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Опиши задачу команде…"
          className="flex-1 bg-transparent outline-none placeholder:text-white/30 text-[15px] py-2.5"
        />
        <button
          onClick={submit}
          aria-label="Отправить"
          className="w-10 h-10 rounded-xl bg-accentGrad flex items-center justify-center shadow-glowBtn hover:shadow-[0_4px_22px_rgba(110,86,207,0.55)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
        {TAGS.map((t) => (
          <button
            key={t.label}
            onClick={() => setText(t.prefix)}
            className="shrink-0 px-3 py-1.5 rounded-full glass text-xs text-ink/80 hover:border-accent/40"
          >
            <span className="mr-1">{t.emoji}</span>{t.label}
          </button>
        ))}
      </div>
    </section>
  );
}
