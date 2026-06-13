"use client";

import { useCallback, useEffect, useState } from "react";

type LimitSpec = { count: number; period: "week" | "month" };

type TierConfig = {
  tier: "free" | "pro" | "business";
  label: string;
  priceStars: number;
  priceRub: number;
  limits: {
    post: LimitSpec;
    carousel: LimitSpec;
    reel: LimitSpec;
  };
  maxProjects: number;
  monthlyCapUsd: number;
  available: boolean;
  features: string[];
};

type UsageEntry = { used: number; limit: number; period: "week" | "month" };

type BillingState = {
  tier: TierConfig["tier"];
  current_config: TierConfig;
  subscription: any;
  usage: {
    post: UsageEntry;
    carousel: UsageEntry;
    reel: UsageEntry;
  };
  available_tiers: TierConfig[];
  payments_enabled: boolean;
};

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const OK = "#5BD66B";
const WARN = "#F39B40";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.10)";

function initData(): string {
  if (typeof window === "undefined") return "";
  return (window as any).Telegram?.WebApp?.initData || "";
}

type Props = { onBack: () => void };

export default function BillingScreen({ onBack }: Props) {
  const [state, setState] = useState<BillingState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/billing", {
        headers: { "x-telegram-init-data": initData() },
        cache: "no-store",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "fail");
      setState(d);
    } catch (e: any) {
      setError(e?.message || "не удалось загрузить");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding:
          "max(calc(env(safe-area-inset-top) + 56px), 88px) 18px " +
          "max(calc(env(safe-area-inset-bottom) + 28px), 40px)",
        overflowY: "auto",
      }}
    >
      <button onClick={onBack} style={ghostBtn()}>← Назад</button>

      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>
        Подписка
      </h1>

      {error && (
        <div style={{ ...errorBox, color: WARN }}>
          {error}
        </div>
      )}

      {!state && !error && (
        <p style={{ color: MUTED, fontSize: 14 }}>Загрузка...</p>
      )}

      {state && (
        <>
          {/* Текущий план + usage */}
          <CurrentPlan state={state} />

          {/* Анонс — платные ещё не доступны */}
          {!state.payments_enabled && (
            <div
              style={{
                background: `${YELLOW}10`,
                border: `1px solid ${YELLOW}40`,
                borderRadius: 14,
                padding: 14,
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>💳 Оплата подписки — скоро</div>
              <div style={{ color: MUTED }}>
                Подключаем ЮKassa (1-3 дня на верификацию). Сейчас все юзеры на бесплатном плане.
                После запуска платежей лимиты увеличатся.
              </div>
            </div>
          )}

          {/* Будущие планы — превью */}
          <div style={{ marginTop: 4 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 14, color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Что будет в платных
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {state.available_tiers
                .filter((t) => t.tier !== "free")
                .map((t) => (
                  <TierPreview key={t.tier} tier={t} disabled={!state.payments_enabled} />
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CurrentPlan({ state }: { state: BillingState }) {
  const cfg = state.current_config;
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 22, fontWeight: 800 }}>{cfg.label}</span>
        <span style={{ fontSize: 13, color: MUTED }}>
          {cfg.priceRub === 0 ? "бесплатно" : `${cfg.priceRub} ₽/мес`}
        </span>
      </div>

      <UsageRow
        label="Посты"
        used={state.usage.post.used}
        limit={state.usage.post.limit}
        period={state.usage.post.period}
      />
      <UsageRow
        label="Карусели"
        used={state.usage.carousel.used}
        limit={state.usage.carousel.limit}
        period={state.usage.carousel.period}
      />
      <UsageRow
        label="Reels"
        used={state.usage.reel.used}
        limit={state.usage.reel.limit}
        period={state.usage.reel.period}
      />
    </div>
  );
}

function UsageRow({
  label,
  used,
  limit,
  period,
}: {
  label: string;
  used: number;
  limit: number;
  period: "week" | "month";
}) {
  const pct = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const close = used >= limit;
  const periodLabel = period === "week" ? "в неделю" : "в месяц";
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color: close ? WARN : MUTED }}>
          {used} / {limit} <span style={{ opacity: 0.5 }}>{periodLabel}</span>
        </span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: close ? WARN : OK,
            transition: "width 0.3s",
          }}
        />
      </div>
    </div>
  );
}

function TierPreview({ tier, disabled }: { tier: TierConfig; disabled: boolean }) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
        padding: 14,
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{tier.label}</span>
        <span style={{ fontSize: 14, color: YELLOW, fontWeight: 600 }}>
          {tier.priceRub} ₽ / мес
        </span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
        {tier.features.map((f, i) => (
          <li key={i} style={{ fontSize: 12, color: MUTED, paddingLeft: 12, position: "relative" }}>
            <span style={{ position: "absolute", left: 0, color: YELLOW }}>·</span>
            {f}
          </li>
        ))}
      </ul>
      {disabled && (
        <div
          style={{
            marginTop: 10,
            padding: "6px 10px",
            background: "rgba(255,255,255,0.04)",
            border: `1px dashed ${CARD_BORDER}`,
            borderRadius: 999,
            fontSize: 11,
            color: MUTED,
            textAlign: "center",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          скоро будет доступно
        </div>
      )}
    </div>
  );
}

const errorBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: "rgba(243,155,64,0.10)",
  border: `1px solid ${WARN}`,
  fontSize: 13,
};

function ghostBtn(): React.CSSProperties {
  return {
    background: "transparent",
    color: MUTED,
    border: "none",
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
    alignSelf: "flex-start",
  };
}
