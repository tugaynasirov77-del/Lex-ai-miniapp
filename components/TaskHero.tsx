"use client";
import { useState } from "react";
import Section from "./Section";

const TAGS = [
  {
    label: "Контент", prefix: "Напиши пост для канала про ",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M4 20l4-1.5L19.3 7.2a2 2 0 0 0 0-2.8l-.7-.7a2 2 0 0 0-2.8 0L4.5 15.5 4 20Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M14 5.5l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: "Анализ", prefix: "Проанализируй конкурентов в нише ",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: "Код", prefix: "Напиши код для ",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M9 8l-4 4 4 4M15 8l4 4-4 4M13 6l-2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: "Стратегия", prefix: "Составь стратегию для ",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M4 20V8M10 20V4M16 20v-9M22 20H2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
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
  const useStart = payload && payload.length <= 64;
  const url = useStart ? `https://t.me/${ORCHESTRATOR}?start=${payload}` : `https://t.me/${ORCHESTRATOR}`;
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, "_blank");
}

export default function TaskHero() {
  const [text, setText] = useState("");
  const submit = () => { if (text.trim()) openOrchestrator(text.trim()); };

  return (
    <Section number={1} title="Какую задачу решаем?" tone="purple" delay={40}>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="Опишите задачу или выберите направление…"
            className="w-full bg-transparent outline-none placeholder:text-white/30 text-[14px]"
          />
        </div>
        <button
          onClick={submit}
          aria-label="Отправить"
          className="w-12 h-12 rounded-2xl bg-accentGrad flex items-center justify-center shadow-glowBtn shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M3 12L21 4L13 22L11 13L3 12Z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {TAGS.map((t) => (
          <button
            key={t.label}
            onClick={() => setText(t.prefix)}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-white/10 bg-white/[0.03] text-[13px] text-ink hover:border-accent/40"
          >
            <span className="text-accent">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
    </Section>
  );
}
