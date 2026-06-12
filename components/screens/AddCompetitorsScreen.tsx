"use client";

import { useEffect, useState } from "react";
import { useFlow, useFlowActions } from "../../flow";
import {
  addIgCompetitor,
  addTgCompetitor,
  ApiError,
  listProjects,
} from "../../lib/api";
import { markAutoStart } from "../../hooks/useAutoStartAgents";
import {
  hapticImpact,
  hapticNotify,
  hapticSelection,
} from "../../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const WARN = "#F39B40";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";

const MAX_HANDLES = 3;

type Props = { onBack: () => void };
type Platform = "telegram" | "instagram";

/**
 * Onboarding шаг 3a: добавление 1-3 конкурентов.
 * Платформу берём из screenMeta.onboardingPlatform (стэшим при переходе
 * из CreateProjectScreen). Если screenMeta пустой (resume после рестарта
 * WebView) — подтягиваем из listProjects.
 */
export default function AddCompetitorsScreen({ onBack: _onBack }: Props) {
  const { state } = useFlow();
  const actions = useFlowActions();

  const initialPlatform =
    (state.screenMeta.onboardingPlatform as Platform | undefined) ?? null;

  const [platform, setPlatform] = useState<Platform | null>(initialPlatform);
  const [resolving, setResolving] = useState<boolean>(!initialPlatform);
  const [draft, setDraft] = useState("");
  const [handles, setHandles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Defensive: нет projectId → отбрасываем юзера в onboarding.
  useEffect(() => {
    if (!state.projectId) {
      actions.navigate("create-project");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Если платформу не передали в screenMeta — узнаём из listProjects.
  useEffect(() => {
    if (platform || !state.projectId) {
      setResolving(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await listProjects();
        const p = r.projects.find((x) => x.id === state.projectId);
        if (cancelled) return;
        if (!p) {
          actions.setIds({ projectId: null });
          actions.navigate("create-project");
          return;
        }
        setPlatform(p.platform);
      } catch {
        // Сеть упала — оставим resolving false; юзер увидит generic error.
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalize = (raw: string): string =>
    raw.trim().replace(/^https?:\/\/(www\.)?(t\.me|instagram\.com)\//i, "").replace(/^@/, "").replace(/\/$/, "");

  const addHandle = () => {
    const h = normalize(draft);
    if (!h || h.length < 3) {
      setError("Введите @username (минимум 3 символа).");
      return;
    }
    if (handles.includes(h)) {
      setError("Этот аккаунт уже добавлен.");
      return;
    }
    if (handles.length >= MAX_HANDLES) {
      setError(`Максимум ${MAX_HANDLES} конкурента.`);
      return;
    }
    hapticSelection();
    setHandles((arr) => [...arr, h]);
    setDraft("");
    setError(null);
  };

  const removeHandle = (h: string) => {
    hapticSelection();
    setHandles((arr) => arr.filter((x) => x !== h));
  };

  const canSubmit = handles.length >= 1 && handles.length <= MAX_HANDLES && !busy && !!platform;

  const submit = async () => {
    if (!canSubmit || !platform || !state.projectId) return;
    setBusy(true);
    setError(null);
    hapticImpact("medium");
    try {
      // Sequential — endpoint принимает по одному, плюс это даёт ясную ошибку
      // (мы знаем на каком handle упало, если что).
      for (const h of handles) {
        if (platform === "telegram") {
          await addTgCompetitor(state.projectId, { username: h });
        } else {
          await addIgCompetitor(state.projectId, { handle: h });
        }
      }
      hapticNotify("success");
      // Очищаем onboarding-метку. Идём в проект.
      actions.setScreenMeta("onboardingPlatform", undefined);
      // Даём Supabase replica зафиксировать INSERT'ы конкурентов перед
      // тем как Анна полезет их SELECT'ить. Без этого встречается race:
      // analyze видит пустую таблицу → 400 "no competitors added".
      await new Promise((resolve) => setTimeout(resolve, 1500));
      // Ставим маркер для useAutoStartAgents в ProjectScreen — он
      // подхватит и параллельно запустит analyze + plan.
      markAutoStart(state.projectId);
      actions.navigate("project");
    } catch (e) {
      hapticNotify("error");
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Не получилось сохранить.",
      );
      setBusy(false);
    }
  };

  if (resolving) {
    return (
      <ScreenWrap>
        <div style={{ flex: 1 }} />
        <div style={{ color: MUTED, fontSize: 13, textAlign: "center" }}>
          Загружаем проект…
        </div>
        <div style={{ flex: 1 }} />
      </ScreenWrap>
    );
  }

  const isIg = platform === "instagram";
  const placeholder = isIg ? "@nike" : "@durov";

  return (
    <ScreenWrap>
      <StepBadge label="Конкуренты" />
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
        Кого мы
        <br />
        изучаем?
      </h1>
      <p style={{ margin: "10px 0 0", fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
        Добавьте 1–{MAX_HANDLES} {isIg ? "Instagram-аккаунта" : "Telegram-канала"} в
        вашей нише. Агенты разберут их посты и предложат, что писать вам.
      </p>

      <div style={{ marginTop: 22 }}>
        <Label>@username конкурента</Label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addHandle();
              }
            }}
            placeholder={placeholder}
            maxLength={80}
            disabled={handles.length >= MAX_HANDLES}
            style={{
              ...inputStyle,
              flex: 1,
              opacity: handles.length >= MAX_HANDLES ? 0.5 : 1,
            }}
          />
          <button
            onClick={addHandle}
            disabled={!draft.trim() || handles.length >= MAX_HANDLES}
            style={{
              appearance: "none",
              minWidth: 56,
              padding: "0 18px",
              borderRadius: 14,
              border: `1px solid ${YELLOW}`,
              background: "rgba(245,231,10,0.1)",
              color: YELLOW,
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              opacity: !draft.trim() || handles.length >= MAX_HANDLES ? 0.4 : 1,
            }}
          >
            +
          </button>
        </div>

        {/* Список добавленных handles */}
        {handles.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 14,
            }}
          >
            {handles.map((h) => (
              <span
                key={h}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "rgba(245,231,10,0.1)",
                  border: `1px solid rgba(245,231,10,0.35)`,
                  color: INK,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                @{h}
                <button
                  onClick={() => removeHandle(h)}
                  aria-label={`Убрать @${h}`}
                  style={{
                    appearance: "none",
                    border: "none",
                    background: "transparent",
                    color: MUTED,
                    fontSize: 16,
                    cursor: "pointer",
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <p style={{ margin: "12px 2px 0", fontSize: 11, color: MUTED }}>
          {handles.length} / {MAX_HANDLES} добавлено
        </p>
      </div>

      <div style={{ flex: 1 }} />

      {error && (
        <p style={{ fontSize: 12, color: WARN, textAlign: "center", margin: "0 0 10px" }}>
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={!canSubmit}
        style={{
          ...primaryBtn,
          opacity: canSubmit ? 1 : 0.4,
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
      >
        {busy ? "СОХРАНЯЕМ…" : "ПРОДОЛЖИТЬ"}
      </button>
    </ScreenWrap>
  );
}

// --- shared bits ---

function StepBadge({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: MUTED,
        fontWeight: 600,
      }}
    >
      <span style={{ color: YELLOW }}>Шаг 3/3</span>
      <span style={{ opacity: 0.5 }}>·</span>
      <span>{label}</span>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 14,
  color: INK,
  fontSize: 15,
  fontFamily: "inherit",
  padding: "14px 16px",
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
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
