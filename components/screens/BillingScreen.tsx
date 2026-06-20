"use client";

import { useCallback, useEffect, useState } from "react";

type LimitSpec = { count: number; period: "week" | "month" };

type TierConfig = {
  tier: "free" | "pro" | "business";
  label: string;
  priceStars: number;
  priceRub: number;
  priceRubYearly?: number;
  limits: {
    post: LimitSpec;
    carousel: LimitSpec;
    reel: LimitSpec;
    reel_decode?: LimitSpec;
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
    reel_decode?: UsageEntry;
  };
  available_tiers: TierConfig[];
  payments_enabled: boolean;
};

const YELLOW = "#E84B91";
const YELLOW_DEEP = "#A24FD6";
const IG_GRADIENT = "linear-gradient(135deg, #A24FD6 0%, #E84B91 50%, #F88A4A 100%)";
const PINK_RGBA = (a: number) => `rgba(232,75,145,${a})`;
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
            `radial-gradient(circle 500px at 50% 5%, ${PINK_RGBA(0.18)} 0%, transparent 60%),` +
            `radial-gradient(circle 400px at 100% 60%, rgba(162,79,214,0.18) 0%, transparent 60%)`,
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

          <FaqBlock />
        </>
      )}
    </div>
  );
}

function FaqBlock() {
  const items = [
    {
      q: "А если бесплатного хватает?",
      a: "3 разбора в месяц — это 1 в 10 дней. За это время твой конкурент выпустит 20+ Reels. На Pro ты разбираешь всю нишу за неделю, а не за квартал.",
    },
    {
      q: "Не уверен в результате",
      a: "Открой Free и сделай 1-2 разбора прямо сейчас. Каждый разбор содержит готовый сценарий — забери его, сними Reels, замерь результат. Если не сработало — просто не подключаешь Pro.",
    },
    {
      q: "Дорого",
      a: "490 ₽ в месяц = 16 ₽ в день, или цена 1 кофе. Один Reels который залетит на 100k охватов окупает год Pro.",
    },
    {
      q: "Как отменить подписку?",
      a: "В один тап в Настройках. Автопродления нет — деньги списываются только когда ты сам подключаешь следующий месяц или год.",
    },
    {
      q: "Подойдёт для моей ниши?",
      a: "Да. LEX работает с любой темой — фитнес, бьюти, бизнес, lifestyle, эксперты, эдьютейнмент. Анализ строится на структуре Reels, а не на содержании.",
    },
  ];
  return (
    <div style={{ marginTop: 32 }}>
      <SectionTitle>Частые вопросы</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
        {items.map((it, i) => (
          <FaqItem key={i} q={it.q} a={it.a} />
        ))}
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          appearance: "none",
          width: "100%",
          background: "transparent",
          border: "none",
          color: INK,
          fontFamily: "inherit",
          padding: "14px 16px",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        <span style={{ flex: 1 }}>{q}</span>
        <span
          style={{
            color: MUTED,
            fontSize: 14,
            transition: "transform 200ms",
            transform: open ? "rotate(90deg)" : "none",
          }}
        >
          ›
        </span>
      </button>
      {open && (
        <div
          style={{
            padding: "0 16px 14px",
            fontSize: 13,
            color: MUTED,
            lineHeight: 1.55,
          }}
        >
          {a}
        </div>
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
        AI-студия для <span style={{ color: YELLOW }}>Instagram</span>
      </h1>
      <p style={{ margin: 0, fontSize: 14, color: MUTED, lineHeight: 1.45 }}>
        Разбирай вирусные Reels, пиши сценарии и карусели, генерируй подписи —
        всё в одном инструменте.
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
            background: cfg.tier === "free" ? "rgba(255,255,255,0.08)" : IG_GRADIENT,
            color: cfg.tier === "free" ? MUTED : "#FFFFFF",
          }}
        >
          {cfg.label}
        </span>
        <span style={{ fontSize: 12, color: MUTED }}>
          {cfg.priceRub === 0 ? "Текущий план" : `${cfg.priceRub} ₽/мес · активна`}
        </span>
      </div>

      {state.usage.reel_decode && (
        <UsageRow
          label="Разборы Reels"
          used={state.usage.reel_decode.used}
          limit={state.usage.reel_decode.limit}
          period={state.usage.reel_decode.period}
        />
      )}
      <UsageRow
        label="Посты"
        used={state.usage.post.used}
        limit={state.usage.post.limit}
        period={state.usage.post.period}
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
  const isUnlimited = limit >= 9999;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const close = !isUnlimited && used >= limit;
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
          {isUnlimited ? (
            <span style={{ color: INK, fontWeight: 700 }}>Безлимит</span>
          ) : (
            <>
              <b style={{ color: close ? WARN : INK, fontWeight: 700 }}>{used}</b>
              <span style={{ opacity: 0.5 }}> / {limit} {periodLabel}</span>
            </>
          )}
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
  const hasYearly = !!tier.priceRubYearly && tier.priceRubYearly > 0;
  const [period, setPeriod] = useState<"monthly" | "yearly">(
    hasYearly && highlight ? "yearly" : "monthly",
  );

  const buy = async () => {
    if (disabled || loading || isCurrent) return;
    if (tier.tier !== "pro" && tier.tier !== "business") return;
    setLoading(true);
    setErr(null);
    try {
      const { createYooKassaCheckout } = await import("../../lib/api");
      const { confirmation_url } = await createYooKassaCheckout(tier.tier, period);
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

  const currentPriceRub =
    period === "yearly" && tier.priceRubYearly ? tier.priceRubYearly : tier.priceRub;
  const effectivePerMonth =
    period === "yearly" && tier.priceRubYearly
      ? Math.round(tier.priceRubYearly / 12)
      : tier.priceRub;
  const perDay = Math.round(effectivePerMonth / 30);
  const savingsPct =
    hasYearly && tier.priceRubYearly
      ? Math.round((1 - tier.priceRubYearly / (tier.priceRub * 12)) * 100)
      : 0;

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 24,
        padding: 22,
        background: highlight
          ? `linear-gradient(135deg, ${PINK_RGBA(0.14)} 0%, rgba(162,79,214,0.08) 60%, rgba(255,255,255,0.02) 100%)`
          : `linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)`,
        border: highlight
          ? `1.5px solid ${PINK_RGBA(0.45)}`
          : `1px solid ${CARD_BORDER}`,
        boxShadow: highlight
          ? `0 24px 60px ${PINK_RGBA(0.22)}, 0 0 0 1px rgba(255,255,255,0.04) inset`
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
            background: IG_GRADIENT,
            color: "#FFFFFF",
            padding: "5px 12px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            boxShadow: `0 8px 22px ${PINK_RGBA(0.4)}`,
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

      {hasYearly && !isCurrent && !disabled && (
        <div style={{ display: "flex", gap: 6, marginTop: 14, marginBottom: 2 }}>
          {(["monthly", "yearly"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                appearance: "none",
                flex: 1,
                padding: "8px 6px",
                borderRadius: 10,
                border: `1px solid ${period === p ? YELLOW : CARD_BORDER}`,
                background:
                  period === p ? PINK_RGBA(0.12) : "rgba(255,255,255,0.04)",
                color: period === p ? YELLOW : MUTED,
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: period === p ? 800 : 600,
                cursor: "pointer",
                position: "relative",
              }}
            >
              {p === "monthly" ? "Месяц" : `Год · −${savingsPct}%`}
            </button>
          ))}
        </div>
      )}

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
          {currentPriceRub}
        </span>
        <span style={{ fontSize: 18, fontWeight: 700, color: MUTED }}>₽</span>
        <span style={{ fontSize: 13, color: SUB_MUTED, marginLeft: 4 }}>
          {period === "yearly" ? "/ год" : "/ мес"}
        </span>
      </div>
      <div style={{ fontSize: 11, color: SUB_MUTED, marginTop: 4 }}>
        {period === "yearly"
          ? `≈ ${effectivePerMonth} ₽/мес · экономия ${savingsPct}%`
          : `≈ ${perDay} ₽ в день · без автопродления`}
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
              background: highlight ? IG_GRADIENT : "rgba(255,255,255,0.10)",
              color: "#FFFFFF",
              fontSize: 15,
              fontWeight: 800,
              fontFamily: "inherit",
              cursor: loading ? "wait" : "pointer",
              letterSpacing: "0.02em",
              opacity: loading ? 0.7 : 1,
              boxShadow: highlight
                ? `0 20px 48px ${PINK_RGBA(0.35)}, 0 4px 14px ${PINK_RGBA(0.25)}, 0 0 0 1px rgba(255,255,255,0.2) inset`
                : "0 0 0 1px rgba(255,255,255,0.12) inset",
            }}
          >
            {loading ? "Открываю оплату…" : `Подключить за ${currentPriceRub} ₽`}
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
          background: highlight ? IG_GRADIENT : "rgba(255,255,255,0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
          boxShadow: highlight ? `0 4px 10px ${PINK_RGBA(0.35)}` : "none",
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12l4 4 10-10"
            stroke={INK}
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
