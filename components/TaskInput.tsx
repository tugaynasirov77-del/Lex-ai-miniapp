"use client";
import { useState } from "react";
import Section from "./Section";

const TAGS = [
  { label: "Контент", prefix: "Напиши пост для канала про " },
  { label: "Анализ", prefix: "Проанализируй конкурентов в нише " },
  { label: "Код", prefix: "Напиши код для " },
  { label: "Стратегия", prefix: "Составь стратегию для " },
];

export default function TaskInput({ onSubmit, busy }: { onSubmit: (task: string) => void; busy: boolean }) {
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    onSubmit(t);
  };

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
            disabled={busy}
          />
        </div>
        <button
          onClick={submit}
          disabled={busy || !text.trim()}
          aria-label="Отправить"
          className="w-12 h-12 rounded-2xl bg-accentGrad flex items-center justify-center shadow-glowBtn shrink-0 disabled:opacity-40"
        >
          {busy ? (
            <svg width="18" height="18" viewBox="0 0 24 24" className="animate-spin">
              <circle cx="12" cy="12" r="9" stroke="white" strokeOpacity="0.3" strokeWidth="3" fill="none"/>
              <path d="M21 12a9 9 0 0 0-9-9" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 12L21 4L13 22L11 13L3 12Z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
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
            className="shrink-0 px-3.5 py-2 rounded-2xl border border-white/10 bg-white/[0.03] text-[13px] text-ink hover:border-accent/40 disabled:opacity-40"
          >
            {t.label}
          </button>
        ))}
      </div>
    </Section>
  );
}
