"use client";
import { useEffect, useRef, useState } from "react";
import { AGENT_DEFS, type AgentKey } from "../lib/agents";
import { getAgent } from "../lib/mockData";
import { pushRecent } from "../lib/recentTasks";
import { getInitData, hapticImpact, hapticNotify } from "../lib/telegram";

type Stage = "received" | "routing" | "working" | "done" | "error";
type Msg = { role: "user" | "assistant"; content: string; critique?: boolean };

interface State {
  task: string;
  stage: Stage;
  agentId?: AgentKey;
  reasoning?: string;
  messages: Msg[];
  streaming: string;
  error?: string;
  progress: number;
}

const ANDREY = getAgent("andrey");

function Avatar({ src, alt, size = 28, active }: { src?: string; alt: string; size?: number; active?: boolean }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: "rgba(255,255,255,0.04)",
        border: active ? "1px solid rgba(240,160,32,0.6)" : "1px solid rgba(255,255,255,0.08)",
        boxShadow: active ? "0 0 12px rgba(240,160,32,0.35)" : "none",
        flexShrink: 0,
      }}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      )}
    </div>
  );
}

function Dots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", marginLeft: 6 }} aria-hidden>
      <span className="lex-typing-dot" style={{ animationDelay: "0ms" }} />
      <span className="lex-typing-dot" style={{ animationDelay: "150ms" }} />
      <span className="lex-typing-dot" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

function Check({ done }: { done: boolean }) {
  if (!done) return null;
  return (
    <span style={{
      width: 14, height: 14, borderRadius: "50%", display: "inline-flex",
      alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #F0A020, #D05020)",
    }}>
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
        <path d="M5 12l5 5L20 7" stroke="#0A0705" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );
}

function StepCard({ active, done, accent, children, delay = 0 }: {
  active?: boolean; done?: boolean; accent?: boolean; children: React.ReactNode; delay?: number;
}) {
  return (
    <div
      className="lex-fade-up"
      style={{
        position: "relative",
        background: active ? "rgba(240,160,32,0.045)" : "rgba(255,255,255,0.022)",
        border: active ? "1px solid rgba(240,160,32,0.28)" : "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        padding: "12px 14px",
        opacity: done ? 0.55 : 1,
        overflow: "hidden",
        animationDelay: `${delay}ms`,
      }}
    >
      {accent && (
        <span aria-hidden style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 2,
          background: "linear-gradient(180deg, #F0A020, #D05020)",
        }} />
      )}
      <div style={{ paddingLeft: 4 }}>{children}</div>
    </div>
  );
}

async function streamAgent(
  agentId: AgentKey,
  messages: Msg[],
  onDelta: (full: string) => void,
  isCancelled: () => boolean,
): Promise<string> {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-init-data": getInitData() },
    body: JSON.stringify({ agentId, messages }),
  });
  if (!res.ok || !res.body) {
    let msg = "agent failed";
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (isCancelled()) { reader.cancel().catch(() => {}); return full; }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";
    for (const chunk of lines) {
      const line = chunk.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      let evt: any;
      try { evt = JSON.parse(payload); } catch { continue; }
      if (evt.type === "delta") {
        full += evt.text;
        onDelta(full);
      } else if (evt.type === "done") {
        full = evt.reply ?? full;
        onDelta(full);
      } else if (evt.type === "error") {
        throw new Error(evt.error || "agent failed");
      }
    }
  }
  return full;
}

