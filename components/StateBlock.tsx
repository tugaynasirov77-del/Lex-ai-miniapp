"use client";

import { hapticImpact } from "../lib/telegram";

const YELLOW = "#E84B91";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const DANGER_BG = "rgba(255,115,115,0.08)";
const DANGER_BORDER = "rgba(255,115,115,0.30)";
const DANGER = "#FF8B8B";

type Props = {
  /** Эмодзи-иконка по центру (например «📭», «⚠️», «🔌»). */
  emoji?: string;
  title: string;
  body?: string;
  /** Основное действие (обычно retry / «вставить другую ссылку»). */
  action?: { label: string; onClick: () => void };
  /** Вторичное текстовое действие под кнопкой. */
  secondary?: { label: string; onClick: () => void };
  /** error → красноватый акцент рамки, neutral → нейтральная карточка. */
  tone?: "neutral" | "error";
  /** Компактный вид (меньше отступов, для встроенных мест). */
  compact?: boolean;
};

/**
 * Единый блок пустых/ошибочных состояний (бриф раздел 23).
 * Объясняет ЧТО произошло и ЧТО можно сделать.
 */
export default function StateBlock({
  emoji,
  title,
  body,
  action,
  secondary,
  tone = "neutral",
  compact = false,
}: Props) {
  const isError = tone === "error";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 10,
        padding: compact ? "18px 16px" : "28px 20px",
        borderRadius: 16,
        background: isError ? DANGER_BG : CARD_BG,
        border: `1px solid ${isError ? DANGER_BORDER : CARD_BORDER}`,
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {emoji && <div style={{ fontSize: compact ? 30 : 38, lineHeight: 1 }}>{emoji}</div>}
      <div
        style={{
          fontSize: compact ? 14 : 16,
          fontWeight: 700,
          lineHeight: 1.25,
          color: isError ? DANGER : INK,
          maxWidth: 300,
        }}
      >
        {title}
      </div>
      {body && (
        <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5, maxWidth: 300 }}>
          {body}
        </div>
      )}
      {action && (
        <button
          onClick={() => {
            hapticImpact("light");
            action.onClick();
          }}
          style={{
            appearance: "none",
            marginTop: 6,
            padding: "11px 22px",
            border: "none",
            borderRadius: 999,
            background: `linear-gradient(135deg, #A24FD6 0%, #E84B91 50%, #F88A4A 100%)`,
            color: "#FFFFFF",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.02em",
            cursor: "pointer",
            boxShadow: `0 10px 24px ${YELLOW}33, 0 0 0 1px rgba(255,255,255,0.14) inset`,
          }}
        >
          {action.label}
        </button>
      )}
      {secondary && (
        <button
          onClick={() => {
            hapticImpact("light");
            secondary.onClick();
          }}
          style={{
            appearance: "none",
            background: "transparent",
            border: "none",
            color: MUTED,
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            padding: "2px 0",
          }}
        >
          {secondary.label}
        </button>
      )}
    </div>
  );
}
