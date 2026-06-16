"use client";

import { hapticImpact } from "../../lib/telegram";

const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";

type Props = { onBack: () => void };

export default function SettingsScreen({ onBack: _onBack }: Props) {
  const openLink = (url: string) => {
    const tg = (typeof window !== "undefined" && (window as any).Telegram?.WebApp) || null;
    if (tg?.openLink) tg.openLink(url);
    else window.open(url, "_blank");
  };
  const openTg = (url: string) => {
    const tg = (typeof window !== "undefined" && (window as any).Telegram?.WebApp) || null;
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else if (tg?.openLink) tg.openLink(url);
    else window.open(url, "_blank");
  };

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
          "max(calc(env(safe-area-inset-bottom) + 96px), 116px)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <h1 style={{ margin: "0 0 18px", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>
        Настройки
      </h1>

      <Row
        label="Поддержка"
        sub="Написать в Telegram"
        onClick={() => {
          hapticImpact("light");
          openTg("https://t.me/Strateg_alex_bot");
        }}
      />
      <Row
        label="Условия использования"
        onClick={() => {
          hapticImpact("light");
          openLink("https://lex-ai-miniapp.vercel.app/legal/terms");
        }}
      />
      <Row
        label="Политика конфиденциальности"
        onClick={() => {
          hapticImpact("light");
          openLink("https://lex-ai-miniapp.vercel.app/legal/privacy");
        }}
      />

      <p style={{ marginTop: 30, fontSize: 11, color: MUTED, textAlign: "center", lineHeight: 1.5 }}>
        LEX AI · Янгаев С. Т. · самозанятый
        <br />
        ИНН 361605939517
      </p>
    </div>
  );
}

function Row({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: "none",
        textAlign: "left",
        width: "100%",
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
        padding: 14,
        marginBottom: 8,
        color: INK,
        fontFamily: "inherit",
        cursor: "pointer",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ color: MUTED, fontSize: 18 }}>›</div>
    </button>
  );
}
