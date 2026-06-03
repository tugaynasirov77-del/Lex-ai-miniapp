"use client";

import { useEffect, useMemo } from "react";
import {
  useFlow,
  useFlowActions,
  type ContentFormat,
} from "../../flow";
import { useDraftPolling } from "../../hooks/useDraftPolling";
import { useReelJobPolling } from "../../hooks/useReelJobPolling";
import { hapticNotify } from "../../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const WARN = "#F39B40";

type Props = {
  onBack: () => void;
};

// --- copy ---

const SUBTITLE: Record<ContentFormat, string> = {
  reel: "Рендер видео — 1–3 минуты.",
  carousel: "Обычно 30–60 секунд.",
  post: "Обычно 15–30 секунд.",
  "weekly-plan": "Собираем 7 идей. До минуты.",
};

const STEPS: Record<ContentFormat, [string, string, string]> = {
  carousel: ["Алина пишет слайды", "Аркадий редактирует структуру", "Финальная сборка"],
  post: ["Алина пишет черновик", "Аркадий редактирует", "Финальная сборка"],
  "weekly-plan": ["Александр изучает аудиторию", "Собираем 7 идей", "Аркадий проверяет план"],
  reel: ["Команда взяла файл", "Слушаем аудио", "Готовим монтаж"],
};

// --- helpers ---

function deriveDraftPhase(status: string | undefined): 0 | 1 | 2 {
  // 0 — current = writing; 1 — review; 2 — finalize
  if (status === "reviewing") return 1;
  if (status === "ready" || status === "published") return 2;
  return 0;
}

function deriveReelPhase(
  status: string | undefined,
  phase: string | null | undefined,
): 0 | 1 | 2 {
  if (status === "claimed" && !phase) return 0;
  if (phase === "download") return 0;
  if (phase === "validate") return 0;
  if (phase === "transcribe") return 1;
  if (phase === "render" || phase === "upload") return 2;
  if (status === "awaiting_approval" || status === "done") return 2;
  return 0;
}

// --- component ---

export default function GenerateScreen({ onBack: _onBack }: Props) {
  const { state } = useFlow();
  const actions = useFlowActions();
  const { format, draftId, weeklyPlanId, reelJobId } = state;

  const isReel = format === "reel";
  const isPlan = format === "weekly-plan";

  // Подбираем правильный polling под формат.
  const draftPoll = useDraftPolling(
    isPlan ? "weekly-plan" : "draft",
    isReel ? null : isPlan ? weeklyPlanId : draftId,
  );
  const reelPoll = useReelJobPolling(isReel ? reelJobId : null);

  const status = isReel ? reelPoll.data?.status : draftPoll.data?.status;
  const phase = isReel ? reelPoll.data?.phase : undefined;
  const error = isReel ? reelPoll.error : draftPoll.error;
  const errorMsg = isReel ? reelPoll.data?.error : draftPoll.data?.error;
  const isReady = !isReel && draftPoll.isReady;
  const isFailed =
    (isReel && reelPoll.isFailed) || (!isReel && draftPoll.isFailed);
  const isAwaitingApproval = isReel && reelPoll.isAwaitingApproval;
  const isDoneReel = isReel && reelPoll.isDone;

  // Шаги — какие пройдены, какой текущий.
  const stepIndex = useMemo<0 | 1 | 2>(() => {
    if (!format) return 0;
    if (isReel) return deriveReelPhase(status, phase);
    return deriveDraftPhase(status);
  }, [format, isReel, status, phase]);

  // H1 по состоянию.
  const h1 = isFailed
    ? "Что-то пошло не так"
    : isReady || isDoneReel
      ? "Готово!"
      : status === "reviewing"
        ? "Проверяем качество"
        : "Команда работает";

  // Auto-transition на review при terminal-success.
  useEffect(() => {
    if (!format) return;
    if (isReady) {
      hapticNotify("success");
      const t = setTimeout(() => actions.navigate("review"), 800);
      return () => clearTimeout(t);
    }
    if (isDoneReel) {
      hapticNotify("success");
      const t = setTimeout(() => actions.navigate("review"), 800);
      return () => clearTimeout(t);
    }
    if (isAwaitingApproval) {
      // TODO: когда появится reel-approve screen, навигейтить туда.
      // Сейчас ведём на review, юзер увидит карточку с возможностью apprve.
      hapticNotify("success");
      const t = setTimeout(() => actions.navigate("review"), 800);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, isDoneReel, isAwaitingApproval, format]);

  // Context-lost — если на mount нет ни одного id для текущего format.
  const contextLost =
    !!format &&
    !isReady &&
    !isFailed &&
    ((isReel && !reelJobId) ||
      (isPlan && !weeklyPlanId) ||
      (!isReel && !isPlan && !draftId));

  if (contextLost) {
    return (
      <ScreenWrap>
        <ErrorBlock
          title="Контекст потерян"
          body="Не нашли активный черновик. Начните заново."
          ctaLabel="К ВЫБОРУ ФОРМАТА"
          onCta={() => {
            actions.resetFlow();
            actions.navigate("choose-format");
          }}
        />
      </ScreenWrap>
    );
  }

  if (isFailed) {
    return (
      <ScreenWrap>
        <ErrorBlock
          title="Не получилось с первого раза"
          body={errorMsg || "Иногда команде нужна вторая попытка."}
          ctaLabel="ПОПРОБОВАТЬ ЕЩЁ РАЗ"
          onCta={() => {
            // Возврат на brief — там можно поправить и нажать submit заново.
            // Reel-фейл — на choose-format (нужен новый upload).
            if (isReel) {
              actions.resetFlow();
              actions.navigate("choose-format");
            } else {
              actions.navigate("project-brief");
            }
          }}
          secondaryLabel="Назад к выбору формата →"
          onSecondary={() => {
            actions.resetFlow();
            actions.navigate("choose-format");
          }}
        />
      </ScreenWrap>
    );
  }

  return (
    <ScreenWrap>
      {/* HEADING */}
      <h1
        style={{
          margin: 0,
          fontSize: 30,
          lineHeight: 1.02,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
        }}
      >
        {h1.split(" ").map((w, i) => (
          <span key={i} style={{ display: "block" }}>
            {w}
          </span>
        ))}
      </h1>
      {!isReady && !isDoneReel && format && (
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 13,
            lineHeight: 1.4,
            color: MUTED,
          }}
        >
          {SUBTITLE[format]}
        </p>
      )}

      {/* SPACER */}
      <div style={{ flex: 1 }} />

      {/* PULSE / SUCCESS */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
        {isReady || isDoneReel || isAwaitingApproval ? <SuccessDot /> : <PulseDot />}
      </div>

      {/* STEPS */}
      {format && !isReady && !isDoneReel && !isAwaitingApproval && (
        <StepList steps={STEPS[format]} active={stepIndex} />
      )}

      {/* SPACER */}
      <div style={{ flex: 1 }} />

      {/* BOTTOM HINT */}
      {!isReady && !isDoneReel && !isFailed && (
        <p
          style={{
            fontSize: 12,
            color: MUTED,
            textAlign: "center",
            margin: 0,
          }}
        >
          {error
            ? "Связь нестабильна — продолжаем пробовать…"
            : "Можно закрыть приложение — пришлём пуш."}
        </p>
      )}

      <style>{`
        @keyframes lex-pulse-soft {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.18); opacity: 0.7; }
        }
        @keyframes lex-step-pulse {
          0%, 100% { box-shadow: 0 0 0 0 ${YELLOW}66; }
          50% { box-shadow: 0 0 0 6px transparent; }
        }
      `}</style>
    </ScreenWrap>
  );
}

