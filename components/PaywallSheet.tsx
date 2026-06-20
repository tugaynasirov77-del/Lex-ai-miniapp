"use client";

import { useEffect, useState } from "react";
import { hapticImpact, hapticNotify } from "../lib/telegram";
import { track } from "../lib/analytics";

const YELLOW = "#E84B91";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.60)";
const SUB_MUTED = "rgba(255,255,255,0.42)";
const CARD_BORDER = "rgba(255,255,255,0.10)";

type Props = {
  /** Контекст показа: после первого результата vs упёрся в лимит. */
  variant?: "value_moment" | "limit_reached";
  /** Заголовок-достижение (бриф: текст опирается на достигнутый результат). */
  achievement?: string;
  onClose: () => void;
};

/**
 * Paywall, показываемый ПОСЛЕ получения ценности (бриф раздел 22).
 * Не агрессивный: без таймеров и фальшивых скидок. Опирается на достигнутый
 * результат. Тарифы: Pro мес/год + Pro+ как якорь.
 */
export default function PaywallSheet({ variant = "limit_reached", achievement, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [period, setPeriod] = useState<"monthly" | "yearly">("yearly");

  useEffect(() => {
    track("paywall_opened", { variant });
  }, [variant]);

  const buy = async (tier: "pro" | "business") => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    hapticImpact("medium");
    try {
      const { createYooKassaCheckout } = await import("../lib/api");
      const { confirmation_url } = await createYooKassaCheckout(tier, period);
      const tg = (typeof window !== "undefined" && (window as any).Telegram?.WebApp) || null;
      if (tg?.openLink) tg.openLink(confirmation_url);
      else if (tg?.openTelegramLink) tg.openTelegramLink(confirmation_url);
      else window.open(confirmation_url, "_blank");
    } catch (e: any) {
      hapticNotify("error");
      setErr(e?.message || "Не удалось открыть оплату");
    } finally {
      setBusy(false);
    }
  };

  const proPrice = period === "yearly" ? "3 990 ₽/год" : "490 ₽/мес";
  const proSub = period === "yearly" ? "≈ 332 ₽/мес · −32%" : "16 ₽ в день";

  const title =
    variant === "value_moment"
      ? "Ваш первый сценарий готов"
      : "Бесплатные разборы закончились";
  const subtitle =
    variant === "value_moment"
      ? "Продолжай превращать Reels в контент для своего блога с LEX Pro."
      : "На Pro ты разбираешь до 30 Reels в месяц и собираешь сценарии без ограничений.";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(180deg, #1A1305 0%, #0A0608 100%)",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          border: "1px solid rgba(232,75,145,0.20)",
          padding: "18px 18px max(calc(env(safe-area-inset-bottom) + 18px), 28px)",
          maxHeight: "88vh",
          overflowY: "auto",
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)", margin: "0 auto 18px" }} />

        {achievement && (
          <div
            style={{
              display: "inline-block",
              padding: "5px 12px",
              borderRadius: 999,
              background: "rgba(91,214,107,0.14)",
              border: "1px solid rgba(91,214,107,0.30)",
              fontSize: 11,
              fontWeight: 700,
              color: "#5BD66B",
              marginBottom: 12,
            }}
          >
            ✓ {achievement}
          </div>
        )}

        <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: INK }}>
          {title}
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: MUTED, lineHeight: 1.5 }}>
          {subtitle}
        </p>

        {/* Бенефиты Pro */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          <Benefit text="30 разборов Reels в месяц" />
          <Benefit text="Сценарии Reels с нуля под твою нишу" />
          <Benefit text="Безлимит карусели и подписей" />
          <Benefit text="Контент-план на неделю" />
        </div>

        {/* Toggle период */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {(["monthly", "yearly"] as const).map((p) => (
            <button
              key={p}
              onClick={() => { hapticImpact("light"); setPeriod(p); }}
              style={{
                appearance: "none",
                flex: 1,
                padding: "9px 6px",
                borderRadius: 10,
                border: `1px solid ${period === p ? YELLOW : CARD_BORDER}`,
                background: period === p ? "rgba(232,75,145,0.10)" : "rgba(255,255,255,0.04)",
                color: period === p ? YELLOW : MUTED,
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: period === p ? 800 : 600,
                cursor: "pointer",
              }}
            >
              {p === "monthly" ? "Месяц" : "Год · −32%"}
            </button>
          ))}
        </div>

        {/* Цена + CTA Pro */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: YELLOW, letterSpacing: "-0.02em" }}>{proPrice}</span>
          <span style={{ fontSize: 12, color: SUB_MUTED }}>{proSub}</span>
        </div>

        <button
          onClick={() => buy("pro")}
          disabled={busy}
          style={{
            appearance: "none",
            width: "100%",
            padding: "16px 0",
            border: "none",
            borderRadius: 999,
            background: `linear-gradient(135deg, #A24FD6 0%, #E84B91 50%, #F88A4A 100%)`,
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            fontFamily: "inherit",
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.7 : 1,
            boxShadow: `0 16px 36px rgba(232,75,145,0.40), 0 0 0 1px rgba(255,255,255,0.18) inset`,
          }}
        >
          {busy ? "Открываю оплату…" : "Получить Pro"}
        </button>

        {/* Pro+ якорь */}
        <button
          onClick={() => buy("business")}
          disabled={busy}
          style={{
            appearance: "none",
            width: "100%",
            padding: "12px 0",
            marginTop: 8,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 999,
            background: "transparent",
            color: MUTED,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          Нужно больше? Pro+ — 100 разборов
        </button>

        {err && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#FF8B8B", textAlign: "center" }}>{err}</div>
        )}

        <button
          onClick={onClose}
          style={{
            appearance: "none",
            width: "100%",
            padding: "12px 0",
            marginTop: 6,
            background: "transparent",
            border: "none",
            color: SUB_MUTED,
            fontSize: 13,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          Позже
        </button>

        <div style={{ fontSize: 10, color: SUB_MUTED, textAlign: "center", marginTop: 4, lineHeight: 1.5 }}>
          Отмена в один клик · без автопродления
        </div>
      </div>
    </div>
  );
}

function Benefit({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: INK }}>
      <span style={{ color: YELLOW, fontWeight: 800, flexShrink: 0 }}>✓</span>
      <span>{text}</span>
    </div>
  );
}
