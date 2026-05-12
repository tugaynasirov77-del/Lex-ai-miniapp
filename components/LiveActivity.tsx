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

const ORCHESTRATOR = "orkestrator1_bot";
const ANDREY = getAgent("andrey");

function StepCard({
  active,
  done,
  children,
  delay = 0,
}: {
  active?: boolean;
  done?: boolean;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <div
      className={`relative rounded-2xl border p-3.5 animate-fade-up transition-all ${
        done
          ? "bg-white/[0.02] border-white/5 opacity-60"
          : active
          ? "bg-white/[0.04] border-accent/40 shadow-glow"
          : "bg-white/[0.03] border-white/10"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" className="animate-spin shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function Check() {
  return (
    <span className="w-4 h-4 rounded-full bg-success/90 flex items-center justify-center shrink-0">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        <path d="M5 12l5 5L20 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Avatar({ src, alt, ring }: { src?: string; alt: string; ring?: boolean }) {
  return (
    <div className={`w-10 h-10 rounded-full overflow-hidden bg-surface shrink-0 ${ring ? "shadow-[0_0_14px_rgba(110,86,207,0.45)]" : ""}`}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      )}
    </div>
  );
}

function openOrchestratorChat() {
  const url = `https://t.me/${ORCHESTRATOR}`;
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, "_blank");
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
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (!task) {
      setState(null);
      setFeedback(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setBusy(true);
      setFeedback(null);
      setState({ task, stage: "received", progress: 0 });

      await new Promise((r) => setTimeout(r, 500));
      if (cancelled) return;

      // Orchestrate
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
        agentId = data.agentId;
        reasoning = data.reasoning;
      } catch (e: any) {
        setState((s) => s && { ...s, stage: "error", error: e.message || "Ошибка оркестратора" });
        setBusy(false);
        return;
      }
      if (cancelled) return;
      setState((s) => s && { ...s, stage: "routing", agentId, reasoning });

      await new Promise((r) => setTimeout(r, 900));
      if (cancelled) return;
      setState((s) => s && { ...s, stage: "working", progress: 0 });

      // Animated progress (climbs to 90% while waiting, hits 100% on response)
      progressTimer.current = window.setInterval(() => {
        setState((s) => {
          if (!s || s.stage !== "working") return s;
          const next = Math.min(s.progress + 4, 90);
          return { ...s, progress: next };
        });
      }, 200) as unknown as number;

      // Agent call
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

  if (!state) return null;
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
    <section className="px-4 mt-4 space-y-2.5 animate-fade-up">
      {/* Step 1 — Andrey received */}
      <StepCard active={!step1Done} done={step1Done}>
        <div className="flex items-start gap-3">
          <Avatar src={ANDREY?.avatar} alt="Андрей" ring={!step1Done} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold">Андрей получил задачу</span>
              {step1Done ? <Check /> : <span className="text-accent"><Spinner /></span>}
            </div>
            <p className="text-[13px] text-muted mt-1 break-words">«{state.task}»</p>
            {!step1Done && <p className="text-[12px] text-accent mt-1.5">Анализирую…</p>}
          </div>
        </div>
      </StepCard>

      {/* Step 2 — routing */}
      {step2Visible && agent && (
        <StepCard active={stage === "routing"} done={step2Done} delay={60}>
          <div className="flex items-center gap-3">
            <Avatar src={ANDREY?.avatar} alt="Андрей" />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-accent">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <Avatar src={agentAvatar} alt={agent.name} ring={stage === "routing"} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold">Передаю {agent.name}</span>
                {step2Done && <Check />}
              </div>
              <p className="text-[12px] text-muted mt-0.5 truncate">{agent.role} · {reasoning}</p>
            </div>
          </div>
        </StepCard>
      )}

      {/* Step 3 — working with progress */}
      {step3Visible && agent && (
        <StepCard active={stage === "working"} done={step3Done} delay={120}>
          <div className="flex items-center gap-3 mb-3">
            <Avatar src={agentAvatar} alt={agent.name} ring={stage === "working"} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold">{agent.name} работает над задачей</span>
                {step3Done ? <Check /> : <span className="text-success"><Spinner /></span>}
              </div>
              <p className="text-[12px] text-muted mt-0.5">{agent.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-300 ease-out"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #30A46C 0%, #46D198 100%)",
                  boxShadow: "0 0 10px rgba(48,164,108,0.5)",
                }}
              />
            </div>
            <span className="text-[12px] font-semibold text-success tnum w-9 text-right">{progress}%</span>
          </div>
        </StepCard>
      )}

      {/* Step 4 — result */}
      {step4Visible && (
        <StepCard active delay={180}>
          {stage === "done" && reply ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Check />
                <span className="text-[14px] font-semibold">Готово</span>
                {agent && <span className="text-[12px] text-muted">· {agent.name}</span>}
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                {reply}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={openOrchestratorChat}
                  className="flex-1 min-w-[120px] rounded-xl bg-accentGrad px-3 py-2 text-[13px] font-semibold shadow-glowBtn"
                >
                  Открыть в чате
                </button>
                <button
                  onClick={() => reply && navigator.clipboard.writeText(reply).catch(() => {})}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] font-semibold"
                >
                  Скопировать
                </button>
                <button
                  onClick={() => setFeedback("up")}
                  className={`rounded-xl border px-3 py-2 text-[13px] ${feedback === "up" ? "border-success bg-success/15 text-success" : "border-white/10 bg-white/[0.04]"}`}
                  aria-label="Хорошо"
                >👍</button>
                <button
                  onClick={() => setFeedback("down")}
                  className={`rounded-xl border px-3 py-2 text-[13px] ${feedback === "down" ? "border-warn bg-warn/15 text-warn" : "border-white/10 bg-white/[0.04]"}`}
                  aria-label="Плохо"
                >👎</button>
              </div>
              <button
                onClick={onReset}
                className="mt-3 w-full text-[12px] text-muted hover:text-ink"
              >
                ← Новая задача
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-4 h-4 rounded-full bg-warn flex items-center justify-center text-[10px] font-bold">!</span>
                <span className="text-[14px] font-semibold">Что-то пошло не так</span>
              </div>
              <p className="text-[13px] text-muted">{error}</p>
              <button onClick={onReset} className="mt-3 text-[12px] text-accent">← Попробовать ещё раз</button>
            </>
          )}
        </StepCard>
      )}
    </section>
  );
}
