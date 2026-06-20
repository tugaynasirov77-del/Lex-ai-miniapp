"use client";

import { useEffect, useState } from "react";
import { useFlow, useFlowActions } from "../../flow";
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
import { hapticImpact } from "../../lib/telegram";

// ─── Гамма главной ───
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
const ORANGE = "#F0944E";

type Props = { onBack: () => void };

export default function DashboardScreen({ onBack: _onBack }: Props) {
  const actions = useFlowActions();
  const { state } = useFlow();

  const [projects, setProjects] = useState<ProjectDTO[] | null>(
    () => peekProjects()?.projects.filter((p) => p.platform === "instagram") ?? null,
  );
  const [billing, setBilling] = useState<BillingSummary | null>(() => peekBilling());
  const [streak, setStreak] = useState<StreakDTO | null>(() => peekStreak());

  useEffect(() => {
    let alive = true;
    Promise.allSettled([listProjects(), getBillingSummary(), getStreak()]).then(([pr, bl, st]) => {
      if (!alive) return;
      if (pr.status === "fulfilled") setProjects(pr.value.projects.filter((p) => p.platform === "instagram"));
      if (bl.status === "fulfilled") setBilling(bl.value);
      if (st.status === "fulfilled") setStreak(st.value);
    });
    return () => { alive = false; };
  }, []);

  const activeProject =
    projects?.find((p) => p.id === state.projectId) || projects?.[0] || null;

  const goBilling = () => { hapticImpact("light"); actions.navigate("billing"); };
  const goSettings = () => { hapticImpact("light"); actions.navigate("settings"); };
  const goWizard = () => { hapticImpact("light"); actions.navigate("onboarding-wizard"); };
  const goCreate = () => {
    hapticImpact("light");
    actions.resetContent();
    actions.setIds({ projectId: null, draftId: null, reelJobId: null, weeklyPlanId: null });
    actions.setScreenMeta("onboardingPlatform", undefined);
    actions.navigate("onboarding-wizard");
  };
  const goProject = (id: string) => {
    hapticImpact("light");
    actions.setIds({ projectId: id });
    actions.navigate("project");
  };

  return (
    <ScreenWrap>
      <h1 style={{ margin: "4px 0 18px", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: INK }}>
        Профиль
      </h1>

      <TierCard billing={billing} onUpgrade={goBilling} />

      <AIProfileCard project={activeProject} onEdit={goWizard} />

      {streak && streak.current > 0 && <StreakCard streak={streak} />}

      <ProjectsSection
        projects={projects}
        activeId={activeProject?.id || null}
        onPick={goProject}
        onCreate={goCreate}
      />

      <Row label="Настройки" icon={<GearIcon />} onTap={goSettings} />

      <Footer />
    </ScreenWrap>
  );
}

// ───────── Tier ─────────

