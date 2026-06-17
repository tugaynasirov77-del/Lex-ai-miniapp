"use client";

import { useEffect, useState } from "react";
import { useFlowActions } from "../../flow";
import {
  getBillingSummary,
  getStreak,
  listProjects,
  peekBilling,
  peekProjects,
  peekStreak,
  type BillingSummary,
  type ProjectDTO,
  type StreakDTO,
} from "../../lib/api";
import { hapticImpact, hapticSelection } from "../../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";

type Props = { onBack: () => void };
type Filter = "all" | "telegram" | "instagram";

export default function DashboardScreen({ onBack: _onBack }: Props) {
  const actions = useFlowActions();
  // Стартовое значение из кеша → мгновенный рендер при возврате
  const [data, setData] = useState<ProjectDTO[] | null>(() => peekProjects()?.projects ?? null);
  const [billing, setBilling] = useState<BillingSummary | null>(() => peekBilling());
  const [streak, setStreak] = useState<StreakDTO | null>(() => peekStreak());
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = async () => {
    setError(null);
    try {
      const [pr, bl, st] = await Promise.allSettled([
        listProjects(),
        getBillingSummary(),
        getStreak(),
      ]);
      if (pr.status === "fulfilled") setData(pr.value.projects || []);
      else throw pr.reason;
      if (bl.status === "fulfilled") setBilling(bl.value);
      if (st.status === "fulfilled") setStreak(st.value);
      // billing — мягкая ошибка, плашка просто скрывается
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goCreate = () => {
    hapticImpact("light");
    // Чистим состояние: иначе CreateProjectScreen примет тапнутый projectId
    // существующего проекта за resume и прыгнет обратно в него.
    actions.resetContent();
    actions.setIds({
      projectId: null,
      draftId: null,
      reelJobId: null,
      weeklyPlanId: null,
    });
    actions.setScreenMeta("onboardingPlatform", undefined);
    actions.navigate("create-project");
  };

  const goProject = (id: string) => {
    hapticImpact("light");
    actions.setIds({ projectId: id });
    actions.navigate("project");
  };

  const filtered = (data || []).filter((p) =>
    filter === "all" ? true : p.platform === filter,
  );

  const goBilling = () => {
    hapticImpact("light");
    actions.navigate("billing");
  };

  return (
    <ScreenWrap>
      <Header />

      {/* Тонкая плашка тарифа (тап → /billing) */}
      {billing && <BillingPill billing={billing} onTap={goBilling} />}

      {/* Streak badge — Duolingo-механика */}
      {streak && data && data.length > 0 && streak.current > 0 && (
        <StreakBadge streak={streak} />
      )}

      {/* Update banner для существующих юзеров */}
      {data && data.length > 0 && <UpdateBanner />}

      {/* Filter tabs */}
      {data && data.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          {(["all", "telegram", "instagram"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                hapticSelection();
                setFilter(f);
              }}
              style={{
                appearance: "none",
                border: `1px solid ${filter === f ? YELLOW : CARD_BORDER}`,
                background: filter === f ? YELLOW : "transparent",
                color: filter === f ? "#0A0608" : INK,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: filter === f ? 700 : 500,
                padding: "8px 14px",
                borderRadius: 999,
                cursor: "pointer",
              }}
            >
              {f === "all" ? "Все" : f === "telegram" ? "Telegram" : "Instagram"}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div
        style={{
          marginTop: 18,
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {data === null && !error && <SkeletonList />}
        {error && (
          <ErrorBlock
            body={error}
            ctaLabel="ПОВТОРИТЬ"
            onCta={() => {
              setData(null);
              load();
            }}
          />
        )}
        {data && data.length === 0 && <EmptyState onCreate={goCreate} />}
        {data && data.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((p) => (
              <ProjectCard key={p.id} project={p} onPick={() => goProject(p.id)} />
            ))}
            {filtered.length === 0 && (
              <p style={{ color: MUTED, fontSize: 13, textAlign: "center", padding: 24 }}>
                В этом фильтре нет проектов.
              </p>
            )}
          </div>
        )}
      </div>

      {data && data.length > 0 && (
        <button onClick={goCreate} style={primaryBtn}>
          + ПОДКЛЮЧИТЬ КАНАЛ
        </button>
      )}

    </ScreenWrap>
  );
}

function LegalLinks() {
  const open = (path: string) => {
    hapticImpact("light");
    const url = `https://lex-ai-miniapp.vercel.app${path}`;
    const tg = (typeof window !== "undefined" && (window as any).Telegram?.WebApp) || null;
    if (tg?.openLink) tg.openLink(url);
    else window.open(url, "_blank");
  };
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        justifyContent: "center",
        padding: "0 0 8px",
        fontSize: 11,
        color: MUTED,
      }}
    >
      <button onClick={() => open("/legal/terms")} style={legalLinkBtn}>
        Условия
      </button>
      <span style={{ opacity: 0.4 }}>·</span>
      <button onClick={() => open("/legal/privacy")} style={legalLinkBtn}>
        Конфиденциальность
      </button>
    </div>
  );
}

const legalLinkBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "rgba(255,255,255,0.45)",
  fontSize: 11,
  fontFamily: "inherit",
  cursor: "pointer",
  padding: 0,
};

