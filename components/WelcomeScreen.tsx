"use client";

import { hapticImpact } from "../lib/telegram";

// ─── Тёмная тема (в гамму главной) ───
const BG = "#0B0B11";
const INK = "#F4F4F8";
const MUTED = "#9A9AAB";
const SUB_MUTED = "#6B6B7B";
const CARD_BG = "#15151E";
const CARD_BORDER = "#262630";
const SOFT = "#1C1C26";
const IG_GRADIENT = "linear-gradient(95deg, #A24FD6 0%, #E84B91 50%, #F88A4A 100%)";
const PINK = "#E84B91";
const PURPLE = "#A24FD6";

// Тинты для плашек иконок
const TINT_PURPLE = "rgba(162,79,214,0.16)";
const TINT_PINK = "rgba(232,75,145,0.16)";
const TINT_ORANGE = "rgba(248,138,74,0.16)";

function iconTile(hex: string): React.CSSProperties {
  return {
    background: `linear-gradient(150deg, ${hex}30, ${hex}12)`,
    border: `1px solid ${hex}3D`,
    boxShadow: `0 6px 16px ${hex}26, inset 0 1px 0 ${hex}24`,
  };
}

type Props = {
  onStart: () => void;
  onSkipToCreate: () => void;
  onComplete: () => void;
};

