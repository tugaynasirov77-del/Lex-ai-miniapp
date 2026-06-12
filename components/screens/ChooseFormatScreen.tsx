"use client";

import { useEffect } from "react";
import { hapticSelection } from "../../lib/telegram";
import { useFlow, useFlowActions } from "../../flow";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";

type Format = {
  id: "reel" | "carousel" | "post";
  title: string;
  subtitle: string;
};

const FORMATS: Format[] = [
  { id: "reel",     title: "Reel",     subtitle: "Вертикальное видео с субтитрами" },
  { id: "carousel", title: "Карусель", subtitle: "6–8 слайдов под Instagram" },
  { id: "post",     title: "Пост",     subtitle: "Текст для Telegram-канала" },
];

type Props = {
  onPick: (format: Format["id"]) => void;
  onBack: () => void;
};

export default function ChooseFormatScreen({ onPick, onBack: _onBack }: Props) {
  const { state } = useFlow();
  const actions = useFlowActions();

  // Review-only режим: ручной выбор формата отключён. Если юзер сюда
  // попал (старый deep-link, resume из localStorage от предыдущей версии)
  // — мягкий редирект на проект (если есть) или на dashboard.
  useEffect(() => {
    if (state.projectId) {
      actions.navigate("project");
    } else {
      actions.navigate("dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        padding: "max(calc(env(safe-area-inset-top) + 64px), 96px) 22px " +
          "max(calc(env(safe-area-inset-bottom) + 32px), 48px)",
      }}
    >
      {/* HEADING */}
      <div>
        <div style={{ fontSize: 12, color: MUTED, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
          Шаг 1 из 3
        </div>
        <h1
          style={{
            margin: "10px 0 0",
            fontSize: 30,
            lineHeight: 1.02,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
          }}
        >
          Что будем
          <br />
          делать?
        </h1>
        <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.4, color: MUTED }}>
          Выберите формат — команда AI соберёт под него
        </p>
      </div>

      {/* OPTIONS */}
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        {FORMATS.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              hapticSelection();
              onPick(f.id);
            }}
            style={{
              textAlign: "left",
              padding: "18px 20px",
              borderRadius: 22,
              background: "linear-gradient(180deg, rgba(22,16,20,0.92), rgba(14,10,14,0.88))",
              border: "1px solid rgba(255,255,255,0.08)",
              color: INK,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
                {f.title}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: MUTED }}>
                {f.subtitle}
              </div>
            </div>
            <span
              style={{
                flexShrink: 0,
                width: 36,
                height: 36,
                borderRadius: 999,
                background: YELLOW,
                color: "#0A0608",
                fontSize: 18,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-hidden
            >
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
