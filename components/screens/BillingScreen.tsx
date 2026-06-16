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
const YELLOW_DEEP = "#E5C500";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.62)";
const SUB_MUTED = "rgba(255,255,255,0.42)";
const OK = "#5BD66B";
const WARN = "#F39B40";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.10)";

function initData(): string {
  if (typeof window === "undefined") return "";
  return (window as any).Telegram?.WebApp?.initData || "";
}

type Props = { onBack: () => void };

export default function BillingScreen({ onBack: _onBack }: Props) {
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
        position: "relative",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding:
          "max(calc(env(safe-area-inset-top) + 56px), 88px) 18px " +
          "max(calc(env(safe-area-inset-bottom) + 110px), 130px)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        isolation: "isolate",
      }}
    >
      {/* Ambient glow background */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          background:
            `radial-gradient(circle 500px at 50% 5%, ${YELLOW}30 0%, transparent 60%),` +
            `radial-gradient(circle 400px at 100% 60%, rgba(178,30,60,0.20) 0%, transparent 60%)`,
          pointerEvents: "none",
        }}
      />

      <Hero />

      {error && <div style={errorBox}>{error}</div>}

      {!state && !error && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <SkeletonCard h={120} />
          <SkeletonCard h={300} />
          <SkeletonCard h={300} />
        </div>
      )}

      {state && (
        <>
          <CurrentPlanCard state={state} />

          <div style={{ height: 24 }} />

          <SectionTitle>Тарифы</SectionTitle>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {state.available_tiers
              .filter((t) => t.tier !== "free")
              .map((t) => (
                <TierCard
                  key={t.tier}
                  tier={t}
                  disabled={!state.payments_enabled}
                  isCurrent={state.tier === t.tier}
                  highlight={t.tier === "pro"}
                />
              ))}
          </div>

          <TrustRow />
        </>
      )}
    </div>
  );
}

// ===== Hero =====

function Hero() {
  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          fontSize: 11,
          color: YELLOW,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        LEX AI Premium
      </div>
      <h1
        style={{
          margin: "8px 0 6px",
          fontSize: 38,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        Прокачай <span style={{ color: YELLOW }}>контент-фабрику</span>
      </h1>
      <p style={{ margin: 0, fontSize: 14, color: MUTED, lineHeight: 1.45 }}>
        До 200 постов, 100 каруселей и 100 Reels в месяц.
        Тарифы без автопродления, отмена в любой момент.
      </p>
    </div>
  );
}

// ===== Current plan =====

function CurrentPlanCard({ state }: { state: BillingState }) {
  const cfg = state.current_config;
  return (
    <div
      style={{
        background: `linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)`,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 22,
        padding: 18,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            padding: "4px 10px",
            borderRadius: 999,
            background: cfg.tier === "free" ? "rgba(255,255,255,0.08)" : YELLOW,
            color: cfg.tier === "free" ? MUTED : "#0A0608",
          }}
        >
          {cfg.label}
        </span>
        <span style={{ fontSize: 12, color: MUTED }}>
          {cfg.priceRub === 0 ? "Текущий план" : `${cfg.priceRub} ₽/мес · активна`}
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
        last
      />
    </div>
  );
}

function UsageRow({
  label,
  used,
  limit,
  period,
  last,
}: {
  label: string;
  used: number;
  limit: number;
  period: "week" | "month";
  last?: boolean;
}) {
  const pct = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const close = used >= limit;
  const periodLabel = period === "week" ? "в неделю" : "в месяц";
  return (
    <div style={{ marginBottom: last ? 0 : 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          marginBottom: 6,
          fontWeight: 500,
        }}
      >
        <span>{label}</span>
        <span style={{ color: close ? WARN : MUTED }}>
          <b style={{ color: close ? WARN : INK, fontWeight: 700 }}>{used}</b>
          <span style={{ opacity: 0.5 }}> / {limit} {periodLabel}</span>
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: close
              ? `linear-gradient(90deg, ${WARN}, #FF6B5C)`
              : `linear-gradient(90deg, ${OK} 0%, #34D8A1 100%)`,
            transition: "width 0.4s cubic-bezier(0.16,1,0.3,1)",
            boxShadow: close
              ? `0 0 16px ${WARN}50`
              : "0 0 14px rgba(91,214,107,0.40)",
          }}
        />
      </div>
    </div>
  );
}

