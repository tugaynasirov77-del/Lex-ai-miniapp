"use client";

import { useEffect, useState } from "react";
import { useFlow, useFlowActions } from "../../flow";
import { useReelJobPolling } from "../../hooks/useReelJobPolling";
import { ApiError, approveReel, type ReelAnimation } from "../../lib/api";
import { hapticImpact, hapticNotify, hapticSelection } from "../../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const WARN = "#F39B40";
const CHIP_BG = "rgba(255,255,255,0.06)";
const CHIP_BORDER = "rgba(255,255,255,0.12)";

const ANIMATIONS: { key: ReelAnimation; label: string; hint: string }[] = [
  { key: "slide_up", label: "Slide", hint: "взлетает снизу" },
  { key: "pop", label: "Pop", hint: "резкий выстрел" },
  { key: "fade", label: "Fade", hint: "мягкое появление" },
];

const MAX_KEYS = 12;

type Props = { onBack: () => void };

export default function ReelApproveScreen({ onBack }: Props) {
  const { state } = useFlow();
  const actions = useFlowActions();
  const { reelJobId } = state;

  const poll = useReelJobPolling(reelJobId);

  // selections — локальный state экрана, не reducer.
  // При первом рендере восстанавливаем из screenMeta (если пришёл сюда back-ом).
  const seed = (state.screenMeta.reelSelections as
    | { keys: number[]; animation: ReelAnimation }
    | undefined) ?? null;

  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(seed?.keys ?? []),
  );
  const [animation, setAnimation] = useState<ReelAnimation>(
    seed?.animation ?? "slide_up",
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Persist выбор между навигациями назад/вперёд.
  useEffect(() => {
    actions.setScreenMeta("reelSelections", {
      keys: [...selected],
      animation,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, animation]);

  const words = poll.data?.transcript_words ?? null;
  const draftId = poll.data?.draft_id ?? null;
  const projectId = poll.data?.project_id ?? null;

  // --- context-lost ---
  if (!reelJobId) {
    return (
      <ScreenWrap>
        <ErrorBlock
          title="Контекст потерян"
          body="Не нашли активный Reel."
          ctaLabel="К ВЫБОРУ ФОРМАТА"
          onCta={() => {
            actions.resetFlow();
            actions.navigate("choose-format");
          }}
        />
      </ScreenWrap>
    );
  }

  // --- loading ---
  if (!poll.data && !poll.error) {
    return (
      <ScreenWrap>
        <Header />
        <CenterMsg>Загружаем транскрипт…</CenterMsg>
      </ScreenWrap>
    );
  }

  // --- poll error ---
  if (poll.error && !poll.data) {
    return (
      <ScreenWrap>
        <ErrorBlock
          title="Не удалось загрузить"
          body={poll.error.message}
          ctaLabel="НАЗАД"
          onCta={onBack}
        />
      </ScreenWrap>
    );
  }

  // --- wrong status (already rendering / done) → go review ---
  const status = poll.data?.status;
  if (status && status !== "awaiting_approval") {
    // Если уже не ждёт approve — нам тут делать нечего.
    queueMicrotask(() => actions.navigate("review"));
    return (
      <ScreenWrap>
        <Header />
        <CenterMsg>Уже в работе…</CenterMsg>
      </ScreenWrap>
    );
  }

  // --- empty transcript ---
  if (!words || words.length === 0) {
    return (
      <ScreenWrap>
        <Header />
        <CenterMsg>
          Транскрипт пустой. Соберём автоматически.
        </CenterMsg>
        <ActionRow
          submitting={submitting}
          submitError={submitError}
          onSubmit={() => doSubmit([], animation)}
          onSkip={() => doSubmit([], animation)}
          ctaLabel="СОБРАТЬ"
          skipLabel="Назад"
          onBack={onBack}
        />
      </ScreenWrap>
    );
  }

  const toggle = (idx: number) => {
    hapticSelection();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else if (next.size < MAX_KEYS) next.add(idx);
      return next;
    });
  };

  const clearAll = () => {
    hapticImpact("light");
    setSelected(new Set());
  };

  const doSubmit = async (keys: number[], anim: ReelAnimation) => {
    if (!projectId || !draftId) {
      setSubmitError("Нет связи с черновиком.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    hapticImpact("medium");
    try {
      await approveReel(projectId, draftId, {
        key_indices: keys,
        animation: anim,
      });
      hapticNotify("success");
      // После approve job вернётся в pending → GenerateScreen покажет процесс.
      actions.setScreenMeta("reelSelections", null);
      actions.navigate("generate");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Не получилось. Попробуйте ещё раз.";
      hapticNotify("error");
      setSubmitError(msg);
      setSubmitting(false);
    }
  };

  return (
    <ScreenWrap>
      <Header />

      <p style={{ margin: "12px 0 0", fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
        Тапните слова, которые надо выделить. До {MAX_KEYS} штук.
      </p>

      {/* Transcript chips */}
      <div
        style={{
          marginTop: 16,
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          paddingRight: 2,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {words.map((w) => {
            const on = selected.has(w.idx);
            return (
              <button
                key={w.idx}
                type="button"
                onClick={() => toggle(w.idx)}
                style={{
                  appearance: "none",
                  border: `1px solid ${on ? YELLOW : CHIP_BORDER}`,
                  background: on ? YELLOW : CHIP_BG,
                  color: on ? "#0A0608" : INK,
                  fontSize: 14,
                  fontWeight: on ? 700 : 500,
                  padding: "8px 12px",
                  borderRadius: 999,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  lineHeight: 1.1,
                  transition: "background 0.12s, color 0.12s",
                }}
              >
                {w.w}
              </button>
            );
          })}
        </div>
      </div>

      {/* Counter / clear */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12,
          color: MUTED,
        }}
      >
        <span>
          Выбрано: <span style={{ color: INK, fontWeight: 600 }}>{selected.size}</span>
          {selected.size >= MAX_KEYS && (
            <span style={{ color: WARN, marginLeft: 6 }}>лимит</span>
          )}
        </span>
        {selected.size > 0 && (
          <button onClick={clearAll} style={ghostLinkStyle}>
            очистить
          </button>
        )}
      </div>

      {/* Animation picker */}
      <div style={{ marginTop: 16 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: MUTED,
            marginBottom: 8,
            fontWeight: 600,
          }}
        >
          Анимация акцентов
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {ANIMATIONS.map((a) => {
            const on = animation === a.key;
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => {
                  hapticSelection();
                  setAnimation(a.key);
                }}
                style={{
                  appearance: "none",
                  flex: 1,
                  padding: "12px 8px",
                  borderRadius: 14,
                  border: `1.5px solid ${on ? YELLOW : CHIP_BORDER}`,
                  background: on ? "rgba(245,231,10,0.08)" : CHIP_BG,
                  color: INK,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700 }}>{a.label}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                  {a.hint}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <ActionRow
        submitting={submitting}
        submitError={submitError}
        onSubmit={() => doSubmit([...selected], animation)}
        onSkip={() => doSubmit([], animation)}
        ctaLabel="ПОДТВЕРДИТЬ"
        skipLabel="Пропустить и собрать автоматически"
        onBack={onBack}
      />
    </ScreenWrap>
  );
}

// --- pieces ---

function Header() {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: MUTED,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        Reel · акценты
      </div>
      <h1
        style={{
          margin: "10px 0 0",
          fontSize: 28,
          lineHeight: 1.05,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
        }}
      >
        Что
        <br />
        выделить
      </h1>
    </div>
  );
}

function ActionRow({
  submitting,
  submitError,
  onSubmit,
  onSkip,
  ctaLabel,
  skipLabel,
  onBack,
}: {
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
  onSkip: () => void;
  ctaLabel: string;
  skipLabel: string;
  onBack: () => void;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      {submitError && (
        <p
          style={{
            fontSize: 12,
            color: WARN,
            margin: "0 0 10px",
            textAlign: "center",
          }}
        >
          {submitError}
        </p>
      )}
      <button
        onClick={onSubmit}
        disabled={submitting}
        style={{
          ...primaryBtnStyle,
          opacity: submitting ? 0.6 : 1,
          cursor: submitting ? "default" : "pointer",
        }}
      >
        {submitting ? "СОБИРАЕМ…" : ctaLabel}
      </button>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 10,
        }}
      >
        <button onClick={onBack} style={ghostBtnStyle} disabled={submitting}>
          ← Назад
        </button>
        {skipLabel !== ctaLabel && (
          <button onClick={onSkip} style={ghostBtnStyle} disabled={submitting}>
            {skipLabel} →
          </button>
        )}
      </div>
    </div>
  );
}

function ErrorBlock({
  title,
  body,
  ctaLabel,
  onCta,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 999,
          background: "rgba(243,155,64,0.12)",
          border: `2px solid ${WARN}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: WARN,
          fontSize: 28,
          fontWeight: 800,
        }}
      >
        !
      </div>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>
        {title}
      </h2>
      <p style={{ margin: 0, fontSize: 13, color: MUTED, maxWidth: 280, lineHeight: 1.4 }}>
        {body}
      </p>
      <button onClick={onCta} style={primaryBtnStyle}>
        {ctaLabel}
      </button>
    </div>
  );
}

function CenterMsg({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p style={{ color: MUTED, fontSize: 14, textAlign: "center" }}>{children}</p>
    </div>
  );
}

function ScreenWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding:
          "max(calc(env(safe-area-inset-top) + 64px), 96px) 22px " +
          "max(calc(env(safe-area-inset-bottom) + 24px), 36px)",
      }}
    >
      {children}
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 56,
  padding: "18px 0",
  border: "none",
  borderRadius: 999,
  background: YELLOW,
  color: "#0A0608",
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
  boxShadow: `0 20px 48px ${YELLOW}33, 0 0 0 1px rgba(255,255,255,0.12) inset`,
};

const ghostBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: MUTED,
  fontSize: 12,
  cursor: "pointer",
  padding: "6px 0",
};

const ghostLinkStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: MUTED,
  fontSize: 12,
  cursor: "pointer",
  textDecoration: "underline",
  padding: 0,
};
