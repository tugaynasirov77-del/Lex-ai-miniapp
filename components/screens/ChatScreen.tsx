"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useFlow, useFlowActions } from "../../flow";
import {
  peekProjects,
  listProjects,
  decodeReel,
  adaptDecodeToTopics,
  refineMyTopic,
  generateReelScript,
  refineScriptBlock,
  saveScenarioDraft,
  setDraftPlannedDate,
  streamChat,
  ApiError,
  peekBilling,
  type ProjectDTO,
  type ReelDecodeDTO,
  type AdaptedTopicDTO,
  type ReelScenarioData,
  type ChatTurn,
  type ScriptRefineAction,
} from "../../lib/api";
import { getTgUser, hapticImpact, hapticSelection, hapticNotify } from "../../lib/telegram";
import { track } from "../../lib/analytics";
import PaywallSheet from "../PaywallSheet";
import LexLogo from "../LexLogo";

// ─── Тёмная тема (как на HomeScreen) ───
const BG = "#0B0B11";
const INK = "#F4F4F8";
const MUTED = "#9A9AAB";
const SUB_MUTED = "#6B6B7B";
const CARD_BG = "#15151E";
const CARD_BORDER = "#262630";
const SOFT = "#1C1C26";
const IG_GRADIENT = "linear-gradient(95deg, #A24FD6 0%, #E84B91 50%, #F88A4A 100%)";
const PINK = "#E84B91";
const ACC_GREEN = "#4FD489";

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function looksLikeReelUrl(s: string): boolean {
  return /https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(reel|reels|p|tv)\//i.test(s.trim());
}

// ─── Модель сообщений ───
type Action = { label: string; onTap: () => void; primary?: boolean };
type Msg =
  | { id: string; role: "user"; kind: "text"; text: string }
  | { id: string; role: "agent"; kind: "text"; text: string; actions?: Action[]; streaming?: boolean }
  | { id: string; role: "agent"; kind: "pending"; label: string }
  | { id: string; role: "agent"; kind: "decode"; decode: ReelDecodeDTO; actions?: Action[] }
  | { id: string; role: "agent"; kind: "topics"; topics: AdaptedTopicDTO[]; decodeId: string }
  | { id: string; role: "agent"; kind: "script"; scenario: ReelScenarioData; decodeId?: string; topicTitle: string };

let _seq = 0;
const uid = () => `m${++_seq}_${Date.now()}`;

