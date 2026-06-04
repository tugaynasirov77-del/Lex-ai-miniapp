"use client";

import { useState } from "react";
import { useFlowActions } from "../../flow";
import { createProject, ApiError } from "../../lib/api";
import { hapticImpact, hapticNotify, hapticSelection } from "../../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const WARN = "#F39B40";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";

type Props = { onBack: () => void };
type Platform = "telegram" | "instagram";

export default function CreateProjectScreen({ onBack: _onBack }: Props) {
  const actions = useFlowActions();
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!platform && title.trim().length >= 2 && !submitting;

  const submit = async () => {
    if (!canSubmit || !platform) return;
    setSubmitting(true);
    setError(null);
    hapticImpact("medium");
    try {
      const { projectId } = await createProject({ title: title.trim(), platform });
      hapticNotify("success");
      actions.setIds({ projectId });
      actions.navigate("project");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.status === 401
            ? "Сессия истекла. Перезапустите Mini App."
            : e.message
          : e instanceof Error
            ? e.message
            : "Не получилось. Попробуйте ещё раз.";
      hapticNotify("error");
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <ScreenWrap>
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
          Новый проект
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
          Выберите
          <br />
          платформу
        </h1>
        <p
          style={{ margin: "10px 0 0", fontSize: 13, color: MUTED, lineHeight: 1.45 }}
        >
          Один проект = один канал или аккаунт.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        {(["telegram", "instagram"] as Platform[]).map((p) => {
          const on = platform === p;
          return (
            <button
              key={p}
              onClick={() => {
                hapticSelection();
                setPlatform(p);
              }}
              style={{
                appearance: "none",
                flex: 1,
                padding: "20px 12px",
                borderRadius: 18,
                border: `1.5px solid ${on ? YELLOW : CARD_BORDER}`,
                background: on ? "rgba(245,231,10,0.08)" : CARD_BG,
                color: INK,
                fontFamily: "inherit",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  margin: "0 auto 10px",
                  borderRadius: 12,
                  background:
                    p === "telegram" ? "rgba(40,160,235,0.14)" : "rgba(225,48,108,0.14)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: p === "telegram" ? "#28A0EB" : "#E1306C",
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                {p === "telegram" ? "TG" : "IG"}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                {p === "telegram" ? "Telegram" : "Instagram"}
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                {p === "telegram" ? "Канал" : "Аккаунт"}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 24 }}>
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
          Название проекта
        </div>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError(null);
          }}
          maxLength={60}
          placeholder="Например: Мой канал про маркетинг"
          style={{
            width: "100%",
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 14,
            color: INK,
            fontSize: 15,
            fontFamily: "inherit",
            padding: "14px 16px",
            outline: "none",
          }}
        />
        <p style={{ fontSize: 11, color: MUTED, margin: "8px 2px 0" }}>
          Канал можно подключить позже, в настройках проекта.
        </p>
      </div>

      <div style={{ flex: 1 }} />

      {error && (
        <p
          style={{ fontSize: 12, color: WARN, textAlign: "center", margin: "0 0 10px" }}
        >
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
        {submitting ? "СОЗДАЁМ…" : "СОЗДАТЬ ПРОЕКТ"}
      </button>
    </ScreenWrap>
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
  boxShadow: `0 20px 48px ${YELLOW}33, 0 0 0 1px rgba(255,255,255,0.12) inset`,
};