// --- inline pieces ---

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
          "max(calc(env(safe-area-inset-bottom) + 32px), 48px)",
      }}
    >
      {children}
    </div>
  );
}

function PulseDot() {
  return (
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: 999,
        background: YELLOW,
        boxShadow: `0 0 60px ${YELLOW}55`,
        animation: "lex-pulse-soft 1.4s ease-in-out infinite",
      }}
    />
  );
}

function SuccessDot() {
  return (
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: 999,
        background: YELLOW,
        boxShadow: `0 0 80px ${YELLOW}88`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#0A0608",
        fontSize: 32,
        fontWeight: 900,
      }}
    >
      ✓
    </div>
  );
}

function StepList({
  steps,
  active,
}: {
  steps: [string, string, string];
  active: 0 | 1 | 2;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {steps.map((s, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <div
            key={s}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 14,
              color: done ? MUTED : current ? INK : "rgba(255,255,255,0.35)",
              fontWeight: current ? 600 : 400,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                display: "inline-block",
                flexShrink: 0,
                background: done
                  ? "rgba(255,255,255,0.25)"
                  : current
                    ? YELLOW
                    : "transparent",
                border: current
                  ? "none"
                  : `1.5px solid ${done ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.2)"}`,
                animation: current ? "lex-step-pulse 1.2s ease-in-out infinite" : undefined,
              }}
            />
            <span>
              {done ? "✓ " : ""}
              {s}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ErrorBlock({
  title,
  body,
  ctaLabel,
  onCta,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
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
          marginBottom: 4,
        }}
      >
        !
      </div>
      <h2
        style={{
          margin: 0,
          fontSize: 24,
          lineHeight: 1.1,
          fontWeight: 800,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h2>
      <p style={{ margin: 0, fontSize: 13, color: MUTED, maxWidth: 280, lineHeight: 1.4 }}>
        {body}
      </p>
      <button
        onClick={onCta}
        style={{
          marginTop: 14,
          minHeight: 52,
          padding: "16px 28px",
          border: "none",
          borderRadius: 999,
          background: YELLOW,
          color: "#0A0608",
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          cursor: "pointer",
          boxShadow: `0 18px 40px ${YELLOW}33, 0 0 0 1px rgba(255,255,255,0.12) inset`,
        }}
      >
        {ctaLabel}
      </button>
      {secondaryLabel && (
        <button
          onClick={onSecondary}
          style={{
            background: "transparent",
            border: "none",
            color: MUTED,
            fontSize: 13,
            cursor: "pointer",
            padding: "8px 0",
          }}
        >
          {secondaryLabel}
        </button>
      )}
    </div>
  );
}