function TierCard({ billing, onUpgrade }: { billing: BillingSummary | null; onUpgrade: () => void }) {
  const isFree = !billing || billing.tier === "free";
  const tierLabel = billing?.current_config?.label ?? "Free";
  const price = billing?.current_config?.priceRub;
  const expires = billing?.subscription?.expires_at
    ? new Date(billing.subscription.expires_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
    : null;

  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 18,
      padding: 16, marginBottom: 12,
      boxShadow: `0 12px 32px rgba(0,0,0,0.3)`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: isFree ? 14 : 4 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 13,
          background: IG_GRADIENT,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 8px 20px ${PINK}40`,
        }}>
          <CrownIcon />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, color: SUB_MUTED, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Тариф
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: INK, marginTop: 2 }}>
            {tierLabel}{!isFree && price ? <span style={{ fontSize: 12, color: MUTED, fontWeight: 600, marginLeft: 6 }}>{price}₽/мес</span> : null}
          </div>
        </div>
      </div>

      {isFree ? (
        <button
          onClick={onUpgrade}
          style={{
            appearance: "none", width: "100%", padding: "12px 0", border: "none", borderRadius: 12,
            background: IG_GRADIENT, color: "#FFFFFF", fontSize: 13.5, fontWeight: 800,
            letterSpacing: "0.01em", fontFamily: "inherit", cursor: "pointer",
            boxShadow: `0 10px 24px ${PINK}40`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          Улучшить до Pro <ArrowRight />
        </button>
      ) : (
        <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>
          {expires ? `Активен до ${expires}` : "Активен"}
        </div>
      )}
    </div>
  );
}

// ───────── AI-профиль ─────────

function AIProfileCard({ project, onEdit }: { project: ProjectDTO | null; onEdit: () => void }) {
  const rows: { label: string; value: string; icon: React.ReactNode }[] = [
    { label: "Ниша", value: project?.niche || "—", icon: <BriefcaseIcon /> },
    { label: "Аудитория", value: project?.audience || "—", icon: <UsersIcon /> },
    { label: "Стиль подачи", value: project?.content_style || "—", icon: <ChatIcon /> },
    { label: "Главная цель", value: project?.content_goal || "—", icon: <TargetIcon /> },
  ];

  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 18,
      padding: 16, marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SparkleIcon size={16} color={PINK} />
          <div style={{ fontSize: 14, fontWeight: 800, color: INK }}>AI-профиль</div>
        </div>
        <button
          onClick={onEdit}
          style={{
            appearance: "none", background: SOFT, border: `1px solid ${CARD_BORDER}`,
            borderRadius: 999, padding: "5px 12px", color: PINK, fontFamily: "inherit",
            fontSize: 11.5, fontWeight: 700, cursor: "pointer",
          }}
        >
          Изменить
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 8, borderBottom: i < rows.length - 1 ? `1px solid ${CARD_BORDER}` : "none" }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: `linear-gradient(150deg, ${PURPLE}30, ${PURPLE}12)`,
              border: `1px solid ${PURPLE}3D`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#C78BEB",
            }}>
              {r.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: SUB_MUTED, fontWeight: 600, letterSpacing: "0.02em" }}>{r.label}</div>
              <div style={{ fontSize: 13, color: INK, fontWeight: 700, lineHeight: 1.25, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────── Стрик ─────────

function StreakCard({ streak }: { streak: StreakDTO }) {
  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 18,
      padding: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 13,
        background: `linear-gradient(150deg, ${ORANGE}30, ${ORANGE}12)`,
        border: `1px solid ${ORANGE}3D`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: ORANGE,
      }}>
        <FlameIcon />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: INK, lineHeight: 1.25 }}>
          {streak.current} {pluralDay(streak.current)} подряд
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 2, lineHeight: 1.3 }}>
          {streak.today ? "Сегодня уже в плюсе." : "Один пост сегодня — и серия продолжится."}
        </div>
      </div>
      {streak.longest > streak.current && (
        <div style={{
          flexShrink: 0, background: SOFT, border: `1px solid ${CARD_BORDER}`,
          borderRadius: 10, padding: "6px 10px", fontSize: 10.5, fontWeight: 700,
          textAlign: "center", color: MUTED, lineHeight: 1.2,
        }}>
          рекорд<br />{streak.longest}
        </div>
      )}
    </div>
  );
}

function pluralDay(n: number): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "дня";
  return "дней";
}

// ───────── Проекты ─────────

function ProjectsSection({
  projects, activeId, onPick, onCreate,
}: {
  projects: ProjectDTO[] | null;
  activeId: string | null;
  onPick: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10.5, color: SUB_MUTED, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 }}>
        Проекты
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {projects === null ? (
          [0, 1].map((i) => (
            <div key={i} style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, height: 56, opacity: 0.5 - i * 0.15 }} />
          ))
        ) : projects.length === 0 ? (
          <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 14, textAlign: "center", color: MUTED, fontSize: 12 }}>
            Пока нет проектов
          </div>
        ) : (
          projects.map((p) => {
            const active = p.id === activeId;
            return (
              <button
                key={p.id}
                onClick={() => onPick(p.id)}
                style={{
                  appearance: "none", textAlign: "left", display: "flex", alignItems: "center", gap: 12,
                  background: active ? `${PINK}14` : CARD_BG,
                  border: `1px solid ${active ? PINK : CARD_BORDER}`,
                  borderRadius: 14, padding: "12px 14px", color: INK, fontFamily: "inherit", cursor: "pointer",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 11,
                  background: IG_GRADIENT,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, boxShadow: `0 6px 16px ${PINK}30`,
                }}>
                  <InstagramGlyph />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.instagram_username ? `@${p.instagram_username}` : "Instagram"}
                    {typeof p.instagram_followers === "number" && p.instagram_followers > 0 && ` · ${formatCount(p.instagram_followers)}`}
                  </div>
                </div>
                {active && (
                  <div style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: PINK, letterSpacing: "0.04em" }}>АКТИВНЫЙ</div>
                )}
                <div style={{ color: SUB_MUTED, fontSize: 18 }}>›</div>
              </button>
            );
          })
        )}
        <button
          onClick={onCreate}
          style={{
            appearance: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: "transparent", border: `1px dashed ${CARD_BORDER}`, borderRadius: 14,
            padding: "12px 0", color: MUTED, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <PlusIcon /> Новый проект
        </button>
      </div>
    </div>
  );
}

// ───────── Row (универсальная строка-настройка) ─────────

function Row({ label, icon, onTap }: { label: string; icon: React.ReactNode; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      style={{
        appearance: "none", width: "100%", display: "flex", alignItems: "center", gap: 12,
        background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14,
        padding: "12px 14px", color: INK, fontFamily: "inherit", cursor: "pointer", marginBottom: 12,
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: SOFT, border: `1px solid ${CARD_BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: MUTED,
      }}>
        {icon}
      </div>
      <span style={{ flex: 1, textAlign: "left", fontSize: 13.5, fontWeight: 700 }}>{label}</span>
      <span style={{ color: SUB_MUTED, fontSize: 18 }}>›</span>
    </button>
  );
}

