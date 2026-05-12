"use client";
import { useState } from "react";
import { IconPen, IconSearch, IconCode, IconChart, IconChat, IconClock, IconSparkle } from "./Icons";

const TAGS = [
  { Icon: IconPen, label: "Написать", prefix: "Напиши пост для канала про ", bg: "linear-gradient(135deg, #EFF6FF, #F0FDF4)", border: "#BAE6FD", color: "#0369A1" },
  { Icon: IconSearch, label: "Анализ", prefix: "Проанализируй конкурентов в нише ", bg: "linear-gradient(135deg, #F5F3FF, #EEF2FF)", border: "#C4B5FD", color: "#6D28D9" },
  { Icon: IconCode, label: "Код", prefix: "Напиши код для ", bg: "linear-gradient(135deg, #FFFBEB, #FEF3C7)", border: "#FDE68A", color: "#B45309" },
  { Icon: IconChart, label: "Стратегия", prefix: "Составь стратегию для ", bg: "linear-gradient(135deg, #F0FDF4, #DCFCE7)", border: "#A7F3D0", color: "#047857" },
];

const RECENT = ["Анализ конкурентов", "Контент-план", "Код Telegram бота"];

export default function TaskInput({ onSubmit, busy }: { onSubmit: (task: string) => void; busy: boolean }) {
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    onSubmit(t);
  };

  return (
    <section className="px-4 mt-4 animate-fade-up" style={{ animationDelay: "40ms" }}>
      <div
        className="relative rounded-2xl p-4 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #FFFFFF 0%, #EFF6FF 60%, #F5F3FF 100%)",
          border: "1px solid rgba(186,230,253,0.5)",
          boxShadow: "0 8px 24px rgba(14,165,233,0.12)",
        }}
      >
        <div aria-hidden className="absolute right-[-30px] top-[-30px] w-[180px] h-[180px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(139,92,246,0.18), transparent)" }} />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-2.5" style={{ background: "linear-gradient(90deg, rgba(14,165,233,0.12), rgba(139,92,246,0.12))", border: "1px solid rgba(14,165,233,0.25)" }}>
            <span style={{ color: "#0EA5E9" }}><IconSparkle size={12} /></span>
            <span className="text-[10px] font-bold tracking-[1.2px] uppercase grad-text" style={{ backgroundImage: "linear-gradient(90deg, #0EA5E9, #8B5CF6)" }}>Новая задача</span>
          </div>
          <h2 className="h1 mb-4 grad-text" style={{ backgroundImage: "linear-gradient(90deg, #0EA5E9, #8B5CF6)" }}>Какую задачу решаем?</h2>

          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 rounded-2xl bg-white px-4 py-3 flex items-center gap-2 min-w-0"
              style={{ border: "1px solid rgba(186,230,253,0.6)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)" }}>
              <span className="shrink-0" style={{ color: "#0EA5E9" }}><IconChat size={16} /></span>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                placeholder="Опиши задачу команде…"
                dir="auto"
                className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-faint text-[14px] text-ink"
                style={{ caretColor: "#0EA5E9" }}
                disabled={busy}
              />
            </div>
            <button
              onClick={submit}
              disabled={busy || !text.trim()}
              aria-label="Отправить"
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #0EA5E9, #8B5CF6)", boxShadow: "0 4px 15px rgba(139,92,246,0.35)" }}
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

          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
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

          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {RECENT.map((r) => (
              <button
                key={r}
                onClick={() => setText(r)}
                disabled={busy}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] text-muted disabled:opacity-40"
                style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(186,230,253,0.55)" }}
              >
                <span className="opacity-60"><IconClock size={11} /></span>{r}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