export default function LiveActivityAmber({
  task, onReset, onBusy,
}: { task: string | null; onReset: () => void; onBusy: (b: boolean) => void; }) {
  const [state, setState] = useState<State | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [followBusy, setFollowBusy] = useState(false);
  const [critique, setCritique] = useState<string>("");
  const [critiqueBusy, setCritiqueBusy] = useState(false);
  const progressTimer = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!task) { setState(null); return; }
    cancelledRef.current = false;
    const run = async () => {
      onBusy(true);
      setState({ task, stage: "received", messages: [], streaming: "", progress: 0 });
      await new Promise((r) => setTimeout(r, 500));
      if (cancelledRef.current) return;

      let agentId: AgentKey; let reasoning: string;
      try {
        const res = await fetch("/api/orchestrate", { method: "POST", headers: { "content-type": "application/json", "x-telegram-init-data": getInitData() }, body: JSON.stringify({ task }) });
        if (!res.ok) throw new Error((await res.json()).error || "orchestrate failed");
        const data = await res.json();
        agentId = data.agentId; reasoning = data.reasoning;
      } catch (e: any) {
        setState((s) => s && { ...s, stage: "error", error: e.message || "Ошибка оркестратора" });
        onBusy(false); return;
      }
      if (cancelledRef.current) return;
      setState((s) => s && { ...s, stage: "routing", agentId, reasoning });
      await new Promise((r) => setTimeout(r, 800));
      if (cancelledRef.current) return;
      setState((s) => s && { ...s, stage: "working", progress: 0 });
      progressTimer.current = window.setInterval(() => {
        setState((s) => s && s.stage === "working" ? { ...s, progress: Math.min(s.progress + 4, 90) } : s);
      }, 200) as unknown as number;

      const initialMsgs: Msg[] = [{ role: "user", content: task }];
      try {
        if (progressTimer.current) window.clearInterval(progressTimer.current);
        let switched = false;
        const full = await streamAgent(agentId, initialMsgs, (partial) => {
          if (!switched) {
            switched = true;
            setState((s) => s && { ...s, stage: "done", streaming: partial, progress: 100 });
          } else {
            setState((s) => s && { ...s, streaming: partial });
          }
        }, () => cancelledRef.current);

        setState((s) => s && {
          ...s,
          stage: "done",
          messages: [...initialMsgs, { role: "assistant", content: full }],
          streaming: "",
          progress: 100,
        });
        hapticNotify("success");

        try {
          const def = AGENT_DEFS[agentId];
          pushRecent({ title: task, agentId, agentName: def?.name ?? agentId, reply: full });
        } catch {}
      } catch (e: any) {
        if (progressTimer.current) window.clearInterval(progressTimer.current);
        setState((s) => s && { ...s, stage: "error", error: e.message || "Ошибка агента" });
        hapticNotify("error");
      } finally {
        onBusy(false);
      }
    };
    run();
    return () => { cancelledRef.current = true; if (progressTimer.current) window.clearInterval(progressTimer.current); };
  }, [task, onBusy]);

  const runCritique = async () => {
    if (!state || critiqueBusy) return;
    const lastA = [...state.messages].reverse().find((m) => m.role === "assistant");
    if (!lastA) return;
    hapticImpact("medium");
    setCritique("");
    setCritiqueBusy(true);
    onBusy(true);
    try {
      const prompt = `Оригинальная задача:\n${state.task}\n\nОтвет коллеги:\n${lastA.content}\n\nКратко оцени: что сильно, что слабо, 2–3 конкретные правки.`;
      const full = await streamAgent(
        "arkadiy",
        [{ role: "user", content: prompt }],
        (partial) => setCritique(partial),
        () => cancelledRef.current,
      );
      setCritique(full);
    } catch (e: any) {
      setCritique(`ошибка: ${e.message || "не вышло"}`);
    } finally {
      setCritiqueBusy(false);
      onBusy(false);
    }
  };

  const sendFollowUp = async () => {
    const t = followUp.trim();
    if (!t || !state || !state.agentId || followBusy) return;
    hapticImpact("medium");
    setCritique("");
    const agentId = state.agentId;
    const next: Msg[] = [...state.messages, { role: "user", content: t }];
    setFollowUp("");
    setFollowBusy(true);
    onBusy(true);
    setState((s) => s && { ...s, messages: next, streaming: "" });
    try {
      const full = await streamAgent(agentId, next, (partial) => {
        setState((s) => s && { ...s, streaming: partial });
      }, () => cancelledRef.current);
      setState((s) => s && {
        ...s,
        messages: [...next, { role: "assistant", content: full }],
        streaming: "",
      });
    } catch (e: any) {
      setState((s) => s && { ...s, error: e.message || "Ошибка агента" });
    } finally {
      setFollowBusy(false);
      onBusy(false);
    }
  };

  if (!state) return null;
  const { stage, agentId, reasoning, error, progress, messages, streaming } = state;
  const agent = agentId ? AGENT_DEFS[agentId] : null;
  const agentMeta = agentId ? getAgent(agentId) : null;

  const step1Done = stage !== "received";
  const step2Visible = stage !== "received";
  const step3Visible = stage === "done" || stage === "error";

  const labelStyle: React.CSSProperties = {
    fontWeight: 300, fontSize: 10, letterSpacing: "0.1em",
    color: "rgba(255,255,255,0.18)", marginBottom: 10, fontFamily: "'DM Sans', sans-serif",
  };

  const msgBubble: React.CSSProperties = {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: 10,
    padding: "12px 14px",
    fontWeight: 300, fontSize: 13, lineHeight: 1.55,
    color: "rgba(240,228,208,0.7)",
    whiteSpace: "pre-wrap", wordBreak: "break-word",
    fontFamily: "'DM Sans', sans-serif",
  };

  const userBubble: React.CSSProperties = {
    ...msgBubble,
    background: "rgba(240,160,32,0.08)",
    border: "1px solid rgba(240,160,32,0.18)",
    color: "rgba(245,225,200,0.85)",
  };

  const lastAssistant = streaming || (messages.length > 0 && messages[messages.length - 1].role === "assistant" ? messages[messages.length - 1].content : "");

  return (
    <section style={{ padding: "0 22px", position: "relative", zIndex: 2, marginTop: 4 }}>
      <p style={labelStyle}>// в работе</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

        {/* Step 1 — Andrey */}
        <StepCard active={!step1Done} done={step1Done} accent>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <Avatar src={ANDREY?.avatar} alt="Андрей" active={!step1Done} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 400, fontSize: 13, color: "rgba(240,232,218,0.85)" }}>Андрей</span>
                <span style={{ fontWeight: 300, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>· оркестратор</span>
                <Check done={step1Done} />
              </div>
              <p style={{ fontWeight: 300, fontSize: 12, color: "rgba(240,228,208,0.35)", marginTop: 4, lineHeight: 1.4 }}>«{state.task}»</p>
              {!step1Done && (
                <p style={{ fontWeight: 300, fontSize: 11, color: "rgba(240,160,40,0.7)", marginTop: 4, display: "flex", alignItems: "center" }}>
                  анализирую<Dots />
                </p>
              )}
            </div>
          </div>
        </StepCard>

        {/* Step 2 — routing/working */}
        {step2Visible && agent && (
          <StepCard active={stage === "routing" || stage === "working"} done={stage === "done"} accent delay={60}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <Avatar src={agentMeta?.avatar} alt={agent.name} active={stage === "routing" || stage === "working"} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 400, fontSize: 13, color: "rgba(240,232,218,0.85)" }}>{agent.name}</span>
                  <span style={{ fontWeight: 300, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>· {agent.role.toLowerCase()}</span>
                  <Check done={stage === "done"} />
                </div>
                {reasoning && (
                  <p style={{ fontWeight: 300, fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4, lineHeight: 1.4 }}>{reasoning}</p>
                )}
                {stage === "working" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <div style={{ position: "relative", flex: 1, height: 4, borderRadius: 2, overflow: "hidden", background: "rgba(255,255,255,0.05)" }}>
                      <div style={{
                        position: "absolute", inset: 0, width: `${progress}%`,
                        background: "linear-gradient(90deg, #F0A020, #D05020)",
                        borderRadius: 2,
                        transition: "width 300ms cubic-bezier(0.16,1,0.3,1)",
                      }} />
                    </div>
                    <span style={{ fontWeight: 300, fontSize: 10, color: "rgba(240,160,40,0.7)", fontVariantNumeric: "tabular-nums", width: 32, textAlign: "right" }}>{progress}%</span>
                  </div>
                )}
              </div>
            </div>
          </StepCard>
        )}

        {/* Step 3 — result/error + multi-turn */}
        {step3Visible && (
          <StepCard active accent delay={120}>
            {stage === "done" ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Check done />
                  <span style={{ fontWeight: 400, fontSize: 13, color: "rgba(240,232,218,0.85)" }}>диалог</span>
                  {agent && <span style={{ fontWeight: 300, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>· {agent.name.toLowerCase()}</span>}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {messages.slice(1, -1).map((m, i) => (
                    <div key={i} style={m.role === "user" ? userBubble : msgBubble}>
                      {m.content}
                    </div>
                  ))}
                  {/* последний user (если был follow-up и assistant ещё стримит) */}
                  {messages.length > 0 && messages[messages.length - 1].role === "user" && (
                    <div style={userBubble}>{messages[messages.length - 1].content}</div>
                  )}
                  {lastAssistant && (
                    <div style={msgBubble}>{lastAssistant}{followBusy && !streaming ? "" : ""}</div>
                  )}
                  {followBusy && !streaming && (
                    <div style={{ ...msgBubble, color: "rgba(240,160,40,0.6)" }}>думаю<Dots /></div>
                  )}
                </div>

                <div style={{ marginTop: 12, position: "relative" }}>
                  <textarea
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendFollowUp();
                      }
                    }}
                    placeholder="уточни задачу или задай вопрос..."
                    rows={2}
                    disabled={followBusy}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 10,
                      padding: "10px 50px 10px 12px",
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 300, fontSize: 13,
                      color: "rgba(240,228,208,0.7)",
                      caretColor: "#F0A020",
                      resize: "none", outline: "none",
                      lineHeight: 1.4,
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    onClick={sendFollowUp}
                    disabled={!followUp.trim() || followBusy}
                    style={{
                      position: "absolute", right: 6, top: 6,
                      width: 30, height: 30, borderRadius: 8,
                      border: "none",
                      background: "linear-gradient(135deg, #F0A020, #D05020)",
                      color: "#0A0705",
                      cursor: "pointer",
                      opacity: followUp.trim() && !followBusy ? 1 : 0.4,
                      fontSize: 14, fontWeight: 700,
                    }}
                    aria-label="отправить"
                  >→</button>
                </div>

                {(critique || critiqueBusy) && (
                  <div style={{
                    marginTop: 10,
                    background: "rgba(244,63,94,0.06)",
                    border: "1px solid rgba(244,63,94,0.22)",
                    borderRadius: 10,
                    padding: "10px 12px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span style={{ fontWeight: 400, fontSize: 11, color: "rgba(244,150,160,0.85)" }}>Аркадий · критик</span>
                      {critiqueBusy && <Dots />}
                    </div>
                    <div style={{
                      fontWeight: 300, fontSize: 12, lineHeight: 1.5,
                      color: "rgba(245,225,225,0.78)",
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                      fontFamily: "'DM Sans', sans-serif",
                    }}>{critique || "..."}</div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 10 }}>
                  <button
                    onClick={() => navigator.clipboard.writeText(lastAssistant).catch(() => {})}
                    style={{
                      padding: "10px 8px", borderRadius: 8, cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif", fontWeight: 300, fontSize: 11,
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(240,228,208,0.6)",
                    }}
                  >копировать</button>
                  <button
                    onClick={runCritique}
                    disabled={critiqueBusy}
                    style={{
                      padding: "10px 8px", borderRadius: 8, cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif", fontWeight: 300, fontSize: 11,
                      background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.25)",
                      color: "rgba(244,150,160,0.9)",
                      opacity: critiqueBusy ? 0.5 : 1,
                    }}
                  >{critiqueBusy ? "критика…" : "проверить"}</button>
                  <button
                    onClick={onReset}
                    style={{
                      padding: "10px 8px", borderRadius: 8, cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif", fontWeight: 400, fontSize: 11,
                      background: "linear-gradient(135deg, #F0A020, #D05020)",
                      border: "none", color: "#0A0705",
                    }}
                  >новая</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontWeight: 400, fontSize: 13, color: "rgba(240,160,40,0.8)" }}>что-то пошло не так</p>
                <p style={{ fontWeight: 300, fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{error}</p>
                <button onClick={onReset} style={{
                  marginTop: 10, padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 300, fontSize: 11,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(240,160,40,0.7)",
                }}>попробовать ещё</button>
              </>
            )}
          </StepCard>
        )}
      </div>
    </section>
  );
}
