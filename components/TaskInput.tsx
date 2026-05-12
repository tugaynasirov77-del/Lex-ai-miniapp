"use client";
import { useState } from "react";
import Section from "./Section";

const TAGS = [
  { emoji: "✍️", label: "Написать", prefix: "Напиши пост для канала про " },
  { emoji: "🔍", label: "Анализ", prefix: "Проанализируй конкурентов в нише " },
  { emoji: "💻", label: "Код", prefix: "Напиши код для " },
  { emoji: "📊", label: "Стратегия", prefix: "Составь стратегию для " },
];

export default function TaskInput({ onSubmit, busy }: { onSubmit: (task: string) => void; busy: boolean }) {
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    onSubmit(t);
  };

  return (
    <Section tone="sky" caption="Новая задача" delay={40}>
      <h2 className="h1 mb-4">Какую задачу решаем?</h2>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 rounded-2xl border border-black/[0.08] bg-white px-4 py-3 flex items-center gap-2">
          <span className="text-base opacity-60">💬</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="Опиши задачу команде…"
            className="flex-1 bg-transparent outline-none placeholder:text-faint text-[14px] text-ink"
            disabled={busy}
          />
        </div>
        <button
          onClick={submit}
          disabled={busy || !text.trim()}
          aria-label="Отправить"
          className="w-12 h-12 rounded-full bg-sky flex items-center justify-center shadow-glowBtn shrink-0 disabled:opacity-40"
        >
          {busy ? (
            <svg width="18" height="18" viewBox="0 0 24 24" className="animate-spin">
              <circle cx="12" cy="12" r="9" stroke="white" strokeOpacity="0.35" strokeWidth="3" fill="none"/>
              <path d="M21 12a9 9 0 0 0-9-9" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {TAGS.map((t) => (
          <button
            key={t.label}
            onClick={() => setText(t.prefix)}
            disabled={busy}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-sky/40 text-sky text-[13px] font-medium bg-white hover:bg-sky/5 disabled:opacity-40"
          >
            <span>{t.emoji}</span>{t.label}
          </button>
        ))}
      </div>
    </Section>
  );
}
