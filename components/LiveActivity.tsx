"use client";
import { useEffect, useRef, useState } from "react";
import { AGENT_DEFS, type AgentKey } from "../lib/agents";
import { getAgent } from "../lib/mockData";

type Stage = "received" | "routing" | "working" | "done" | "error";

interface State {
  task: string;
  stage: Stage;
  agentId?: AgentKey;
  reasoning?: string;
  reply?: string;
  error?: string;
  progress: number;
}

const ANDREY = getAgent("andrey");

function Avatar({ src, alt, ring, size = 32 }: { src?: string; alt: string; ring?: string; size?: number }) {
  return (
    <div className="rounded-full shrink-0 p-[2px]" style={{ width: size, height: size, background: ring ?? "rgba(255,255,255,0.1)" }}>
      <div className="w-full h-full rounded-full overflow-hidden bg-bg">
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="w-full h-full object-cover" />
        )}
      </div>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center my-1" aria-hidden>
      <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
        <defs>
          <linearGradient id="conn-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6366F1" />
            <stop offset="1" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
        <path d="M7 1v10M2 8l5 5 5-5" stroke="url(#conn-grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function Dots({ color = "#3B82F6" }: { color?: string }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      <span className="w-1.5 h-1.5 rounded-full animate-typing" style={{ background: color, animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 rounded-full animate-typing" style={{ background: color, animationDelay: "150ms" }} />
      <span className="w-1.5 h-1.5 rounded-full animate-typing" style={{ background: color, animationDelay: "300ms" }} />
    </span>
  );
}

function StepCard({
  bg, border, shadow, glow, done, children, delay = 0,
}: {
  bg: string; border: string; shadow: string; glow: string;
  done?: boolean; children: React.ReactNode; delay?: number;
}) {
  return (
    <div className="relative rounded-2xl p-3.5 animate-fade-up overflow-hidden"
      style={{ background: bg, border: "1px solid rgba(255,255,255,0.06)", boxShadow: shadow, animationDelay: `${delay}ms`, opacity: done ? 0.65 : 1 }}>
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: border }} />
      <span aria-hidden className="absolute right-[-24px] top-[-24px] w-[140px] h-[140px] rounded-full" style={{ background: glow }} />
      <div className="relative pl-2">{children}</div>
    </div>
  );
}

