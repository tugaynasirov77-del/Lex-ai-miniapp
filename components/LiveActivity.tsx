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

function StepCard({
  borderColor,
  done,
  active,
  children,
  delay = 0,
}: {
  borderColor: string;
  done?: boolean;
  active?: boolean;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <div
      className={`relative bg-white rounded-2xl p-3.5 animate-fade-up border border-black/[0.06] overflow-hidden ${done ? "opacity-70" : ""}`}
      style={{
        animationDelay: `${delay}ms`,
        boxShadow: active ? "0 4px 18px rgba(0,0,0,0.08)" : "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: borderColor }} />
      {children}
    </div>
  );
}

function Dots() {
  return (
    <span className="inline-flex items-center gap-1 ml-1" aria-hidden>
      <span className="w-1 h-1 rounded-full bg-sky animate-typing" style={{ animationDelay: "0ms" }} />
      <span className="w-1 h-1 rounded-full bg-sky animate-typing" style={{ animationDelay: "150ms" }} />
      <span className="w-1 h-1 rounded-full bg-sky animate-typing" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

function Check({ color = "#10B981" }: { color?: string }) {
  return (
    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: color }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        <path d="M5 12l5 5L20 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Avatar({ src, alt, size = 36 }: { src?: string; alt: string; size?: number }) {
  return (
    <div className="rounded-full overflow-hidden bg-bg shrink-0" style={{ width: size, height: size }}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      )}
    </div>
  );
}

function ConnectorDown() {
  return (
    <div className="flex justify-center py-1" aria-hidden>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M6 13l6 6 6-6" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function EmptyTeam() {
  return (
    <svg width="78" height="42" viewBox="0 0 78 42" fill="none" aria-hidden className="mx-auto">
      <circle cx="14" cy="16" r="6" stroke="#9CA3AF" strokeWidth="1.5"/>
      <path d="M4 36c0-4 4.5-7 10-7s10 3 10 7" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="39" cy="14" r="7" stroke="#0EA5E9" strokeWidth="1.6"/>
      <path d="M27 36c0-4.5 5.5-8 12-8s12 3.5 12 8" stroke="#0EA5E9" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="64" cy="16" r="6" stroke="#9CA3AF" strokeWidth="1.5"/>
      <path d="M54 36c0-4 4.5-7 10-7s10 3 10 7" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
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
    if (!task) {
      setState(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setBusy(true);
      setState({ task, stage: "received", progress: 0 });
      await new Promise((r) => setTimeout(r, 500));
      if (cancelled) return;

      let agentId: AgentKey;
      let reasoning: string;
      try {
        const res = await fetch("/api/orchestrate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ task }),
        });
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
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ agentId, task }),
        });
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
    return () => {
      cancelled = true;
      if (progressTimer.current) window.clearInterval(progressTimer.current);
    };
  }, [task, setBusy]);

  // Empty state
  if (!state) {
    return (
      <section className="px-4 mt-4 animate-fade-up">
        <div className="rounded-2xl border-2 border-dashed border-black/10 bg-white/40 p-6 text-center">
          <EmptyTeam />
          <p className="text-[14px] text-muted mt-3">Введи задачу выше — команда сразу приступит</p>
        </div>
      </section>
    );
  }

  const { stage, agentId, reasoning, reply, error, progress } = state;
  const agent = agentId ? AGENT_DEFS[agentId] : null;
  const agentAvatar = agentId ? getAgent(agentId)?.avatar : undefined;

  const step1Done = stage !== "received";
  const step2Visible = stage !== "received";
  const step2Done = stage === "working" || stage === "done";
  const step3Visible = stage === "working" || stage === "done";
  const step3Done = stage === "done";
  const step4Visible = stage === "done" || stage === "error";

  return (
    <section className="px-4 mt-4 space-y-2 animate-fade-up">
      {/* Step 1 — Andrey received */}
      <StepCard borderColor="#0EA5E9" active={!step1Done} done={step1Done}>
        <div className="flex items-start gap-3 pl-2">
          <Avatar src={ANDREY?.avatar} alt="Андрей" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-semibold text-ink">Андрей</span>
              <span className="text-[11px] text-muted">· Оркестратор</span>
              {step1Done && <Check />}
            </div>
            <p className="text-[13px] text-muted mt-0.5 break-words">«{state.task}»</p>
            {!step1Done && (
              <p className="text-[13px] text-sky mt-1 flex items-center">Принял задачу, анализирую<Dots /></p>
            )}
          </div>
        </div>
      </StepCard>

      {step2Visible && agent && <ConnectorDown />}

      {/* Step 2 — routing to agent */}
      {step2Visible && agent && (
        <StepCard borderColor="#F59E0B" active={stage === "routing" || stage === "working"} done={step2Done && stage !== "working"} delay={50}>
          <div className="flex items-start gap-3 pl-2">
            <Avatar src={agentAvatar} alt={agent.name} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[14px] font-semibold text-ink">Передаю {agent.name}</span>
                <span className="text-[11px] text-muted">· {agent.role}</span>
                {step2Done && stage !== "working" && <Check />}
              </div>
              {reasoning && <p className="text-[12px] text-muted mt-0.5">{reasoning}</p>}
              {stage === "working" && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 bg-black/[0.06] rounded-full overflow-hidden">
                    <div className="h-full bg-amber rounded-full transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-[12px] font-semibold text-amber tnum w-9 text-right">{progress}%</span>
                </div>
              )}
            </div>
          </div>
        </StepCard>
      )}

      {step3Visible && agent && <ConnectorDown />}

      {/* Step 3 — result */}
      {step4Visible && (
        <StepCard borderColor="#10B981" active delay={120}>
          <div className="pl-2">
            {stage === "done" && reply ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Check />
                  <span className="text-[14px] font-semibold text-ink">Готово</span>
                  {agent && <span className="text-[12px] text-muted">· {agent.name}</span>}
                </div>
                <div className="rounded-xl bg-bg border border-black/[0.06] p-3 text-[14px] leading-relaxed text-ink whitespace-pre-wrap break-words">
                  {reply}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => reply && navigator.clipboard.writeText(reply).catch(() => {})}
                    className="rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-[13px] font-semibold text-ink hover:border-sky/40"
                  >
                    Скопировать
                  </button>
                  <button
                    onClick={onReset}
                    className="rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-[13px] font-semibold text-ink hover:border-sky/40"
                  >
                    Новая задача
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-4 h-4 rounded-full bg-red flex items-center justify-center text-[10px] font-bold text-white">!</span>
                  <span className="text-[14px] font-semibold text-ink">Что-то пошло не так</span>
                </div>
                <p className="text-[13px] text-muted">{error}</p>
                <button onClick={onReset} className="mt-3 text-[12px] text-sky font-semibold">← Попробовать ещё раз</button>
              </>
            )}
          </div>
        </StepCard>
      )}
    </section>
  );
}