export default function WelcomeScreen({ onStart, onComplete }: Props) {
  const go = () => {
    hapticImpact("medium");
    onComplete();
    onStart();
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: BG,
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding:
          "max(calc(env(safe-area-inset-top) + 18px), 32px) 16px " +
          "max(calc(env(safe-area-inset-bottom) + 16px), 22px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* spacer — прижимает весь контент вниз, к кнопке */}
      <div style={{ flex: 1 }} />

      {/* Заголовок */}
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.18, textAlign: "center", color: INK }}>
        Превращай{" "}
        <span style={{ background: IG_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          вирусные Reels
        </span>
        <br />
        в сценарии под свой стиль
      </h1>
      <p style={{ margin: "8px auto 64px", fontSize: 12.5, color: MUTED, lineHeight: 1.45, textAlign: "center", maxWidth: 320 }}>
        AI анализирует любой Reels и переписывает его под твою нишу и тон.
      </p>

      {/* Демо-карточка */}
      <div style={{
        background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 18,
        padding: 12, marginBottom: 12,
        boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <Pill text="Залетевший Reels" color={PURPLE} bg={TINT_PURPLE} />
          <Pill text="Под тебя" color={PINK} bg={TINT_PINK} />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <div
            id="lex-welcome-photo"
            style={{
              flexShrink: 0, width: 96, aspectRatio: "9 / 16",
              borderRadius: 11, background: SOFT,
              border: `1px solid ${CARD_BORDER}`,
              position: "relative", overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/welcome-hero.jpg"
              alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
            <div style={{
              minWidth: 44, height: 26, padding: "0 7px 0 9px", borderRadius: 999,
              background: IG_GRADIENT,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              fontSize: 9, fontWeight: 800, color: "#FFFFFF", letterSpacing: "0.04em",
              boxShadow: `0 6px 16px ${PINK}55`,
            }}>
              AI
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <AnalysisBlock icon={<TargetIcon size={11} color={PURPLE} />} label="Hook" body="Почему ты устаёшь, даже когда ничего не делаешь?" accent={PURPLE} />
            <AnalysisBlock icon={<ScriptIcon size={11} color={PINK} />} label="Сценарий" body="1. Большинство думают… 2. Но проблема…" accent={PINK} />
            <AnalysisBlock icon={<BoltIcon size={11} color="#F0944E" />} label="CTA" body="Сохрани и напиши «Хочу больше»" accent="#F0944E" />
          </div>
        </div>
      </div>

      {/* 3 фичи */}
      <div style={{
        background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 18,
        padding: "14px 10px", marginBottom: 14,
        boxShadow: "0 8px 28px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", gap: 4 }}>
          <Feature icon={<FlameIcon size={18} color="#F0944E" />} accent="#F0944E" title="Анализ хука" body="Почему ролик залетел" />
          <Feature icon={<WandIcon size={18} color="#F3A9CE" />} accent={PINK} title="Готовый сценарий" body="Текст под тебя" />
          <Feature icon={<TargetIcon size={18} color="#C78BEB" />} accent={PURPLE} title="Под твой стиль" body="AI учтёт нишу" />
        </div>
      </div>

      {/* spacer под фичами — поднимает контент над кнопкой */}
      <div style={{ height: 72 }} />

      {/* CTA */}
      <button
        onClick={go}
        style={{
          appearance: "none", width: "100%", padding: "14px 0", border: "none", borderRadius: 16,
          background: IG_GRADIENT, color: "#FFFFFF", fontSize: 14.5, fontWeight: 800,
          letterSpacing: "0.01em", fontFamily: "inherit", cursor: "pointer",
          boxShadow: `0 14px 32px ${PINK}50`,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        Настроить AI под себя <ArrowIcon size={16} />
      </button>

      <div style={{
        marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        color: MUTED, fontSize: 11, fontWeight: 600,
      }}>
        <AvatarStack />
        360+ блогеров уже работают с LEX
      </div>
    </div>
  );
}

// ───────── Подкомпоненты ─────────

function Pill({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "5px 10px", borderRadius: 999,
      background: bg, border: `1px solid ${color}33`, color,
      letterSpacing: "0.02em",
    }}>
      {text}
    </span>
  );
}

function AnalysisBlock({ icon, label, body, accent }: { icon: React.ReactNode; label: string; body: string; accent: string }) {
  return (
    <div style={{
      background: SOFT, border: `1px solid ${CARD_BORDER}`, borderRadius: 9, padding: "6px 8px",
      borderLeft: `2px solid ${accent}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
        {icon}
        <span style={{ fontSize: 9, fontWeight: 800, color: accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ fontSize: 10, color: INK, lineHeight: 1.3, fontWeight: 500 }}>{body}</div>
    </div>
  );
}

function Feature({ icon, accent, title, body }: { icon: React.ReactNode; accent: string; title: string; body: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "0 2px" }}>
      <div style={{ width: 38, height: 38, margin: "0 auto 6px", borderRadius: 11, ...iconTile(accent), display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, color: INK, lineHeight: 1.2, marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 9.5, color: MUTED, lineHeight: 1.3 }}>{body}</div>
    </div>
  );
}

function AvatarStack() {
  const dots = [PURPLE, PINK, "#F0944E"];
  return (
    <div style={{ display: "flex" }}>
      {dots.map((c, i) => (
        <div key={i} style={{
          width: 22, height: 22, borderRadius: 999,
          background: c, border: `2px solid ${BG}`,
          marginLeft: i === 0 ? 0 : -8,
        }} />
      ))}
    </div>
  );
}

// ───────── Иконки ─────────
type IconProps = { size?: number; color?: string };

function TargetIcon({ size = 16, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="10.5" cy="13.5" r="7.5" stroke={color} strokeWidth="1.7" />
      <circle cx="10.5" cy="13.5" r="3.6" stroke={color} strokeWidth="1.7" />
      <circle cx="10.5" cy="13.5" r="0.9" fill={color} />
      <path d="M10.5 13.5L19.5 4.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M15.5 4.5h4v4" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScriptIcon({ size = 16, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="3" stroke={color} strokeWidth="1.7" />
      <path d="M8 9h8M8 13h8M8 17h5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function BoltIcon({ size = 16, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M13 2L4.5 13.2c-.4.5 0 1.3.7 1.3H11l-1 7.5 8.5-11.2c.4-.5 0-1.3-.7-1.3H12l1-7.5z" fill={color} />
    </svg>
  );
}

function FlameIcon({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12.5 2c.4 2.8 2.3 4.3 3.6 5.9C17.6 9.7 18.5 11.6 18.5 14a6.5 6.5 0 11-13 0c0-2.3 1.1-4 2.3-5.4.3 1.1.9 1.9 1.8 2.4C8.7 8 10 5.4 12.5 2z" fill={color} />
    </svg>
  );
}

function WandIcon({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 20l9-9" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 2.5l1.1 2.9 2.9 1.1-2.9 1.1L16 10.5l-1.1-2.9L12 6.5l2.9-1.1L16 2.5z" fill={color} />
      <path d="M19.5 12.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5z" fill={color} />
    </svg>
  );
}

function ArrowIcon({ size = 18, color = "#FFFFFF" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