function SupportLink() {
  const open = () => {
    hapticImpact("light");
    const url = "https://t.me/Strateg_alex_bot";
    const tg = (typeof window !== "undefined" && (window as any).Telegram?.WebApp) || null;
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else if (tg?.openLink) tg.openLink(url);
    else window.open(url, "_blank");
  };
  return (
    <button
      onClick={open}
      style={{
        background: "transparent",
        border: "none",
        color: MUTED,
        fontSize: 12,
        padding: "12px 0 4px",
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "center",
      }}
    >
      · Поддержка ·
    </button>
  );
}

// --- pieces ---

const UPDATE_BANNER_KEY = "lex.updateBanner.v1.dismissed";

function StreakBadge({ streak }: { streak: StreakDTO }) {
  const { current, longest, today } = streak;
  const isRecord = longest === current && current >= 3;
  const subtitle = today
    ? isRecord
      ? "Личный рекорд 🏆 Так держать!"
      : "Сегодня уже в плюсе. Не сбавляй темп."
    : "Один пост сегодня — и серия продолжится.";
  return (
    <div
      style={{
        marginTop: 12,
        background: `linear-gradient(135deg, #FF7A00 14%, #FF3D00 100%)`,
        borderRadius: 16,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        color: "#FFFFFF",
        boxShadow: "0 8px 24px rgba(255,77,0,0.28)",
      }}
    >
      <div style={{ fontSize: 32, lineHeight: 1 }}>🔥</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em" }}>
          {current} {pluralDay(current)} подряд
        </div>
        <div style={{ fontSize: 12, opacity: 0.92, marginTop: 2, lineHeight: 1.35 }}>
          {subtitle}
        </div>
      </div>
      {longest > current && (
        <div
          style={{
            background: "rgba(255,255,255,0.18)",
            borderRadius: 10,
            padding: "6px 10px",
            fontSize: 11,
            fontWeight: 700,
            textAlign: "center",
            whiteSpace: "nowrap",
          }}
        >
          рекорд<br />{longest}
        </div>
      )}
    </div>
  );
}

function pluralDay(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "дня";
  return "дней";
}

function UpdateBanner() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(UPDATE_BANNER_KEY) === "1") setDismissed(true);
    } catch { /* noop */ }
  }, []);

  if (dismissed) return null;

  const close = () => {
    setDismissed(true);
    try { localStorage.setItem(UPDATE_BANNER_KEY, "1"); } catch { /* noop */ }
  };

  return (
    <div
      style={{
        marginTop: 12,
        background: `linear-gradient(135deg, ${YELLOW}18, ${YELLOW}08)`,
        border: `1px solid ${YELLOW}50`,
        borderRadius: 14,
        padding: 14,
        position: "relative",
      }}
    >
      <button
        onClick={close}
        aria-label="закрыть"
        style={{
          position: "absolute",
          top: 8,
          right: 10,
          background: "transparent",
          border: "none",
          color: MUTED,
          fontSize: 18,
          cursor: "pointer",
          padding: 4,
          lineHeight: 1,
        }}
      >
        ×
      </button>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6, paddingRight: 24, letterSpacing: "-0.01em" }}>
        LEX AI стал в 2 раза быстрее
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.45, color: MUTED }}>
        Один инструмент вместо команды агентов. 3 варианта поста на выбор.
        Карусели и Reels — готовые сценарии. Открой проект и жми «+ Создать контент».
      </div>
    </div>
  );
}

// Тонкая плашка тарифа: ~44px, одна строка.
// Free → жёлтый акцент с upsell. Pro/Business → ненавязчивый статус-чип.
function BillingPill({
  billing,
  onTap,
}: {
  billing: BillingSummary;
  onTap: () => void;
}) {
  const isFree = billing.tier === "free";
  const tierLabel = billing.current_config?.label ?? billing.tier.toUpperCase();
  const expires = billing.subscription?.expires_at
    ? new Date(billing.subscription.expires_at).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <button
      onClick={onTap}
      style={{
        appearance: "none",
        width: "100%",
        marginTop: 14,
        padding: "10px 14px",
        borderRadius: 12,
        border: `1px solid ${isFree ? "rgba(245,231,10,0.35)" : CARD_BORDER}`,
        background: isFree ? "rgba(245,231,10,0.08)" : CARD_BG,
        color: INK,
        fontFamily: "inherit",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding: "3px 8px",
          borderRadius: 999,
          background: isFree ? YELLOW : "rgba(255,255,255,0.08)",
          color: isFree ? "#0A0608" : INK,
        }}
      >
        {tierLabel}
      </span>
      <span style={{ fontSize: 13, flex: 1, textAlign: "left", color: isFree ? INK : MUTED }}>
        {isFree ? (
          <>
            Pro со скидкой <b style={{ color: YELLOW }}>−30%</b> · 690 ₽/мес
          </>
        ) : expires ? (
          <>Активен до {expires}</>
        ) : (
          <>Управление подпиской</>
        )}
      </span>
      <span style={{ color: MUTED, fontSize: 16, lineHeight: 1 }}>›</span>
    </button>
  );
}

