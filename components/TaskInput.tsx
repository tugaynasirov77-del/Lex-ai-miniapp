"use client";
import { useState } from "react";
import { IconPen, IconSearch, IconCode, IconChart, IconChat, IconClock } from "./Icons";

const TAGS = [
  { Icon: IconPen, label: "Написать", prefix: "Напиши пост для канала про ", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)", color: "#93C5FD" },
  { Icon: IconSearch, label: "Анализ", prefix: "Проанализируй конкурентов в нише ", bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.3)", color: "#A5B4FC" },
  { Icon: IconCode, label: "Код", prefix: "Напиши код для ", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", color: "#FCD34D" },
  { Icon: IconChart, label: "Стратегия", prefix: "Составь стратегию для ", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", color: "#6EE7B7" },
];

const RECENT = ["Анализ конкурентов", "Контент-план", "Код бота"];

export default function TaskInput({ onSubmit, busy }: { onSubmit: (task: string) => void; busy: boolean }) {
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    onSubmit(t);
  };

  return (
    <section className="px-4 mt-4 animate-fade-up" style={{ animationDelay: "40ms" }}>
      <h2 className="h1 mb-3">Какую задачу решаем?</h2>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
        {RECENT.map((r) => (
          <button
            key={r}
            onClick={() => setText(r)}
            disabled={busy}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#94A3B8" }}
          >
            <span className="opacity-70"><IconClock size={11} /></span>{r}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 rounded-2xl px-4 py-3 flex items-center gap-2 min-w-0"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(59,130,246,0.3)", boxShadow: "0 0 20px rgba(59,130,246,0.10) inset" }}>
          <span className="shrink-0" style={{ color: "#3B82F6" }}><IconChat size={16} /></span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="Опиши задачу команде…"
            dir="auto"
            className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-ink"
            style={{ caretColor: "#3B82F6" }}
            disabled={busy}
          />
        </div>
        <button
          onClick={submit}
          disabled={busy || !text.trim()}
          aria-label="Отправить"
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #3B82F6, #6366F1)", boxShadow: "0 4px 15px rgba(59,130,246,0.4)" }}
        >
          {busy ? (
            <svg width="16" height="16" viewBox="0 0 24 24" className="animate-spin">
              <circle cx="12" cy="12" r="9" stroke="white" strokeOpacity="0.35" strokeWidth="3" fill="none"/>
              <path d="M21 12a9 9 0 0 0-9-9" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold disabled:opacity-40"
            style={{ background: t.bg, border: `1px solid ${t.border}`, color: t.color }}
          >
            <t.Icon size={13} />{t.label}
          </button>
        ))}
      </div>
    </section>
  );
}
