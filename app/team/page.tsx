"use client";

import { useState } from "react";
import Header from "../../components/Header";
import { tgFetch, hapticImpact, hapticNotify } from "../../lib/telegram";

type AgentKey = "milena" | "alexander" | "alina" | "mikhail" | "nikolay" | "viktor" | "arkadiy";

type CouncilResponse = {
  agent_id: AgentKey;
  agent_name: string;
  agent_role: string;
  answer: string;
  error?: string;
};

const AGENT_META: Record<AgentKey, { color: string; bg: string; emoji: string }> = {
  milena:    { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.10)",  emoji: "📣" },
  alexander: { color: "#7dd3fc", bg: "rgba(125, 211, 252, 0.10)", emoji: "♟️" },
  alina:     { color: "#f0a020", bg: "rgba(240, 160, 32, 0.10)",  emoji: "✍️" },
  mikhail:   { color: "#22d3a5", bg: "rgba(34, 211, 165, 0.10)",  emoji: "💻" },
  nikolay:   { color: "#a98cff", bg: "rgba(124, 92, 252, 0.12)",  emoji: "📊" },
  viktor:    { color: "#ef4444", bg: "rgba(239, 68, 68, 0.10)",   emoji: "🤝" },
  arkadiy:   { color: "#e5e5e5", bg: "rgba(255, 255, 255, 0.06)", emoji: "🔍" },
};

const EXAMPLES = [
  "Стоит ли запускать платную подписку через TG Stars?",
  "Как раскачать канал на 10к подписчиков за 60 дней?",
  "Нужно ли продавать рекламу в канале или лучше свои продукты?",
  "Что улучшить в моём контент-плане на следующий месяц?",
];

export default function TeamPage() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ responses: CouncilResponse[]; selected: AgentKey[] } | null>(null);

  const ask = async (q?: string) => {
    const text = (q ?? question).trim();
    if (text.length < 5) {
      setError("Вопрос слишком короткий");
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    hapticImpact("medium");
    try {
      const r = await tgFetch(`/api/council`, {
        method: "POST",
        body: JSON.stringify({ question: text }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "консилиум не отвечает");
      setResult({ responses: d.responses ?? [], selected: d.selected_agents ?? [] });
      hapticNotify("success");
    } catch (e: any) {
      setError(e.message);
      hapticNotify("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header title="Консилиум" accent={result ? `${result.responses.length}` : "AI"} subtitle="мнения команды на один вопрос" />

      <div className="px-5 pb-24 space-y-4">
        <div className="glass rounded-xl p-3 space-y-2.5">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Задай вопрос — команда соберётся и ответит с разных сторон. Например: «стоит ли мне закрыть канал и запустить новый»."
            rows={4}
            className="w-full bg-white/5 text-ink text-sm px-3 py-2.5 rounded-md outline-none resize-none placeholder:text-muted/60"
            maxLength={1500}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted">{question.length}/1500</span>
            <button
              onClick={() => ask()}
              disabled={loading || question.trim().length < 5}
              className="text-xs px-4 py-2 rounded-md font-medium disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #F0A020, #D05020)", color: "#0A0705" }}
            >
              {loading ? "собираю команду…" : "созвать консилиум"}
            </button>
          </div>
          {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
        </div>

        {!result && !loading && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted uppercase tracking-wider px-1">примеры</p>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setQuestion(ex);
                  ask(ex);
                }}
                className="block w-full text-left text-[12px] text-ink/85 glass rounded-lg px-3 py-2.5 active:scale-[0.99] transition-transform"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="py-6 text-center text-sm text-muted space-y-2">
            <div className="text-2xl animate-pulse">💭</div>
            <p>команда совещается — это 5–15 секунд</p>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="text-[11px] text-muted px-1">
              ответили: {result.responses.map((r) => r.agent_name).join(", ")}
            </div>
            {result.responses.map((r) => {
              const meta = AGENT_META[r.agent_id];
              return (
                <div key={r.agent_id} className="glass rounded-xl p-3.5 space-y-2" style={{ borderLeft: `3px solid ${meta.color}` }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg" style={{ background: meta.bg }}>
                      {meta.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink">{r.agent_name}</div>
                      <div className="text-[11px] text-muted">{r.agent_role}</div>
                    </div>
                  </div>
                  {r.error ? (
                    <p className="text-[12px]" style={{ color: "#ef4444" }}>не ответил: {r.error}</p>
                  ) : (
                    <p className="text-[13px] text-ink/90 leading-relaxed whitespace-pre-wrap">{r.answer}</p>
                  )}
                </div>
              );
            })}
            <button
              onClick={() => {
                setResult(null);
                setQuestion("");
              }}
              className="w-full text-[11px] py-2 rounded-md font-medium text-muted active:opacity-70"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              задать новый вопрос
            </button>
          </div>
        )}
      </div>
    </>
  );
}
