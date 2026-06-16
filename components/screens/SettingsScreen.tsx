"use client";

import { useEffect, useState } from "react";
import { useFlowActions } from "../../flow";
import { getBillingSummary, getStreak, type BillingSummary, type StreakDTO } from "../../lib/api";
import { hapticImpact } from "../../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";

type Props = { onBack: () => void };

export default function SettingsScreen({ onBack: _onBack }: Props) {
  const actions = useFlowActions();
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [streak, setStreak] = useState<StreakDTO | null>(null);

  useEffect(() => {
    (async () => {
      const [b, s] = await Promise.allSettled([getBillingSummary(), getStreak()]);
      if (b.status === "fulfilled") setBilling(b.value);
      if (s.status === "fulfilled") setStreak(s.value);
    })();
  }, []);

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

  const goBilling = () => {
    hapticImpact("light");
    actions.navigate("billing");
  };

  const isFree = billing?.tier === "free";
  const tierLabel = billing?.current_config?.label ?? (billing?.tier || "free").toUpperCase();

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
          "max(calc(env(safe-area-inset-bottom) + 110px), 130px)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <h1 style={{ margin: "0 0 22px", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>
        Настройки
      </h1>

      {/* Подписка */}
      <SectionTitle>Подписка</SectionTitle>
      <button onClick={goBilling} style={subscriptionCard(isFree)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "4px 10px",
              borderRadius: 999,
              background: isFree ? YELLOW : "rgba(255,255,255,0.10)",
              color: isFree ? "#0A0608" : INK,
            }}
          >
            {tierLabel}
          </span>
          {!isFree && billing?.subscription?.expires_at && (
            <span style={{ fontSize: 11, color: MUTED }}>
              до {new Date(billing.subscription.expires_at).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          {isFree ? "Перейти на Pro" : "Управление подпиской"}
        </div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.4 }}>
          {isFree
            ? "2 поста / 2 карусели / 2 Reels в неделю"
            : "Изменить тариф или посмотреть лимиты"}
        </div>
      </button>

      {/* Активность */}
      {streak && (
        <>
          <SectionTitle style={{ marginTop: 22 }}>Активность</SectionTitle>
          <div style={infoCard}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: MUTED }}>Серия</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>
                {streak.current > 0 ? `🔥 ${streak.current}` : "—"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <span style={{ fontSize: 13, color: MUTED }}>Рекорд</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>
                {streak.longest > 0 ? `${streak.longest} дн` : "—"}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Помощь */}
      <SectionTitle style={{ marginTop: 22 }}>Помощь</SectionTitle>
      <Row
        label="Поддержка"
        sub="Написать в Telegram"
        onClick={() => {
          hapticImpact("light");
          openTg("https://t.me/Strateg_alex_bot");
        }}
      />

      {/* Правовое */}
      <SectionTitle style={{ marginTop: 22 }}>Документы</SectionTitle>
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

      <p style={{ marginTop: 26, fontSize: 11, color: MUTED, textAlign: "center", lineHeight: 1.55 }}>
        LEX AI · Янгаев С. Т. · самозанятый
        <br />
        ИНН 361605939517
      </p>
    </div>
  );
}

function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: MUTED,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        fontWeight: 700,
        margin: "0 0 8px 4px",
        ...style,
      }}
    >
      {children}
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

const subscriptionCard = (isFree: boolean): React.CSSProperties => ({
  appearance: "none",
  width: "100%",
  textAlign: "left",
  background: isFree ? "rgba(245,231,10,0.06)" : CARD_BG,
  border: `1px solid ${isFree ? "rgba(245,231,10,0.30)" : CARD_BORDER}`,
  borderRadius: 16,
  padding: 16,
  color: INK,
  fontFamily: "inherit",
  cursor: "pointer",
});

const infoCard: React.CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 14,
  padding: 14,
};