export default function ChatScreen({ onBack }: { onBack?: () => void }) {
  const { state } = useFlow();
  const actions = useFlowActions();
  const greetedRef = useRef(false);

  const [projects, setProjects] = useState<ProjectDTO[]>(
    () => peekProjects()?.projects.filter((p) => p.platform === "instagram") ?? [],
  );
  const [activeId, setActiveId] = useState<string | null>(state.projectId || projects[0]?.id || null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [paywall, setPaywall] = useState<null | "limit_reached" | "pro_feature">(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const tierRef = useRef<"free" | "pro" | "business">(peekBilling()?.tier ?? "free");
  const scrollRef = useRef<HTMLDivElement>(null);
  const typeTimer = useRef<number | null>(null);

  // Клавиатура открыта → visualViewport схлопывается (таб-бар уезжает,
  // панель ввода прижимаем к клавиатуре).
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const onResize = () => setKeyboardOpen(window.innerHeight - vv.height > 120);
    vv.addEventListener("resize", onResize);
    onResize();
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const activeProject = projects.find((p) => p.id === activeId) || projects[0] || null;
  const firstName = (getTgUser()?.first_name?.trim() || "").split(/\s+/)[0] || "";

  // ── helpers для ленты ──
  const push = useCallback((m: Msg) => setMessages((prev) => [...prev, m]), []);
  const remove = useCallback((id: string) => setMessages((prev) => prev.filter((x) => x.id !== id)), []);

  // автоскролл вниз
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // загрузка проектов
  useEffect(() => {
    let alive = true;
    listProjects()
      .then((r) => {
        if (!alive) return;
        const ig = r.projects.filter((p) => p.platform === "instagram");
        setProjects(ig);
        if (!activeId && ig[0]) setActiveId(ig[0].id);
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── обработка квоты/ошибок ──
  const handleErr = useCallback(
    (e: any, pendingId: string, fallback: string) => {
      remove(pendingId);
      hapticNotify("error");
      if (e instanceof ApiError && e.status === 402) {
        setPaywall(/pro/i.test(e.message) ? "pro_feature" : "limit_reached");
        return;
      }
      push({
        id: uid(),
        role: "agent",
        kind: "text",
        text: e?.message ? `${fallback}\n\n${e.message}` : fallback,
      });
    },
    [push, remove],
  );

  // ── flow: разбор ──
  const runDecode = useCallback(
    async (rawUrl: string) => {
      const url = rawUrl.trim();
      if (!url || !activeId || busy) return;
      setBusy(true);
      push({ id: uid(), role: "user", kind: "text", text: url });
      const pid = uid();
      push({ id: pid, role: "agent", kind: "pending", label: "Разбираю Reels — хук, структуру, метрики…" });
      track("reels_analysis_started", { project_id: activeId, from: "chat" });
      try {
        const r = await decodeReel(activeId, url);
        const decodeId = r.decode.id;
        if (r.quota?.tier) tierRef.current = r.quota.tier;
        remove(pid);
        push({ id: uid(), role: "agent", kind: "decode", decode: r.decode });
        const niche = activeProject?.niche;
        const isPro = tierRef.current !== "free";
        if (!decodeId) {
          push({ id: uid(), role: "agent", kind: "text", text: "Готов разбор 👆", actions: [{ label: "Разобрать ещё", onTap: () => focusInput() }] });
        } else if (isPro) {
          push({
            id: uid(),
            role: "agent",
            kind: "text",
            text: niche
              ? `Разобрал. Теперь адаптирую под твою нишу — ${niche}. Подберу 3 темы, которые зайдут именно твоей аудитории.`
              : "Разобрал. Давай адаптирую под твою нишу — подберу 3 темы под тебя.",
            actions: [
              { label: "Адаптировать под мою нишу", primary: true, onTap: () => runAdapt(decodeId) },
              { label: "Разобрать ещё", onTap: () => focusInput() },
            ],
          });
        } else {
          // Free: разбор бесплатно, адаптация под нишу и сценарий — в Pro
          push({
            id: uid(),
            role: "agent",
            kind: "text",
            text:
              "Это базовый разбор — он бесплатный 🎁\n\nА вот адаптацию под твою нишу и готовый сценарий под тебя собираю в Pro. Открыть?",
            actions: [
              { label: "Разблокировать в Pro", primary: true, onTap: () => { hapticImpact("medium"); setPaywall("pro_feature"); } },
              { label: "Разобрать ещё", onTap: () => focusInput() },
            ],
          });
        }
        track("reels_analysis_completed", { project_id: activeId, from: "chat", cached: r.cached });
        hapticNotify("success");
      } catch (e: any) {
        handleErr(e, pid, "Не получилось разобрать этот Reels. Проверь ссылку и попробуй ещё раз.");
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeId, busy],
  );

  // ── flow: адаптация под нишу ──
  const runAdapt = useCallback(
    async (decodeId: string) => {
      if (!activeId || busy) return;
      setBusy(true);
      const pid = uid();
      push({ id: pid, role: "agent", kind: "pending", label: "Подбираю темы под твою нишу…" });
      try {
        const r = await adaptDecodeToTopics(activeId, decodeId);
        remove(pid);
        push({ id: uid(), role: "agent", kind: "text", text: "Вот 3 идеи под твою нишу. Выбери, что развиваем — соберу полный сценарий:" });
        push({ id: uid(), role: "agent", kind: "topics", topics: r.topics, decodeId });
      } catch (e: any) {
        handleErr(e, pid, "Не получилось подобрать темы. Попробуй ещё раз.");
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeId, busy],
  );

  // ── flow: своя идея → усиление ──
  const runRefineIdea = useCallback(
    async (decodeId: string, idea: string) => {
      if (!activeId || busy) return;
      setBusy(true);
      push({ id: uid(), role: "user", kind: "text", text: idea });
      const pid = uid();
      push({ id: pid, role: "agent", kind: "pending", label: "Усиливаю твою идею механикой этого Reels…" });
      try {
        const r = await refineMyTopic(activeId, decodeId, idea);
        remove(pid);
        runScript(r.topic, decodeId);
      } catch (e: any) {
        handleErr(e, pid, "Не получилось усилить идею. Попробуй переформулировать.");
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeId, busy],
  );

  // ── flow: генерация сценария ──
  const runScript = useCallback(
    async (topic: AdaptedTopicDTO, decodeId?: string) => {
      if (!activeId) return;
      setBusy(true);
      const pid = uid();
      push({ id: pid, role: "agent", kind: "pending", label: `Собираю сценарий: «${topic.title}»…` });
      try {
        const r = await generateReelScript(activeId, topic, decodeId);
        remove(pid);
        push({ id: uid(), role: "agent", kind: "script", scenario: r.scenario, decodeId, topicTitle: topic.title });
        hapticNotify("success");
      } catch (e: any) {
        handleErr(e, pid, "Не получилось собрать сценарий. Попробуй ещё раз.");
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeId],
  );

  // ── flow: свободный текст → стрим агента ──
  const runFreeText = useCallback(
    async (text: string) => {
      if (!activeId || busy) return;
      setBusy(true);
      push({ id: uid(), role: "user", kind: "text", text });
      // история для контекста (только текстовые реплики)
      const history: ChatTurn[] = [];
      setMessages((prev) => {
        for (const m of prev) {
          if (m.kind === "text" && (m.role === "user" || m.role === "agent"))
            history.push({ role: m.role === "agent" ? "assistant" : "user", content: m.text });
        }
        return prev;
      });
      history.push({ role: "user", content: text });
      const aid = uid();
      push({ id: aid, role: "agent", kind: "text", text: "", streaming: true });
      try {
        await streamChat(
          activeId,
          history.slice(-12),
          (delta) =>
            setMessages((prev) =>
              prev.map((x) => (x.id === aid && x.kind === "text" && x.role === "agent" ? { ...x, text: x.text + delta } : x)),
            ),
          (reply) =>
            setMessages((prev) =>
              prev.map((x) =>
                x.id === aid && x.kind === "text" && x.role === "agent"
                  ? {
                      ...x,
                      text: reply || x.text,
                      streaming: false,
                      actions: [{ label: "Разобрать Reels", primary: true, onTap: () => focusInput() }],
                    }
                  : x,
              ),
            ),
        );
      } catch (e: any) {
        handleErr(e, aid, "Связь прервалась. Попробуй ещё раз.");
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeId, busy],
  );

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const focusInput = () => inputRef.current?.focus();

  // ── приветствие агента: «печатает…» → typewriter ──
  useEffect(() => {
    if (greetedRef.current) return;
    greetedRef.current = true;
    const text = `Привет${firstName ? `, ${firstName}` : ""}! Скинь ссылку на Reels — разберу его и покажу, как сделать такой же.`;
    const greetActions: Action[] = [
      { label: "Не знаю что снять — предложи идею", onTap: () => runFreeText("Не знаю, что снять. Предложи мне идеи для Reels под мою нишу.") },
    ];
    const pid = uid();
    push({ id: pid, role: "agent", kind: "pending", label: "" });
    const t0 = window.setTimeout(() => {
      remove(pid);
      const gid = uid();
      push({ id: gid, role: "agent", kind: "text", text: "", streaming: true });
      let i = 0;
      typeTimer.current = window.setInterval(() => {
        i += 4;
        const done = i >= text.length;
        setMessages((prev) =>
          prev.map((x) =>
            x.id === gid && x.kind === "text" && x.role === "agent"
              ? { ...x, text: text.slice(0, i), streaming: !done, actions: done ? greetActions : undefined }
              : x,
          ),
        );
        if (done && typeTimer.current) { window.clearInterval(typeTimer.current); typeTimer.current = null; }
      }, 18);
    }, 300);
    return () => { window.clearTimeout(t0); if (typeTimer.current) window.clearInterval(typeTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = () => {
    const t = input.trim();
    if (!t || busy) return;
    if (!activeId) { actions.navigate("create-project"); return; }
    setInput("");
    hapticSelection();
    if (looksLikeReelUrl(t)) runDecode(t);
    else runFreeText(t);
  };

  const onSaveScript = useCallback(
    async (m: Extract<Msg, { kind: "script" }>, plan: boolean): Promise<boolean> => {
      const pid = activeId || peekProjects()?.projects.find((p) => p.platform === "instagram")?.id || null;
      if (!pid) {
        push({ id: uid(), role: "agent", kind: "text", text: "Не вижу активный проект — открой чат заново с главного экрана." });
        return false;
      }
      try {
        const { id } = await saveScenarioDraft(pid, {
          content_type: "reel",
          status: "scenario_ready",
          title: m.scenario.title,
          source_decode_id: m.decodeId,
          source_topic: m.topicTitle,
          scenario_data: m.scenario,
          body: m.scenario.caption,
          caption: m.scenario.caption,
        });
        if (plan) await setDraftPlannedDate(id, todayISO());
        hapticNotify("success");
        track(plan ? "script_added_to_plan" : "script_saved", { project_id: pid, draft_id: id, from: "chat" });
        push({
          id: uid(),
          role: "agent",
          kind: "text",
          text: plan
            ? "Готово — добавил в план на сегодня. Найдёшь во вкладке «План»."
            : "Сохранил в библиотеку. Найдёшь во вкладке «Профиль» → материалы.",
          actions: [{ label: "Разобрать ещё Reels", primary: true, onTap: () => focusInput() }],
        });
        return true;
      } catch (e: any) {
        hapticNotify("error");
        if (e instanceof ApiError && e.status === 402) { setPaywall("limit_reached"); return false; }
        push({ id: uid(), role: "agent", kind: "text", text: `Не удалось сохранить: ${e?.message || "ошибка"}. Попробуй ещё раз.` });
        return false;
      }
    },
    [activeId, push],
  );

  return (
    <div style={{ position: "absolute", inset: 0, background: BG, color: INK, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Шапка */}
      <div
        style={{
          flexShrink: 0,
          padding: "max(calc(env(safe-area-inset-top) + 52px), 88px) 18px 12px",
          display: "flex",
          alignItems: "center",
          gap: 11,
          borderBottom: `1px solid ${CARD_BORDER}`,
          background: "rgba(11,11,17,0.92)",
          backdropFilter: "blur(12px)",
        }}
      >
        {onBack && (
          <button onClick={() => { hapticSelection(); onBack(); }} aria-label="Назад" style={{ flexShrink: 0, width: 34, height: 34, marginLeft: -4, borderRadius: 11, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
        <div style={{ position: "relative", width: 36, height: 36, flexShrink: 0 }}>
          <div style={{ position: "absolute", inset: -3, borderRadius: 14, background: IG_GRADIENT, filter: "blur(8px)", opacity: 0.4 }} />
          <div style={{ position: "relative", width: 36, height: 36, borderRadius: 12, background: "#15151E", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LexLogo size={24} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 6 }}>
            LEX <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>· умный агент</span>
          </div>
          <div style={{ fontSize: 11, color: ACC_GREEN, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: ACC_GREEN, boxShadow: `0 0 6px ${ACC_GREEN}` }} />
            на связи
          </div>
        </div>
        {activeProject && (
          <span style={{ flexShrink: 0, maxWidth: 130, fontSize: 12, fontWeight: 600, color: MUTED, padding: "6px 12px", borderRadius: 999, background: SOFT, border: `1px solid ${CARD_BORDER}`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {activeProject.title}
          </span>
        )}
      </div>

      {/* Лента */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "18px 16px 8px", display: "flex", flexDirection: "column", gap: 14 }}>
        {messages.map((m) => (
          <MessageView key={m.id} m={m} onAdapt={runAdapt} onPickTopic={runScript} onRefineIdea={runRefineIdea} onSaveScript={onSaveScript} projectId={activeId} />
        ))}
      </div>

      {/* Композер */}
      <div
        style={{
          flexShrink: 0,
          padding: "10px 14px",
          paddingBottom: keyboardOpen
            ? "max(env(safe-area-inset-bottom), 10px)"
            : "max(calc(env(safe-area-inset-bottom) + 108px), 120px)",
          borderTop: `1px solid ${CARD_BORDER}`,
          background: "rgba(11,11,17,0.96)",
          backdropFilter: "blur(12px)",
          transition: "padding-bottom 200ms ease-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <button
            onClick={async () => { try { const t = await navigator.clipboard.readText(); if (t) setInput(t.trim()); } catch {} hapticSelection(); }}
            aria-label="Вставить ссылку"
            style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 13, border: `1px solid ${CARD_BORDER}`, background: SOFT, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
          >
            <LinkIcon color={MUTED} />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder="Ссылка на Reels или вопрос…"
            style={{
              flex: 1, resize: "none", maxHeight: 120, appearance: "none", outline: "none",
              background: SOFT, color: INK, fontFamily: "inherit", fontSize: 14, lineHeight: 1.4,
              border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: "11px 14px",
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || busy}
            aria-label="Отправить"
            style={{
              flexShrink: 0, width: 42, height: 42, borderRadius: 13, border: "none",
              background: input.trim() && !busy ? IG_GRADIENT : SOFT,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: input.trim() && !busy ? "pointer" : "not-allowed", padding: 0,
              boxShadow: input.trim() && !busy ? "0 8px 20px rgba(221,42,123,0.35)" : "none",
            }}
          >
            <SendIcon color={input.trim() && !busy ? "#fff" : MUTED} />
          </button>
        </div>
      </div>

      {paywall && <PaywallSheet variant={paywall} onClose={() => setPaywall(null)} />}
    </div>
  );
}

// ───────────────────── Рендер одного сообщения ─────────────────────
function MessageView({
  m, onAdapt, onPickTopic, onRefineIdea, onSaveScript, projectId,
}: {
  m: Msg;
  onAdapt: (decodeId: string) => void;
  onPickTopic: (t: AdaptedTopicDTO, decodeId?: string) => void;
  onRefineIdea: (decodeId: string, idea: string) => void;
  onSaveScript: (m: Extract<Msg, { kind: "script" }>, plan: boolean) => Promise<boolean>;
  projectId: string | null;
}) {
  if (m.role === "user") {
    return (
      <div style={{ alignSelf: "flex-end", maxWidth: "82%", padding: "10px 14px", borderRadius: "16px 16px 4px 16px", background: IG_GRADIENT, color: "#fff", fontSize: 14, lineHeight: 1.45, wordBreak: "break-word" }}>
        {m.text}
      </div>
    );
  }

  // agent
  return (
    <div style={{ alignSelf: "flex-start", maxWidth: "94%", display: "flex", flexDirection: "column", gap: 10 }}>
      {m.kind === "pending" && <PendingBubble label={m.label} />}
      {m.kind === "text" && <TextBubble text={m.text} streaming={m.streaming} />}
      {m.kind === "decode" && <DecodeCard decode={m.decode} />}
      {m.kind === "topics" && <TopicsCard topics={m.topics} decodeId={m.decodeId} onPick={onPickTopic} onRefineIdea={onRefineIdea} />}
      {m.kind === "script" && <ScriptCard m={m} onSave={onSaveScript} projectId={projectId} />}
      {"actions" in m && m.actions && m.actions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {m.actions.map((a, i) => (
            <button
              key={i}
              onClick={() => { hapticImpact("light"); a.onTap(); }}
              style={{
                appearance: "none", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer",
                padding: "10px 14px", borderRadius: 13,
                border: a.primary ? "none" : `1px solid ${CARD_BORDER}`,
                background: a.primary ? IG_GRADIENT : SOFT,
                color: a.primary ? "#fff" : INK,
                boxShadow: a.primary ? "0 8px 18px rgba(221,42,123,0.28)" : "none",
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Лёгкий рендер: **жирный** → bold, маркеры списка "* "/"- " → "• ".
function renderRich(text: string): React.ReactNode {
  const lines = text.split("\n");
  return lines.map((line, li) => {
    const clean = line.replace(/^\s*[-*]\s+/, "• ");
    const parts = clean.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return (
      <span key={li}>
        {parts.map((p, pi) =>
          p.startsWith("**") && p.endsWith("**") ? (
            <strong key={pi} style={{ fontWeight: 800 }}>{p.slice(2, -2)}</strong>
          ) : (
            <span key={pi}>{p}</span>
          ),
        )}
        {li < lines.length - 1 && <br />}
      </span>
    );
  });
}

function TextBubble({ text, streaming }: { text: string; streaming?: boolean }) {
  return (
    <div style={{ padding: "11px 14px", borderRadius: "16px 16px 16px 4px", background: CARD_BG, border: `1px solid ${CARD_BORDER}`, fontSize: 14, lineHeight: 1.5, color: INK, wordBreak: "break-word" }}>
      {renderRich(text)}
      {streaming && <span style={{ display: "inline-block", width: 7, height: 14, marginLeft: 2, background: PINK, borderRadius: 2, verticalAlign: "-2px", animation: "lexblink 1s steps(2) infinite" }} />}
      <style>{`@keyframes lexblink{0%,49%{opacity:1}50%,100%{opacity:0}}`}</style>
    </div>
  );
}

function PendingBubble({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: "16px 16px 16px 4px", background: CARD_BG, border: `1px solid ${CARD_BORDER}`, fontSize: 13.5, color: MUTED }}>
      <Dots />
      <span>{label}</span>
    </div>
  );
}

function Dots() {
  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 6, height: 6, borderRadius: 999, background: PINK, animation: `lexdot 1.2s ${i * 0.18}s infinite ease-in-out` }} />
      ))}
      <style>{`@keyframes lexdot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}`}</style>
    </span>
  );
}

// ───────────────────── Карточка разбора ─────────────────────
function DecodeCard({ decode }: { decode: ReelDecodeDTO }) {
  const a = decode.analysis;
  const meta = decode.metadata;
  const fmtNum = (n?: number) => {
    if (!n && n !== 0) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };
  const takeaways = (a.takeaways && a.takeaways.length ? a.takeaways : a.shoot_yourself) || [];
  return (
    <div style={{ borderRadius: 18, padding: 16, background: "linear-gradient(135deg, #1B0822 0%, #0A050C 100%)", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 14px 32px rgba(221,42,123,0.16)" }}>
      <div style={{ fontSize: 10, color: PINK, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, marginBottom: 8 }}>Разбор Reels</div>

      {/* метрики */}
      <div style={{ display: "flex", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
        <Metric label="Просмотры" value={fmtNum(meta.view_count)} />
        <Metric label="Лайки" value={fmtNum(meta.like_count)} />
        <Metric label="Комменты" value={fmtNum(meta.comment_count)} />
      </div>

      <Section title="Почему цепляет">
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
          {(a.why_works || []).slice(0, 3).map((w, i) => (
            <li key={i} style={{ fontSize: 13, lineHeight: 1.45, color: INK }}>{w}</li>
          ))}
        </ul>
      </Section>

      <Section title="Механика">
        <div style={{ fontSize: 13, lineHeight: 1.5, color: INK }}>
          <b style={{ color: "#F6B6D3" }}>Хук:</b> {a.hook?.text}
          {a.format ? <div style={{ marginTop: 4, color: MUTED }}>Формат: {a.format}</div> : null}
          {a.cta ? <div style={{ marginTop: 4, color: MUTED }}>CTA: {a.cta}</div> : null}
        </div>
      </Section>

      {takeaways.length > 0 && (
        <Section title="Что взять себе">
          <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
            {takeaways.slice(0, 4).map((t, i) => (
              <li key={i} style={{ fontSize: 13, lineHeight: 1.45, color: INK }}>{t}</li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, color: INK, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3 }}>{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: MUTED, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

// ───────────────────── Карточка тем ─────────────────────
function TopicsCard({
  topics, decodeId, onPick, onRefineIdea,
}: {
  topics: AdaptedTopicDTO[];
  decodeId: string;
  onPick: (t: AdaptedTopicDTO, decodeId?: string) => void;
  onRefineIdea: (decodeId: string, idea: string) => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const [idea, setIdea] = useState("");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {topics.map((t, i) => (
        <button
          key={t.id || i}
          onClick={() => { hapticImpact("light"); onPick(t, decodeId); }}
          style={{ appearance: "none", textAlign: "left", fontFamily: "inherit", cursor: "pointer", padding: 14, borderRadius: 14, border: `1px solid ${CARD_BORDER}`, background: CARD_BG, color: INK }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3, marginBottom: 5 }}>{t.title}</div>
          <div style={{ fontSize: 12.5, color: "#F6B6D3", lineHeight: 1.4, marginBottom: 6 }}>«{t.hook}»</div>
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.45 }}>{t.rationale}</div>
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: PINK }}>Собрать сценарий →</div>
        </button>
      ))}

      {!ownOpen ? (
        <button
          onClick={() => { hapticSelection(); setOwnOpen(true); }}
          style={{ appearance: "none", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "11px 14px", borderRadius: 13, border: `1px dashed ${CARD_BORDER}`, background: "transparent", color: MUTED }}
        >
          + У меня своя идея
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 14, border: `1px solid ${CARD_BORDER}`, background: SOFT }}>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={2}
            placeholder="Опиши свою идею — усилю её механикой этого Reels"
            style={{ resize: "none", appearance: "none", outline: "none", background: CARD_BG, color: INK, fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.4, border: `1px solid ${CARD_BORDER}`, borderRadius: 11, padding: "10px 12px" }}
          />
          <button
            onClick={() => { if (idea.trim().length >= 5) { setOwnOpen(false); onRefineIdea(decodeId, idea.trim()); setIdea(""); } }}
            disabled={idea.trim().length < 5}
            style={{ appearance: "none", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: idea.trim().length >= 5 ? "pointer" : "not-allowed", padding: "10px 0", borderRadius: 12, border: "none", background: IG_GRADIENT, color: "#fff", opacity: idea.trim().length >= 5 ? 1 : 0.5 }}
          >
            Усилить и собрать сценарий
          </button>
        </div>
      )}
    </div>
  );
}

// ───────────────────── Карточка сценария ─────────────────────
const REFINE_BTNS: { label: string; action: ScriptRefineAction }[] = [
  { label: "Короче", action: "shorter" },
  { label: "Резче", action: "sharper" },
  { label: "Проще", action: "simpler" },
  { label: "Др. вариант", action: "alternative" },
];

function ScriptCard({
  m, onSave, projectId,
}: {
  m: Extract<Msg, { kind: "script" }>;
  onSave: (m: Extract<Msg, { kind: "script" }>, plan: boolean) => Promise<boolean>;
  projectId: string | null;
}) {
  const [sc, setSc] = useState<ReelScenarioData>(m.scenario);
  const [refining, setRefining] = useState<string | null>(null);
  const [savedState, setSavedState] = useState<"idle" | "saving" | "saved">("idle");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const patch = (k: keyof ReelScenarioData, v: any) => setSc((p) => ({ ...p, [k]: v }));

  async function refine(field: "hook" | "voice_over" | "cta" | "caption", action: ScriptRefineAction) {
    if (!projectId || refining) return;
    setRefining(field);
    hapticImpact("light");
    try {
      const r = await refineScriptBlock(projectId, { block_name: field, current_text: sc[field], action });
      patch(field, r.text);
      hapticNotify("success");
    } catch { hapticNotify("error"); }
    finally { setRefining(null); }
  }

  async function save(plan: boolean) {
    setSavedState("saving");
    const ok = await onSave({ ...m, scenario: sc }, plan);
    setSavedState(ok ? "saved" : "idle");
  }

  function copy() {
    const text =
      `${sc.title}\n\nХук: ${sc.hook}\n\nТекст на экране: ${sc.on_screen_text}\n\nОзвучка:\n${sc.voice_over}\n\nCTA: ${sc.cta}\n\nПодпись:\n${sc.caption}\n\n${(sc.hashtags || []).join(" ")}`;
    navigator.clipboard?.writeText(text).then(() => hapticNotify("success"), () => hapticNotify("error"));
  }

  return (
    <div style={{ borderRadius: 18, padding: 16, background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
      <div style={{ fontSize: 10, color: PINK, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, marginBottom: 8 }}>
        Сценарий · {sc.duration_sec}с
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.25, marginBottom: 12 }}>{sc.title}</div>

      <ScriptBlock label="Хук · 1–3 сек" text={sc.hook} refining={refining === "hook"} onRefine={(a) => refine("hook", a)} />
      <ScriptBlock label="Текст на экране" text={sc.on_screen_text} />
      <ScriptBlock label="Озвучка" text={sc.voice_over} refining={refining === "voice_over"} onRefine={(a) => refine("voice_over", a)} multiline />

      {sc.storyboard?.length > 0 && (
        <Section title="Раскадровка">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sc.storyboard.map((s, i) => (
              <div key={i} style={{ padding: 10, borderRadius: 11, background: SOFT, border: `1px solid ${CARD_BORDER}` }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: PINK, marginBottom: 4 }}>Сцена {s.scene} · {s.seconds}с</div>
                <div style={{ fontSize: 13, lineHeight: 1.4 }}>{s.action}</div>
                {s.on_screen ? <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>На экране: {s.on_screen}</div> : null}
              </div>
            ))}
          </div>
        </Section>
      )}

      <ScriptBlock label="CTA" text={sc.cta} refining={refining === "cta"} onRefine={(a) => refine("cta", a)} />
      <ScriptBlock label="Подпись" text={sc.caption} refining={refining === "caption"} onRefine={(a) => refine("caption", a)} multiline />
      {sc.hashtags?.length > 0 && (
        <div style={{ fontSize: 12.5, color: "#F6B6D3", lineHeight: 1.5, marginBottom: 12 }}>{sc.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}</div>
      )}

      {/* доп. детали продакшна */}
      <button onClick={() => setDetailsOpen((v) => !v)} style={{ appearance: "none", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: MUTED, background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: detailsOpen ? 10 : 4 }}>
        {detailsOpen ? "Скрыть детали съёмки ▴" : "Детали съёмки (кадр, свет, музыка) ▾"}
      </button>
      {detailsOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: MUTED, marginBottom: 12 }}>
          {sc.in_frame && <div><b style={{ color: INK }}>В кадре:</b> {sc.in_frame}</div>}
          {sc.angle && <div><b style={{ color: INK }}>Ракурс:</b> {sc.angle}</div>}
          {sc.background && <div><b style={{ color: INK }}>Фон:</b> {sc.background}</div>}
          {sc.light && <div><b style={{ color: INK }}>Свет:</b> {sc.light}</div>}
          {sc.editing_hints && <div><b style={{ color: INK }}>Монтаж:</b> {sc.editing_hints}</div>}
          {sc.music_hint && <div><b style={{ color: INK }}>Музыка:</b> {sc.music_hint}</div>}
        </div>
      )}

      {/* действия */}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          onClick={() => save(false)}
          disabled={savedState !== "idle"}
          style={{ flex: 1, appearance: "none", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, cursor: savedState === "idle" ? "pointer" : "default", padding: "12px 0", borderRadius: 13, border: "none", background: savedState === "saved" ? "rgba(79,212,137,0.18)" : IG_GRADIENT, color: savedState === "saved" ? ACC_GREEN : "#fff" }}
        >
          {savedState === "saving" ? "Сохраняю…" : savedState === "saved" ? "Сохранено ✓" : "Сохранить"}
        </button>
        <button onClick={() => save(true)} style={{ flex: 1, appearance: "none", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer", padding: "12px 0", borderRadius: 13, border: `1px solid ${CARD_BORDER}`, background: SOFT, color: INK }}>В план</button>
        <button onClick={copy} aria-label="Скопировать" style={{ flexShrink: 0, width: 46, appearance: "none", cursor: "pointer", padding: 0, borderRadius: 13, border: `1px solid ${CARD_BORDER}`, background: SOFT, display: "flex", alignItems: "center", justifyContent: "center" }}><CopyIcon color={MUTED} /></button>
      </div>
    </div>
  );
}

function ScriptBlock({
  label, text, refining, onRefine, multiline,
}: {
  label: string;
  text: string;
  refining?: boolean;
  onRefine?: (a: ScriptRefineAction) => void;
  multiline?: boolean;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: MUTED, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5, color: INK, whiteSpace: multiline ? "pre-wrap" : "normal" }}>{text}</div>
      {onRefine && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7, opacity: refining ? 0.5 : 1, pointerEvents: refining ? "none" : "auto" }}>
          {REFINE_BTNS.map((b) => (
            <button key={b.action} onClick={() => onRefine(b.action)} style={{ appearance: "none", fontFamily: "inherit", fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: "6px 10px", borderRadius: 999, border: `1px solid ${CARD_BORDER}`, background: SOFT, color: MUTED }}>
              {refining ? "…" : b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────────────────── Иконки ─────────────────────
function SparkleIcon({ size = 18, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" fill={color} />
      <path d="M18 14l.8 2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-1L18 14z" fill={color} />
    </svg>
  );
}
function SendIcon({ size = 20, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 12l16-7-7 16-2.5-6.5L4 12z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
function LinkIcon({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9 15l6-6M10.5 6.5l1.2-1.2a4 4 0 015.7 5.7l-1.2 1.2M13.5 17.5l-1.2 1.2a4 4 0 01-5.7-5.7l1.2-1.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CopyIcon({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="9" y="9" width="11" height="11" rx="2.5" stroke={color} strokeWidth="1.7" />
      <path d="M5 15V6.5A1.5 1.5 0 016.5 5H15" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