// ===== Tier card =====

function TierCard({
  tier,
  disabled,
  isCurrent,
  highlight,
}: {
  tier: TierConfig;
  disabled: boolean;
  isCurrent: boolean;
  highlight: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const buy = async () => {
    if (disabled || loading || isCurrent) return;
    if (tier.tier !== "pro" && tier.tier !== "business") return;
    setLoading(true);
    setErr(null);
    try {
      const { createYooKassaCheckout } = await import("../../lib/api");
      const { confirmation_url } = await createYooKassaCheckout(tier.tier);
      const tg = (typeof window !== "undefined" && (window as any).Telegram?.WebApp) || null;
      if (tg?.openLink) tg.openLink(confirmation_url);
      else if (tg?.openTelegramLink) tg.openTelegramLink(confirmation_url);
      else window.open(confirmation_url, "_blank");
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  // Ежедневная цена — psychological hack
  const perDay = Math.round(tier.priceRub / 30);

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 24,
        padding: 22,
        background: highlight
          ? `linear-gradient(135deg, rgba(245,231,10,0.14) 0%, rgba(245,231,10,0.04) 60%, rgba(255,255,255,0.02) 100%)`
          : `linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)`,
        border: highlight
          ? `1.5px solid rgba(245,231,10,0.45)`
          : `1px solid ${CARD_BORDER}`,
        boxShadow: highlight
          ? `0 24px 60px rgba(245,231,10,0.20), 0 0 0 1px rgba(255,255,255,0.04) inset`
          : "0 18px 40px rgba(0,0,0,0.30)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {highlight && (
        <div
          style={{
            position: "absolute",
            top: -12,
            left: 18,
            background: `linear-gradient(135deg, ${YELLOW} 0%, ${YELLOW_DEEP} 100%)`,
            color: "#0A0608",
            padding: "5px 12px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            boxShadow: `0 8px 22px ${YELLOW}55`,
          }}
        >
          ⭐ Популярный
        </div>
      )}

      {/* Title + price */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {tier.label}
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
            {tier.tier === "pro" ? "Для активных авторов" : "Для агентств и студий"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 14 }}>
        <span
          style={{
            fontSize: 42,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            background: highlight
              ? `linear-gradient(135deg, ${YELLOW} 0%, ${YELLOW_DEEP} 100%)`
              : "linear-gradient(135deg, #FFFFFF 0%, rgba(255,255,255,0.7) 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {tier.priceRub}
        </span>
        <span style={{ fontSize: 18, fontWeight: 700, color: MUTED }}>₽</span>
        <span style={{ fontSize: 13, color: SUB_MUTED, marginLeft: 4 }}>/ мес</span>
      </div>
      <div style={{ fontSize: 11, color: SUB_MUTED, marginTop: 4 }}>
        ≈ {perDay} ₽ в день · без автопродления
      </div>

      {/* Features */}
      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        {tier.features.map((f, i) => (
          <FeatureRow key={i} text={f} highlight={highlight} />
        ))}
      </div>

      {/* CTA */}
      <div style={{ marginTop: 20 }}>
        {isCurrent ? (
          <div
            style={{
              width: "100%",
              padding: "14px 0",
              background: "rgba(91,214,107,0.10)",
              border: `1px solid ${OK}50`,
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              color: OK,
              textAlign: "center",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            ✓ Активен
          </div>
        ) : disabled ? (
          <div
            style={{
              width: "100%",
              padding: "12px 0",
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
        ) : (
          <button
            onClick={buy}
            disabled={loading}
            style={{
              width: "100%",
              padding: "16px 0",
              border: "none",
              borderRadius: 999,
              background: highlight
                ? `linear-gradient(135deg, #FFF382 0%, ${YELLOW} 50%, ${YELLOW_DEEP} 100%)`
                : "rgba(255,255,255,0.10)",
              color: highlight ? "#0A0608" : INK,
              fontSize: 15,
              fontWeight: 800,
              fontFamily: "inherit",
              cursor: loading ? "wait" : "pointer",
              letterSpacing: "0.02em",
              opacity: loading ? 0.7 : 1,
              boxShadow: highlight
                ? `0 20px 48px ${YELLOW}50, 0 4px 14px ${YELLOW}33, 0 0 0 1px rgba(255,255,255,0.2) inset`
                : "0 0 0 1px rgba(255,255,255,0.12) inset",
            }}
          >
            {loading ? "Открываю оплату…" : `Подключить за ${tier.priceRub} ₽`}
          </button>
        )}
        {!isCurrent && !disabled && (
          <div
            style={{
              marginTop: 10,
              fontSize: 10,
              color: SUB_MUTED,
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            Нажимая, соглашаешься с{" "}
            <LegalLink path="/legal/terms">условиями</LegalLink>{" "}
            и{" "}
            <LegalLink path="/legal/privacy">политикой</LegalLink>
          </div>
        )}
      </div>

      {err && (
        <div style={{ marginTop: 8, fontSize: 12, color: WARN, textAlign: "center" }}>
          {err}
        </div>
      )}
    </div>
  );
}

function FeatureRow({ text, highlight }: { text: string; highlight: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5 }}>
      <span
        style={{
          flexShrink: 0,
          width: 20,
          height: 20,
          borderRadius: 999,
          background: highlight
            ? `linear-gradient(135deg, ${YELLOW} 0%, ${YELLOW_DEEP} 100%)`
            : "rgba(255,255,255,0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
          boxShadow: highlight ? `0 4px 10px ${YELLOW}55` : "none",
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12l4 4 10-10"
            stroke={highlight ? "#0A0608" : INK}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span style={{ color: INK, lineHeight: 1.4, fontWeight: 500 }}>{text}</span>
    </div>
  );
}

function LegalLink({ path, children }: { path: string; children: React.ReactNode }) {
  const open = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = `https://lex-ai-miniapp.vercel.app${path}`;
    const tg = (typeof window !== "undefined" && (window as any).Telegram?.WebApp) || null;
    if (tg?.openLink) tg.openLink(url);
    else window.open(url, "_blank");
  };
  return (
    <a
      href={`https://lex-ai-miniapp.vercel.app${path}`}
      onClick={open}
      style={{ color: YELLOW, textDecoration: "none" }}
    >
      {children}
    </a>
  );
}

// ===== Trust row =====

function TrustRow() {
  const items = [
    { icon: "💳", text: "Картой ₽" },
    { icon: "🛡️", text: "ЮKassa" },
    { icon: "✕", text: "Без автопродления" },
    { icon: "↩", text: "Возврат 14 дн" },
  ];
  return (
    <div
      style={{
        marginTop: 22,
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        justifyContent: "center",
      }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 12px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${CARD_BORDER}`,
            fontSize: 11,
            color: MUTED,
            fontWeight: 600,
          }}
        >
          <span>{it.icon}</span>
          {it.text}
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: MUTED,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        fontWeight: 700,
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

function SkeletonCard({ h }: { h: number }) {
  return (
    <div
      className="shimmer"
      style={{
        height: h,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 22,
        position: "relative",
        overflow: "hidden",
        opacity: 0.6,
      }}
    />
  );
}

const errorBox: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "rgba(243,155,64,0.10)",
  border: `1px solid ${WARN}`,
  fontSize: 13,
  color: WARN,
  marginBottom: 16,
};
