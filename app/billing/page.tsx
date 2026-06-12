"use client";
import { useCallback, useEffect, useState } from "react";

type TierConfig = {
  tier: "free" | "pro" | "business";
  label: string;
  priceStars: number;
  priceRub: number;
  reelsPerMonth: number;
  carouselsPerMonth: number;
  plansPerWeek: number;
  analysesPerMonth: number;
  maxProjects: number;
  monthlyCapUsd: number;
  features: string[];
};

type BillingState = {
  tier: TierConfig["tier"];
  current_config: TierConfig;
  subscription: any;
  usage: null | {
    reels: number;
    carousels: number;
    plans_this_week: number;
    analyses: number;
  };
  available_tiers: TierConfig[];
};

// --- design tokens (в одну линейку с остальным Mini App) ---
const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const WARN = "#F39B40";
const OK = "#5BD66B";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";

function initData(): string {
  if (typeof window === "undefined") return "";
  return (window as any).Telegram?.WebApp?.initData || "";
}

export default function BillingPage() {
  const [state, setState] = useState<BillingState | null>(null);
  const [busy, setBusy] = useState<null | "pro" | "business">(null);
  const [error, setError] = useState<string | null>(null);

  const projectId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("project_id")
      : null;

  const load = useCallback(async () => {
    setError(null);
    try {
      const url = projectId ? `/api/billing?project_id=${projectId}` : "/api/billing";
      const r = await fetch(url, {
        headers: { "x-telegram-init-data": initData() },
        cache: "no-store",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "fail");
      setState(d);
    } catch (e: any) {
      setError(e.message);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  // Telegram BackButton → возврат назад к Mini App.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tg = (window as any).Telegram?.WebApp;
    const bb = tg?.BackButton;
    if (!bb) return;
    const onBack = () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "/";
      }
    };
    bb.onClick(onBack);
    bb.show();
    return () => {
      try {
        bb.offClick(onBack);
        bb.hide();
      } catch {
        /* noop */
      }
    };
  }, []);

  const upgrade = async (tier: "pro" | "business") => {
    setBusy(tier);
    setError(null);
    try {
      const r = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-telegram-init-data": initData(),
        },
        body: JSON.stringify({ tier }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "fail");

      const tg = (window as any).Telegram?.WebApp;
      if (!tg?.openInvoice) {
        window.open(d.invoice_url, "_blank");
        setBusy(null);
        return;
      }
      tg.openInvoice(d.invoice_url, async (status: string) => {
        if (status === "paid") {
          try {
            await fetch("/api/billing/confirm", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-telegram-init-data": initData(),
              },
              body: JSON.stringify({ payload: d.payload }),
            });
            await load();
          } catch (e: any) {
            setError("Платёж прошёл, но не удалось подтвердить: " + e.message);
          }
        } else if (status === "failed") {
          setError("Платёж не прошёл");
        }
        setBusy(null);
      });
    } catch (e: any) {
      setError(e.message);
      setBusy(null);
    }
  };

  if (!state) {
    return (
      <ScreenWrap>
        <div style={{ color: MUTED, fontSize: 13, textAlign: "center" }}>
          {error || "Загружаем…"}
        </div>
      </ScreenWrap>
    );
  }

  const cur = state.current_config;
  const usage = state.usage;
  const sub = state.subscription;

  return (
    <ScreenWrap>
      {/* Header */}
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
          Подписка
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
          Тариф
          <br />и квоты
        </h1>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
          Текущий тариф: <b style={{ color: INK }}>{cur.label}</b>
          {sub?.expires_at && (
            <>
              {" "}
              · до {new Date(sub.expires_at).toLocaleDateString("ru-RU")}
            </>
          )}
        </p>
      </div>

      {error && (
        <Card style={{ marginTop: 16, borderColor: "rgba(243,155,64,0.4)" }}>
          <p style={{ margin: 0, fontSize: 13, color: WARN }}>{error}</p>
        </Card>
      )}

      {/* Usage */}
      {usage && (
        <Card style={{ marginTop: 18 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: MUTED,
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            Использование в этом периоде
          </div>
          <UsageRow label="Reels" used={usage.reels} limit={cur.reelsPerMonth} />
          <UsageRow
            label="Карусели"
            used={usage.carousels}
            limit={cur.carouselsPerMonth}
          />
          <UsageRow
            label="Планы"
            used={usage.plans_this_week}
            limit={cur.plansPerWeek}
          />
          <UsageRow
            label="Анализы"
            used={usage.analyses}
            limit={cur.analysesPerMonth}
          />
        </Card>
      )}

      {/* Tiers */}
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: MUTED,
          fontWeight: 700,
          marginTop: 22,
          marginBottom: 10,
        }}
      >
        Тарифы
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {state.available_tiers.map((t) => (
          <TierCard
            key={t.tier}
            tier={t}
            current={t.tier === state.tier}
            canUpgrade={t.tier !== "free" && t.tier !== state.tier}
            onUpgrade={() => upgrade(t.tier as "pro" | "business")}
            busy={busy === t.tier}
            anyBusy={busy !== null}
          />
        ))}
      </div>

      <p
        style={{
          margin: "18px 4px 0",
          fontSize: 11,
          color: MUTED,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        Оплата картой ₽ через ЮKassa или Telegram Stars. Подписка на 30 дней,
        без автопродления.
      </p>
    </ScreenWrap>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function ScreenWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        background:
          "radial-gradient(140% 80% at 100% 100%, rgba(178,30,60,0.45) 0%, rgba(178,30,60,0) 55%)," +
          "radial-gradient(110% 70% at 0% 100%, rgba(96,18,80,0.32) 0%, rgba(96,18,80,0) 60%)," +
          "radial-gradient(80% 50% at 50% 0%, rgba(245,231,10,0.08) 0%, rgba(245,231,10,0) 70%)," +
          "#0A0608",
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 540,
          margin: "0 auto",
          padding:
            "max(calc(env(safe-area-inset-top) + 64px), 96px) 22px " +
            "max(calc(env(safe-area-inset-bottom) + 32px), 48px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Скидочные «зачёркнутые» цены — маркетинговый якорь.
// Скидка ≈ 30% от «полной» цены.
const ORIGINAL_PRICE: Record<string, number> = {
  pro: 990,
  business: 2900,
};

const TIER_PITCH: Record<string, { line: string; pill?: string }> = {
  free: {
    line: "Попробуйте, как работают агенты. Соберите первые посты и Reel — без оплаты.",
    pill: "ПОПРОБОВАТЬ",
  },
  pro: {
    line: "Окупается с первого поста. Полный цикл от плана до публикации.",
    pill: "ХИТ · −30%",
  },
  business: {
    line: "Для агентств и команд: ведём 10 проектов параллельно.",
    pill: "−32%",
  },
};

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 16,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function UsageRow({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const unlimited = limit >= 999;
  const pct = unlimited ? 0 : limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const over = !unlimited && used >= limit;
  const barColor = over ? WARN : YELLOW;
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          marginBottom: 6,
        }}
      >
        <span style={{ color: INK }}>{label}</span>
        <span style={{ color: over ? WARN : MUTED, fontWeight: 600 }}>
          {used}
          <span style={{ color: MUTED }}>
            {" "}
            / {unlimited ? "∞" : limit}
          </span>
        </span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 999,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: unlimited ? "100%" : `${pct}%`,
            background: unlimited ? "rgba(245,231,10,0.3)" : barColor,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

function TierCard({
  tier,
  current,
  canUpgrade,
  onUpgrade,
  busy,
  anyBusy,
}: {
  tier: TierConfig;
  current: boolean;
  canUpgrade: boolean;
  onUpgrade: () => void;
  busy: boolean;
  anyBusy: boolean;
}) {
  const isFree = tier.priceRub === 0;
  const isPro = tier.tier === "pro";
  const pitch = TIER_PITCH[tier.tier];
  const originalPrice = ORIGINAL_PRICE[tier.tier];
  const savings = originalPrice ? originalPrice - tier.priceRub : 0;

  // Free — приглушённый, дискомфортный вид. Чтобы юзер чувствовал что «мало».
  // Pro — яркий hero с glow и большим бейджем скидки. Best-deal.
  // Business — стандартный premium.
  const isHero = isPro;

  const cardBg = isFree
    ? CARD_BG
    : isHero
      ? "linear-gradient(180deg, rgba(245,231,10,0.12) 0%, rgba(245,231,10,0.04) 100%)"
      : CARD_BG;
  const cardBorder = isFree
    ? CARD_BORDER
    : isHero
      ? YELLOW
      : "rgba(245,231,10,0.25)";
  const cardBorderWidth = isHero ? 2 : 1.5;
  const cardShadow = isHero
    ? `0 24px 56px ${YELLOW}22, 0 0 0 1px rgba(255,255,255,0.04) inset`
    : "none";
  const cardOpacity = 1;

  return (
    <div
      style={{
        background: cardBg,
        border: `${cardBorderWidth}px solid ${cardBorder}`,
        borderRadius: 18,
        padding: isHero ? 20 : 18,
        position: "relative",
        boxShadow: cardShadow,
        opacity: cardOpacity,
        // Pro чуть приподнят
        transform: isHero ? "scale(1.02)" : "none",
        marginTop: isHero ? 6 : 0,
        marginBottom: isHero ? 6 : 0,
      }}
    >
      {/* Pill сверху: либо «ваш тариф», либо marketing pill */}
      {current ? (
        <span
          style={{
            position: "absolute",
            top: -10,
            left: 16,
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 800,
            color: "#0A0608",
            background: YELLOW,
            padding: "4px 10px",
            borderRadius: 999,
          }}
        >
          Ваш тариф
        </span>
      ) : pitch?.pill ? (
        <span
          style={{
            position: "absolute",
            top: -10,
            left: 16,
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 800,
            color: "#0A0608",
            background: YELLOW,
            padding: "5px 12px",
            borderRadius: 999,
            boxShadow: `0 8px 20px ${YELLOW}44`,
          }}
        >
          {pitch.pill}
        </span>
      ) : null}

      {/* Header: имя + цена */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: isHero ? 26 : 22,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: INK,
            }}
          >
            {tier.label}
          </h3>
        </div>
        <div style={{ textAlign: "right" }}>
          {isFree ? (
            <span style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}>
              0 ₽
            </span>
          ) : (
            <>
              {originalPrice && (
                <div
                  style={{
                    fontSize: 13,
                    color: MUTED,
                    textDecoration: "line-through",
                    lineHeight: 1,
                    marginBottom: 4,
                  }}
                >
                  {originalPrice} ₽
                </div>
              )}
              <div
                style={{
                  fontSize: isHero ? 30 : 24,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                  color: isHero ? YELLOW : INK,
                }}
              >
                {tier.priceRub} ₽
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: MUTED,
                  marginTop: 4,
                  lineHeight: 1.4,
                }}
              >
                / 30 дн
                <br />
                или ⭐ {tier.priceStars}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Скидка-плашка под ценой */}
      {savings > 0 && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: isHero ? "#0A0608" : YELLOW,
            background: isHero ? YELLOW : "rgba(245,231,10,0.12)",
            padding: "5px 10px",
            borderRadius: 999,
            marginBottom: 12,
            border: isHero ? "none" : `1px solid rgba(245,231,10,0.3)`,
          }}
        >
          Экономия {savings} ₽/мес
        </div>
      )}

      {/* Pitch-строчка */}
      {pitch?.line && (
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 12,
            color: MUTED,
            lineHeight: 1.5,
            fontStyle: "italic",
          }}
        >
          {pitch.line}
        </p>
      )}

      {/* Features list */}
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 7,
          marginBottom: canUpgrade || current ? 16 : 0,
        }}
      >
        {tier.features.map((f, i) => (
          <li
            key={i}
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.85)",
              lineHeight: 1.45,
              paddingLeft: 18,
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 0,
                top: 1,
                color: isHero ? YELLOW : OK,
                fontWeight: 800,
              }}
            >
              ✓
            </span>
            {f}
          </li>
        ))}
      </ul>

      {current && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: OK,
            fontWeight: 700,
          }}
        >
          ✓ Активен
        </div>
      )}

      {canUpgrade && (
        <button
          disabled={anyBusy}
          onClick={onUpgrade}
          style={{
            appearance: "none",
            width: "100%",
            border: "none",
            borderRadius: 999,
            background: YELLOW,
            color: "#0A0608",
            fontFamily: "inherit",
            fontSize: isHero ? 15 : 14,
            fontWeight: 800,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            padding: isHero ? "16px 0" : "14px 0",
            cursor: anyBusy ? "not-allowed" : "pointer",
            opacity: anyBusy && !busy ? 0.4 : 1,
            boxShadow: isHero
              ? `0 18px 36px ${YELLOW}55, 0 0 0 1px rgba(255,255,255,0.16) inset`
              : `0 12px 28px ${YELLOW}33, 0 0 0 1px rgba(255,255,255,0.12) inset`,
          }}
        >
          {busy
            ? "Открываем оплату…"
            : isHero
              ? `Забрать ${tier.label} за ${tier.priceRub} ₽`
              : `Оплатить ${tier.priceRub} ₽`}
        </button>
      )}
    </div>
  );
}