function Check({ gradient = "linear-gradient(135deg, #10B981, #3B82F6)" }: { gradient?: string }) {
  return (
    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: gradient }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        <path d="M5 12l5 5L20 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function LiveActivity({
  task, onReset, setBusy,
}: { task: string | null; onReset: () => void; setBusy: (b: boolean) => void; }) {
  const [state, setState] = useState<State | null>(null);
  const progressTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!task) { setState(null); return; }
    let cancelled = false;
    const run = async () => {
      setBusy(true);
      setState({ task, stage: "received", progress: 0 });
      await new Promise((r) => setTimeout(r, 500));
      if (cancelled) return;
      let agentId: AgentKey; let reasoning: string;
      try {
        const res = await fetch("/api/orchestrate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task }) });
        if (!res.ok) throw new Error((await res.json()).error || "orchestrate failed");
        const data = await res.json();
        agentId = data.agentId; reasoning = data.reasoning;
      } catch (e: any) {
        setState((s) => s && { ...s, stage: "error", error: e.message || "Ошибка оркестратора" });
        setBusy(false); return;
      }
      if (cancelled) return;
      setState((s) => s && { ...s, stage: "routing", agentId, reasoning });
      await new Promise((r) => setTimeout(r, 900));
      if (cancelled) return;
      setState((s) => s && { ...s, stage: "working", progress: 0 });
      progressTimer.current = window.setInterval(() => {
        setState((s) => s && s.stage === "working" ? { ...s, progress: Math.min(s.progress + 4, 90) } : s);
      }, 200) as unknown as number;
      try {
        const res = await fetch("/api/agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ agentId, task }) });
        if (!res.ok) throw new Error((await res.json()).error || "agent failed");
        const data = await res.json();
        if (cancelled) return;
        if (progressTimer.current) window.clearInterval(progressTimer.current);
        setState((s) => s && { ...s, progress: 100 });
        await new Promise((r) => setTimeout(r, 300));
        setState((s) => s && { ...s, stage: "done", reply: data.reply, progress: 100 });
      } catch (e: any) {
        if (progressTimer.current) window.clearInterval(progressTimer.current);
        setState((s) => s && { ...s, stage: "error", error: e.message || "Ошибка агента" });
      } finally {
        setBusy(false);
      }
    };
    run();
    return () => { cancelled = true; if (progressTimer.current) window.clearInterval(progressTimer.current); };
  }, [task, setBusy]);

  if (!state) return null;

  const { stage, agentId, reasoning, reply, error, progress } = state;
  const agent = agentId ? AGENT_DEFS[agentId] : null;
  const agentMeta = agentId ? getAgent(agentId) : null;

  const step1Done = stage !== "received";
  const step2Visible = stage !== "received";
  const step3Visible = stage === "done" || stage === "error";

  return (
    <section className="px-4 mt-6 space-y-1 animate-fade-up">
      <div className="flex items-center justify-between mb-3">
        <span className="caption">В работе</span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(59,130,246,0.15)", color: "#3B82F6" }}>1 задача</span>
      </div>

      <StepCard
        bg="rgba(59,130,246,0.06)"
        border="linear-gradient(180deg, #3B82F6, #6366F1)"
        shadow="0 8px 32px rgba(59,130,246,0.15)"
        glow="radial-gradient(closest-side, rgba(99,102,241,0.18), transparent)"
        done={step1Done}
      >
        <div className="flex items-start gap-3">
          <Avatar src={ANDREY?.avatar} alt="Андрей" ring="linear-gradient(135deg, #3B82F6, #6366F1)" size={36} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-bold text-ink">Андрей</span>
              <span className="text-[11px] text-muted">· Оркестратор</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(59,130,246,0.18)", color: "#93C5FD", border: "1px solid rgba(59,130,246,0.35)" }}>ПРИНЯТО</span>
              {step1Done && <Check />}
            </div>
            <p className="text-[13px] text-muted mt-1 break-words">«{state.task}»</p>
            {!step1Done && (
              <p className="text-[13px] mt-1.5 flex items-center gap-1.5" style={{ color: "#93C5FD" }}>
                Анализирую<Dots />
              </p>
            )}
          </div>
        </div>
      </StepCard>

      {step2Visible && agent && <Connector />}

      {step2Visible && agent && (
        <StepCard
          bg="rgba(245,158,11,0.06)"
          border="linear-gradient(180deg, #F59E0B, #EF4444)"
          shadow="0 8px 32px rgba(245,158,11,0.12)"
          glow="radial-gradient(closest-side, rgba(245,158,11,0.18), transparent)"
          done={stage === "done"}
          delay={50}
        >
          <div className="flex items-start gap-3">
            <Avatar src={agentMeta?.avatar} alt={agent.name} ring="linear-gradient(135deg, #F59E0B, #EF4444)" size={36} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[14px] font-bold text-ink">Передаю {agent.name}</span>
                <span className="text-[11px] text-muted">· {agent.role}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.18)", color: "#FCD34D", border: "1px solid rgba(245,158,11,0.35)" }}>В РАБОТЕ</span>
              </div>
              {reasoning && <p className="text-[12px] text-muted mt-1">{reasoning}</p>}
              {stage === "working" && (
                <div className="flex items-center gap-2 mt-2.5">
                  <div className="relative flex-1 h-2 rounded-full overflow-hidden shimmer" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full transition-[width] duration-300 ease-out" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #F59E0B, #EF4444)" }} />
                  </div>
                  <span className="text-[12px] font-bold tnum w-9 text-right" style={{ color: "#FCD34D" }}>{progress}%</span>
                </div>
              )}
            </div>
          </div>
        </StepCard>
      )}

      {step3Visible && <Connector />}

      {step3Visible && (
        <StepCard
          bg="rgba(16,185,129,0.06)"
          border="linear-gradient(180deg, #10B981, #3B82F6)"
          shadow="0 8px 32px rgba(16,185,129,0.14)"
          glow="radial-gradient(closest-side, rgba(16,185,129,0.18), transparent)"
          delay={120}
        >
          {stage === "done" && reply ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Check />
                <span className="text-[14px] font-bold text-ink">Готово</span>
                {agent && <span className="text-[12px] text-muted">· {agent.name}</span>}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto" style={{ background: "rgba(16,185,129,0.18)", color: "#6EE7B7", border: "1px solid rgba(16,185,129,0.35)" }}>РЕЗУЛЬТАТ</span>
              </div>
              <div className="rounded-xl p-3 text-[14px] leading-relaxed text-ink whitespace-pre-wrap break-words" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(16,185,129,0.15)" }}>
                {reply}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  onClick={() => reply && navigator.clipboard.writeText(reply).catch(() => {})}
                  className="rounded-xl px-3 py-2.5 text-[13px] font-semibold text-ink"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(16,185,129,0.3)" }}
                >Скопировать</button>
                <button
                  onClick={onReset}
                  className="rounded-xl px-3 py-2.5 text-[13px] font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #10B981, #3B82F6)", boxShadow: "0 4px 14px rgba(16,185,129,0.4)" }}
                >Новая задача</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg, #F43F5E, #F59E0B)" }}>!</span>
                <span className="text-[14px] font-bold text-ink">Что-то пошло не так</span>
              </div>
              <p className="text-[13px] text-muted">{error}</p>
              <button onClick={onReset} className="mt-3 text-[12px] font-bold" style={{ color: "#3B82F6" }}>← Попробовать ещё раз</button>
            </>
          )}
        </StepCard>
      )}
    </section>
  );
}