// ───────── Footer ─────────

function Footer() {
  const open = (url: string) => {
    hapticImpact("light");
    const tg = (typeof window !== "undefined" && (window as any).Telegram?.WebApp) || null;
    if (tg?.openTelegramLink && url.includes("t.me")) tg.openTelegramLink(url);
    else if (tg?.openLink) tg.openLink(url);
    else window.open(url, "_blank");
  };
  const base = "https://lex-ai-miniapp.vercel.app";
  const lnk: React.CSSProperties = {
    background: "transparent", border: "none", color: SUB_MUTED, fontSize: 11,
    fontFamily: "inherit", cursor: "pointer", padding: 0,
  };
  return (
    <div style={{ marginTop: 4, marginBottom: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <button onClick={() => open("https://t.me/Strateg_alex_bot")} style={{ ...lnk, color: MUTED, fontWeight: 600, fontSize: 12 }}>
        Поддержка
      </button>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={() => open(`${base}/legal/terms`)} style={lnk}>Условия</button>
        <span style={{ color: SUB_MUTED, opacity: 0.5 }}>·</span>
        <button onClick={() => open(`${base}/legal/privacy`)} style={lnk}>Конфиденциальность</button>
      </div>
    </div>
  );
}

// ───────── ScreenWrap ─────────

function ScreenWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute", inset: 0,
        background: BG, color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding:
          "max(calc(env(safe-area-inset-top) + 56px), 88px) 18px " +
          "max(calc(env(safe-area-inset-bottom) + 96px), 110px)",
        overflowY: "auto", WebkitOverflowScrolling: "touch",
      }}
    >
      {children}
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

// ───────── Иконки ─────────

type IconProps = { size?: number; color?: string };

function SparkleIcon({ size = 18, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" fill={color} />
      <path d="M18 14l.8 2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-1L18 14z" fill={color} />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 17l1.5-9 4.5 4 3-6 3 6 4.5-4L21 17H3z" fill="#FFFFFF" />
      <path d="M3 20h18" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="7" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.3" />
      <rect x="10.2" y="11.2" width="3.6" height="1.6" rx="0.4" fill="currentColor" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8.5" r="3.3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 19.5c0-3.2 2.9-5.5 6.5-5.5s6.5 2.3 6.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16.5" cy="7.5" r="2.6" stroke="currentColor" strokeWidth="1.5" opacity="0.85" />
      <path d="M16 13.5c2.6.2 4.5 1.9 5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v8a2.5 2.5 0 01-2.5 2.5H10l-4 3.5V17H6.5A2.5 2.5 0 014 14.5v-8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="9" cy="10.5" r="1" fill="currentColor" />
      <circle cx="12" cy="10.5" r="1" fill="currentColor" />
      <circle cx="15" cy="10.5" r="1" fill="currentColor" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12.5 2c.4 2.8 2.3 4.3 3.6 5.9C17.6 9.7 18.5 11.6 18.5 14a6.5 6.5 0 11-13 0c0-2.3 1.1-4 2.3-5.4.3 1.1.9 1.9 1.8 2.4C8.7 8 10 5.4 12.5 2z" fill="currentColor" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function InstagramGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="#FFFFFF" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" stroke="#FFFFFF" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="#FFFFFF" />
    </svg>
  );
}
