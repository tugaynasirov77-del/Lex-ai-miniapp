"use client";
import { useEffect, useRef, useState } from "react";
import { AGENT_DEFS, type AgentKey } from "../lib/agents";
import { getAgent } from "../lib/mockData";
import { AGENT_THEME, type AgentId } from "../lib/agentTheme";

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

function StepCard({
  bg,
  border,
  shadow,
  glow,
  done,
  children,
  delay = 0,
}: {
  bg: string;
  border: string;
  shadow: string;
  glow: string;
  done?: boolean;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <div
      className="relative rounded-2xl p-3.5 animate-fade-up overflow-hidden"
      style={{ background: bg, border: "1px solid rgba(0,0,0,0.04)", boxShadow: shadow, animationDelay: `${delay}ms`, opacity: done ? 0.7 : 1 }}
    >
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: border }} />
      <span aria-hidden className="absolute right-[-20px] top-[-20px] w-[140px] h-[140px] rounded-full" style={{ background: glow }} />
      <div className="relative pl-2">{children}</div>
    </div>
  );
}

function Connector({ from = "#0EA5E9", to = "#8B5CF6" }: { from?: string; to?: string }) {
  return (
    <div className="flex justify-center py-1.5" aria-hidden>
      <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
        <defs>
          <linearGradient id={`grad-${from.slice(1)}-${to.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
        <path d="M7 1v12M2 9l5 5 5-5" stroke={`url(#grad-${from.slice(1)}-${to.slice(1)})`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function Dots() {
  return (
    <span className="inline-flex items-center gap-1 ml-1" aria-hidden>
      <span className="w-1.5 h-1.5 rounded-full animate-typing" style={{ background: "linear-gradient(135deg, #0EA5E9, #8B5CF6)", animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 rounded-full animate-typing" style={{ background: "linear-gradient(135deg, #0EA5E9, #8B5CF6)", animationDelay: "150ms" }} />
      <span className="w-1.5 h-1.5 rounded-full animate-typing" style={{ background: "linear-gradient(135deg, #0EA5E9, #8B5CF6)", animationDelay: "300ms" }} />
    </span>
  );
}

function Check({ gradient = "linear-gradient(135deg, #10B981, #0EA5E9)" }: { gradient?: string }) {
  return (
    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: gradient }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        <path d="M5 12l5 5L20 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function GradAvatar({ src, alt, ringFrom, ringTo, size = 40 }: { src?: string; alt: string; ringFrom: string; ringTo: string; size?: number }) {
  return (
    <div className="rounded-full shrink-0 p-[2px]" style={{ width: size, height: size, background: `linear-gradient(135deg, ${ringFrom}, ${ringTo})` }}>
      <div className="w-full h-full rounded-full overflow-hidden bg-white">
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="w-full h-full object-cover" />
        )}
      </div>
    </div>
  );
}

function EmptyIllustration() {
  return (
    <svg width="78" height="42" viewBox="0 0 78 42" fill="none" aria-hidden className="mx-auto opacity-80">
      <defs>
        <linearGradient id="empty-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0EA5E9"/>
          <stop offset="1" stopColor="#8B5CF6"/>
        </linearGradient>
      </defs>
      <circle cx="14" cy="16" r="6" stroke="#CBD5E1" strokeWidth="1.5"/>
      <path d="M4 36c0-4 4.5-7 10-7s10 3 10 7" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="39" cy="14" r="7" stroke="url(#empty-grad)" strokeWidth="1.6"/>
      <path d="M27 36c0-4.5 5.5-8 12-8s12 3.5 12 8" stroke="url(#empty-grad)" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="64" cy="16" r="6" stroke="#CBD5E1" strokeWidth="1.5"/>
      <path d="M54 36c0-4 4.5-7 10-7s10 3 10 7" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export default function LiveActivity({
  task,
  onReset,
  setBusy,
}: {
  task: string | null;
  onReset: () => void;
  setBusy: (b: boolean) => void;
}) {
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

  if (!state) {
    return (
      <section className="px-4 mt-4 animate-fade-up">
        <div className="rounded-2xl p-6 text-center"
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.6), rgba(239,246,255,0.6))", border: "1.5px dashed rgba(99,102,241,0.25)" }}>
          <EmptyIllustration />
          <p className="text-[14px] text-muted mt-3">Введи задачу выше — команда сразу приступит</p>
        </div>
      </section>
    );
  }

  const { stage, agentId, reasoning, reply, error, progress } = state;
  const agent = agentId ? AGENT_DEFS[agentId] : null;
  const agentMeta = agentId ? getAgent(agentId) : null;
  const agentTheme = agentId ? AGENT_THEME[agentId as AgentId] : null;
  const andreyTheme = AGENT_THEME.andrey;

  const step1Done = stage !== "received";
  const step2Visible = stage !== "received";
  const step2Done = stage === "working" || stage === "done";
  const step3Visible = stage === "done" || stage === "error";

  return (
    <section className="px-4 mt-4 space-y-1 animate-fade-up">
      {/* Step 1 — Blue→Purple DNA */}
      <StepCard
        bg="linear-gradient(135deg, #FFFFFF, #EFF6FF, #F5F3FF)"
        border="linear-gradient(180deg, #0EA5E9, #8B5CF6)"
        shadow="0 8px 24px rgba(139,92,246,0.12)"
        glow="radial-gradient(closest-side, rgba(139,92,246,0.18), transparent)"
        done={step1Done}
      >
        <div className="flex items-start gap-3">
          <GradAvatar src={ANDREY?.avatar} alt="Андрей" ringFrom={andreyTheme.ringFrom} ringTo={andreyTheme.ringTo} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-bold text-ink">Андрей</span>
              <span className="text-[11px] text-muted">· Оркестратор</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(14,165,233,0.12)", color: "#0EA5E9", border: "1px solid rgba(14,165,233,0.25)" }}>ПРИНЯТО</span>
              {step1Done && <Check />}
            </div>
            <p className="text-[13px] text-muted mt-1 break-words">«{state.task}»</p>
            {!step1Done && (
              <p className="text-[13px] mt-1 flex items-center grad-text font-medium" style={{ backgroundImage: "linear-gradient(90deg, #0EA5E9, #8B5CF6)" }}>
                Принял задачу, анализирую<Dots />
              </p>
            )}
          </div>
        </div>
      </StepCard>

      {step2Visible && agent && <Connector from="#8B5CF6" to="#F59E0B" />}

      {/* Step 2 — Amber DNA */}
      {step2Visible && agent && agentTheme && (
        <StepCard
          bg="linear-gradient(135deg, #FFFFFF, #FFFBEB, #FEF3C7)"
          border="linear-gradient(180deg, #F59E0B, #EF4444)"
          shadow="0 8px 24px rgba(245,158,11,0.14)"
          glow="radial-gradient(closest-side, rgba(245,158,11,0.18), transparent)"
          done={stage === "done"}
          delay={50}
        >
          <div className="flex items-start gap-3">
            <GradAvatar src={agentMeta?.avatar} alt={agent.name} ringFrom={agentTheme.ringFrom} ringTo={agentTheme.ringTo} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[14px] font-bold text-ink">Передаю {agent.name}</span>
                <span className="text-[11px] text-muted">· {agent.role}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.14)", color: "#B45309", border: "1px solid rgba(245,158,11,0.3)" }}>В РАБОТЕ</span>
              </div>
              {reasoning && <p className="text-[12px] text-muted mt-1">{reasoning}</p>}
              {stage === "working" && (
                <div className="flex items-center gap-2 mt-2.5">
                  <div className="relative flex-1 h-2 rounded-full overflow-hidden shimmer" style={{ background: "rgba(0,0,0,0.05)" }}>
                    <div className="h-full rounded-full transition-[width] duration-300 ease-out" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #F59E0B, #EF4444)" }} />
                  </div>
                  <span className="text-[12px] font-bold tnum w-9 text-right grad-text" style={{ backgroundImage: "linear-gradient(90deg, #F59E0B, #EF4444)" }}>{progress}%</span>
                </div>
              )}
              {stage === "done" && <p className="text-[12px] text-muted mt-1">Готово</p>}
            </div>
          </div>
        </StepCard>
      )}

      {step3Visible && <Connector from="#F59E0B" to="#10B981" />}

      {/* Step 3 — Emerald DNA result */}
      {step3Visible && (
        <StepCard
          bg="linear-gradient(135deg, #FFFFFF, #F0FDF4, #DCFCE7)"
          border="linear-gradient(180deg, #10B981, #0EA5E9)"
          shadow="0 8px 24px rgba(16,185,129,0.14)"
          glow="radial-gradient(closest-side, rgba(16,185,129,0.18), transparent)"
          delay={120}
        >
          {stage === "done" && reply ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Check />
                <span className="text-[14px] font-bold text-ink">Готово</span>
                {agent && <span className="text-[12px] text-muted">· {agent.name}</span>}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto" style={{ background: "rgba(16,185,129,0.14)", color: "#047857", border: "1px solid rgba(16,185,129,0.3)" }}>РЕЗУЛЬТАТ</span>
              </div>
              <div className="rounded-xl bg-white/70 p-3 text-[14px] leading-relaxed text-ink whitespace-pre-wrap break-words" style={{ border: "1px solid rgba(16,185,129,0.15)" }}>
                {reply}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  onClick={() => reply && navigator.clipboard.writeText(reply).catch(() => {})}
                  className="rounded-xl px-3 py-2.5 text-[13px] font-semibold text-ink"
                  style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(16,185,129,0.25)" }}
                >Скопировать</button>
                <button
                  onClick={onReset}
                  className="rounded-xl px-3 py-2.5 text-[13px] font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #10B981, #0EA5E9)", boxShadow: "0 4px 14px rgba(16,185,129,0.35)" }}
                >Новая задача</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg, #EF4444, #F59E0B)" }}>!</span>
                <span className="text-[14px] font-bold text-ink">Что-то пошло не так</span>
              </div>
              <p className="text-[13px] text-muted">{error}</p>
              <button onClick={onReset} className="mt-3 text-[12px] font-bold grad-text" style={{ backgroundImage: "linear-gradient(90deg, #0EA5E9, #8B5CF6)" }}>← Попробовать ещё раз</button>
            </>
          )}
        </StepCard>
      )}
    </section>
  );
}
