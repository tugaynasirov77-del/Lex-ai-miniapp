"use client";

import { useState } from "react";
import Header from "./Header";
import { tgFetch, hapticImpact, hapticNotify } from "../lib/telegram";

type AgentKey = "milena" | "alexander" | "alina" | "mikhail" | "nikolay" | "viktor" | "arkadiy";

type CouncilResponse = {
  agent_id: AgentKey;
  agent_name: string;
  agent_role: string;
  answer: string;
  error?: string;
};

const AGENT_META: Record<AgentKey, { color: string; avatar: string }> = {
  milena:    { color: "#f59e0b", avatar: "/agents/milena.jpg" },
  alexander: { color: "#7dd3fc", avatar: "/agents/alexander.jpg" },
  alina:     { color: "#f0a020", avatar: "/agents/alina.jpg" },
  mikhail:   { color: "#22d3a5", avatar: "/agents/mikhail.jpg" },
  nikolay:   { color: "#a98cff", avatar: "/agents/nikolay.jpg" },
  viktor:    { color: "#ef4444", avatar: "/agents/viktor.jpg" },
  arkadiy:   { color: "#e5e5e5", avatar: "/agents/arkadiy.jpg" },
};

const EXAMPLES = [
  "Стоит ли запускать платную подписку через TG Stars?",
  "Как раскачать канал на 10к подписчиков за 60 дней?",
  "Нужно ли продавать рекламу или лучше свои продукты?",
  "Что улучшить в моём контент-плане на следующий месяц?",
];

export default function HomeScreen() {
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
      <Header
        title="Консилиум"
        accent={result ? String(result.responses.length) : "AI"}
        subtitle="мнения команды на один вопрос"
      />

      <div className="px-5 pb-24 space-y-4">
        <div className="glass rounded-xl p-3 space-y-3">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Задай вопрос — команда соберётся и ответит с разных сторон. Например: «стоит ли закрыть канал и запустить новый»."
            rows={4}
            className="w-full bg-white/5 text-ink text-sm px-3 py-2.5 rounded-md outline-none resize-none placeholder:text-muted/60"
            maxLength={1500}
          />
          <div className="text-right text-[10px] text-muted -mt-1">{question.length}/1500</div>
          <button
            onClick={() => ask()}
            disabled={loading || question.trim().length < 5}
            className="w-full py-3 rounded-xl font-bold text-[12px] tracking-[0.08em] uppercase active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(135deg, #FFC830 0%, #F0A020 35%, #E06020 70%, #C04020 100%)",
              color: "#0A0705",
              boxShadow:
                "0 0 18px rgba(255,200,48,0.3), 0 4px 14px rgba(240,96,32,0.25), 0 0 0 1px rgba(255,210,80,0.25) inset, 0 1px 0 rgba(255,255,255,0.25) inset",
              textShadow: "0 1px 0 rgba(255,255,255,0.3)",
            }}
          >
            {loading ? "собираю команду…" : "созвать консилиум"}
          </button>
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
            <p>команда совещается — 5–15 секунд</p>
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
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-white/10" style={{ boxShadow: `0 0 0 2px ${meta.color}33` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={meta.avatar} alt={r.agent_name} className="w-full h-full object-cover" />
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
