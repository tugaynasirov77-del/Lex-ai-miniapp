"use client";

import { useEffect, useState } from "react";
import { useFlowActions } from "../../flow";
import {
  getBillingSummary,
  getStreak,
  listProjects,
  type BillingSummary,
  type ProjectDTO,
  type StreakDTO,
} from "../../lib/api";
import { getTgUser, hapticImpact, hapticSelection } from "../../lib/telegram";

// --- Studio palette: deep violet base + amber energy accents ---
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const AMBER = "#F0A030"; // primary CTA (энергия + AI-сигнал)
const AMBER_DEEP = "#D87520";
const PEACH = "#F5A77E";
const PINK = "#D85590";
const VIOLET = "#7A52D0";
const CREAM = "#F5F0E8";
const YELLOW = AMBER; // обратная совместимость

type Props = { onBack: () => void };
type Filter = "all" | "telegram" | "instagram";

export default function DashboardScreen({ onBack: _onBack }: Props) {
  const actions = useFlowActions();
  const [data, setData] = useState<ProjectDTO[] | null>(null);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [streak, setStreak] = useState<StreakDTO | null>(null);
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
      <Hero
        projectCount={data?.length ?? 0}
        streakDays={streak?.current ?? 0}
        streakToday={streak?.today ?? false}
      />

      {/* Тонкая плашка тарифа (тап → /billing) */}
      {billing && <BillingPill billing={billing} onTap={goBilling} />}

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
                border: `1px solid ${filter === f ? CREAM : CARD_BORDER}`,
                background: filter === f ? CREAM : "transparent",
                color: filter === f ? "#0A0608" : INK,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: filter === f ? 700 : 500,
                padding: "9px 16px",
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
          + Подключить канал
        </button>
      )}

      <SupportLink />
      <LegalLinks />
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
        background: `linear-gradient(135deg, ${PEACH} 0%, ${PINK} 100%)`,
        borderRadius: 22,
        padding: "16px 18px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        color: "#FFFFFF",
        boxShadow: "0 16px 40px rgba(200,87,157,0.32)",
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
        background: `linear-gradient(135deg, rgba(200,162,200,0.14), rgba(107,79,187,0.06))`,
        border: `1px solid rgba(200,162,200,0.30)`,
        borderRadius: 20,
        padding: 16,
        position: "relative",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
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
        marginTop: 16,
        padding: "12px 16px",
        borderRadius: 18,
        border: `1px solid ${isFree ? "rgba(245,167,126,0.30)" : CARD_BORDER}`,
        background: isFree ? "rgba(245,167,126,0.08)" : CARD_BG,
        color: INK,
        fontFamily: "inherit",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 10,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
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
          background: isFree ? CREAM : "rgba(255,255,255,0.10)",
          color: isFree ? "#0A0608" : INK,
        }}
      >
        {tierLabel}
      </span>
      <span style={{ fontSize: 13, flex: 1, textAlign: "left", color: isFree ? INK : MUTED }}>
        {isFree ? (
          <>
            Pro со скидкой <b style={{ color: PEACH }}>−30%</b> · 690 ₽/мес
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

function Hero({
  projectCount,
  streakDays,
  streakToday,
}: {
  projectCount: number;
  streakDays: number;
  streakToday: boolean;
}) {
  const user = getTgUser();
  const name = (user?.first_name || "").trim();
  const greeting = name ? `Привет, ${name}` : "Студия";

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          fontSize: 11,
          color: MUTED,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        Lex Studio
      </div>
      <h1
        style={{
          margin: "10px 0 14px",
          fontSize: 36,
          lineHeight: 1.02,
          fontWeight: 800,
          letterSpacing: "-0.025em",
          color: "#FFFFFF",
        }}
      >
        {greeting}
      </h1>
      {/* Stats strip */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Chip icon="📁" label={`${projectCount} ${pluralProj(projectCount)}`} />
        {streakDays > 0 && (
          <Chip
            icon="🔥"
            label={`${streakDays} ${pluralDay(streakDays)} подряд`}
            highlight
          />
        )}
        {streakDays === 0 && projectCount > 0 && (
          <Chip icon="✨" label="Начни серию сегодня" muted />
        )}
        {streakToday && streakDays > 0 && (
          <Chip icon="✓" label="Сегодня в плюсе" muted />
        )}
      </div>
    </div>
  );
}

function Chip({ icon, label, highlight, muted }: { icon: string; label: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: highlight ? "#0A0608" : INK,
        background: highlight
          ? `linear-gradient(135deg, ${PEACH}, ${PINK})`
          : muted
          ? "rgba(255,255,255,0.06)"
          : "rgba(255,255,255,0.10)",
        border: highlight ? "none" : `1px solid ${CARD_BORDER}`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function pluralProj(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "проект";
  if ([2, 3, 4].includes(m10) && ![12, 13, 14].includes(m100)) return "проекта";
  return "проектов";
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
        borderRadius: 22,
        padding: 16,
        display: "flex",
        gap: 14,
        alignItems: "center",
        color: INK,
        fontFamily: "inherit",
        cursor: "pointer",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
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
        <div style={{ fontSize: 12, color: MUTED, display: "flex", gap: 8, alignItems: "center" }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: handle ? "#54E0A0" : "rgba(255,255,255,0.30)",
              flexShrink: 0,
            }}
          />
          {handle ? <span>{handle}</span> : <span>Не подключено</span>}
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
        width: 44,
        height: 44,
        borderRadius: 14,
        background: tg
          ? "linear-gradient(135deg, rgba(107,79,187,0.30), rgba(107,79,187,0.10))"
          : "linear-gradient(135deg, rgba(200,87,157,0.30), rgba(245,167,126,0.12))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: tg ? "#B4A4F0" : "#F5A8C8",
        }}
      >
        {tg ? "TG" : "IG"}
      </span>
    </div>
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
            borderRadius: 22,
            padding: 16,
            height: 76,
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
        Начать
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
        {ctaLabel === "ПОВТОРИТЬ" ? "Повторить" : ctaLabel}
      </button>
    </div>
  );
}

function ScreenWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        color: INK,
        fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
        padding:
          "max(calc(env(safe-area-inset-top) + 64px), 96px) 22px " +
          "max(calc(env(safe-area-inset-bottom) + 24px), 36px)",
        isolation: "isolate",
      }}
    >
      {/* Studio фон: глубокий фиолет + янтарный hot-spot снизу */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          background:
            "radial-gradient(circle 600px at 100% -100px, rgba(240,160,48,0.50), transparent 50%)," +
            "radial-gradient(ellipse 700px 600px at 0% 0%, rgba(216,85,144,0.70), transparent 55%)," +
            "radial-gradient(ellipse 600px 500px at 100% 60%, rgba(122,82,208,0.75), transparent 55%)," +
            "radial-gradient(ellipse 700px 500px at 30% 110%, rgba(240,160,48,0.65), transparent 50%)," +
            "linear-gradient(180deg, #1A0A30 0%, #0A0418 100%)",
          pointerEvents: "none",
        }}
      />
      {/* Тонкий шум поверх для премиум-вайба (через SVG) */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          opacity: 0.06,
          pointerEvents: "none",
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
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
  borderRadius: 18,
  background: `linear-gradient(135deg, ${AMBER} 0%, ${AMBER_DEEP} 100%)`,
  color: "#1A0A00",
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "0.01em",
  cursor: "pointer",
  boxShadow: `0 16px 36px rgba(240,160,48,0.32), 0 0 0 1px rgba(255,255,255,0.10) inset`,
};