function Header() {
  return (
    <div>
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
        Мои проекты
      </h1>
    </div>
  );
}

function ProjectCard({
  project,
  onPick,
}: {
  project: ProjectDTO;
  onPick: () => void;
}) {
  const isIg = project.platform === "instagram";
  const handle = isIg
    ? project.instagram_username
      ? `@${project.instagram_username}`
      : null
    : project.channel_username
      ? `@${project.channel_username}`
      : null;
  const followers = isIg ? project.instagram_followers : project.channel_subscribers;
  const isAuto = /^(Reel |План: |Карусель: |Пост: )/.test(project.title);

  return (
    <button
      onClick={onPick}
      style={{
        appearance: "none",
        textAlign: "left",
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 16,
        padding: 14,
        display: "flex",
        gap: 12,
        alignItems: "center",
        color: INK,
        fontFamily: "inherit",
        cursor: "pointer",
      }}
    >
      <PlatformIcon platform={project.platform} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            marginBottom: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {project.title}
          {isAuto && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 10,
                color: MUTED,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              авто
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: MUTED, display: "flex", gap: 8 }}>
          {handle ? <span>{handle}</span> : <span>{project.platform === "instagram" ? "Instagram" : "Telegram"}</span>}
          {typeof followers === "number" && followers > 0 && (
            <span>· {formatCount(followers)}</span>
          )}
        </div>
      </div>
      <div style={{ color: MUTED, fontSize: 18 }}>›</div>
    </button>
  );
}

function PlatformIcon({ platform }: { platform: "telegram" | "instagram" }) {
  const tg = platform === "telegram";
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        background: tg
          ? "linear-gradient(135deg, #37BBFE 0%, #1D8AC9 100%)"
          : "linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: tg
          ? "0 6px 16px rgba(40,160,235,0.32)"
          : "0 6px 16px rgba(221,42,123,0.30)",
      }}
    >
      {tg ? <TelegramGlyph /> : <InstagramGlyph />}
    </div>
  );
}

function TelegramGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21.5 3.5L2.8 10.7c-1.1.4-1.1 1.1-.2 1.4l4.8 1.5 1.9 5.9c.2.7.4.9 1 .9.5 0 .7-.2 1-.5l2.4-2.3 4.9 3.6c.9.5 1.5.2 1.7-.8L23 5.2c.3-1.3-.5-1.9-1.5-1.7z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

function InstagramGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="#FFFFFF" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" stroke="#FFFFFF" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="#FFFFFF" />
    </svg>
  );
}

function SkeletonList() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 16,
            padding: 14,
            height: 68,
            opacity: 0.5 - i * 0.1,
          }}
        />
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 14,
        padding: "20px 8px",
      }}
    >
      <div style={{ fontSize: 44 }}>🗂️</div>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>
        Подключите первый канал
      </h2>
      <p style={{ margin: 0, fontSize: 13, color: MUTED, maxWidth: 280, lineHeight: 1.45 }}>
        За 2 шага: выберите платформу — подключите канал. Дальше агенты сами
        соберут план и предложат посты.
      </p>
      <button onClick={onCreate} style={{ ...primaryBtn, marginTop: 10 }}>
        НАЧАТЬ
      </button>
    </div>
  );
}

function ErrorBlock({
  body,
  ctaLabel,
  onCta,
}: {
  body: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 14,
        padding: "40px 8px",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Не удалось загрузить</h2>
      <p style={{ margin: 0, fontSize: 13, color: MUTED, maxWidth: 280 }}>{body}</p>
      <button onClick={onCta} style={primaryBtn}>
        {ctaLabel}
      </button>
    </div>
  );
}

function ScreenWrap({ children }: { children: React.ReactNode }) {
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
          "max(calc(env(safe-area-inset-bottom) + 100px), 116px)",
      }}
    >
      {children}
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const primaryBtn: React.CSSProperties = {
  width: "100%",
  minHeight: 56,
  marginTop: 14,
  padding: "18px 0",
  border: "none",
  borderRadius: 999,
  background: `linear-gradient(135deg, #FFF382 0%, ${YELLOW} 45%, #E5C500 100%)`,
  color: "#0A0608",
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  cursor: "pointer",
  boxShadow:
    `0 18px 44px ${YELLOW}40, 0 4px 14px ${YELLOW}33, 0 0 0 1px rgba(255,255,255,0.20) inset, 0 -2px 6px rgba(0,0,0,0.20) inset`,
};
