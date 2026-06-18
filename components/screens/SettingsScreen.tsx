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
import { hapticImpact } from "../../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.55)";
const SUB_MUTED = "rgba(255,255,255,0.38)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const DIVIDER = "rgba(255,255,255,0.06)";

type Props = { onBack: () => void };

export default function SettingsScreen({ onBack: _onBack }: Props) {
  const actions = useFlowActions();
  const [billing, setBilling] = useState<BillingSummary | null>(() => peekBilling());
  const [streak, setStreak] = useState<StreakDTO | null>(() => peekStreak());
  const [projects, setProjects] = useState<ProjectDTO[] | null>(
    () => peekProjects()?.projects ?? null,
  );

  useEffect(() => {
    (async () => {
      const [b, s, p] = await Promise.allSettled([
        getBillingSummary(),
        getStreak(),
        listProjects(),
      ]);
      if (b.status === "fulfilled") setBilling(b.value);
      if (s.status === "fulfilled") setStreak(s.value);
      if (p.status === "fulfilled") setProjects(p.value.projects);
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
  const goProjectSettings = (id: string) => {
    hapticImpact("light");
    actions.setIds({ projectId: id });
    actions.setScreenMeta("projectInitialTab", "settings");
    actions.navigate("project");
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
      <h1
        style={{
          margin: "0 0 22px",
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: "-0.025em",
          lineHeight: 1,
        }}
      >
        Настройки
      </h1>

      {/* Группа 1: Аккаунт + проекты */}
      <Group>
        {projects && projects.length > 0 && (
          <>
            {projects.map((p, idx) => (
              <Row
                key={p.id}
                icon={p.platform === "instagram" ? <IgIcon /> : <TgIcon />}
                label={p.title || "Без названия"}
                value={
                  p.platform === "instagram"
                    ? p.instagram_username
                      ? `@${p.instagram_username}`
                      : "—"
                    : p.channel_username
                      ? `@${p.channel_username}`
                      : "—"
                }
                onClick={() => goProjectSettings(p.id)}
                last={idx === projects.length - 1}
              />
            ))}
          </>
        )}
      </Group>

      {/* Группа 2: Подписка и поддержка */}
      <Group>
        <Row
          icon={<CardIcon />}
          label="Подписка"
          value={isFree ? "Free" : tierLabel}
          onClick={goBilling}
        />
        <Row
          icon={<ChatIcon />}
          label="Поддержка"
          onClick={() => {
            hapticImpact("light");
            openTg("https://t.me/Strateg_alex_bot");
          }}
          last
        />
      </Group>

      {/* Группа 4: Документы */}
      <Group>
        <Row
          icon={<ShieldIcon />}
          label="Политика конфиденциальности"
          onClick={() => {
            hapticImpact("light");
            openLink("https://lex-ai-miniapp.vercel.app/legal/privacy");
          }}
          external
        />
        <Row
          icon={<DocIcon />}
          label="Условия использования"
          onClick={() => {
            hapticImpact("light");
            openLink("https://lex-ai-miniapp.vercel.app/legal/terms");
          }}
          external
          last
        />
      </Group>

      <p
        style={{
          marginTop: 24,
          fontSize: 11,
          color: SUB_MUTED,
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        LEX AI · Янгаев С. Т. · самозанятый
        <br />
        ИНН 361605939517
      </p>
    </div>
  );
}

// =========== Premium card ===========

function PremiumCard({
  isFree,
  tierLabel,
  expiresAt,
  onTap,
}: {
  isFree: boolean;
  tierLabel: string;
  expiresAt: string | null;
  onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      style={{
        appearance: "none",
        width: "100%",
        textAlign: "left",
        background: isFree
          ? `linear-gradient(135deg, rgba(245,231,10,0.16) 0%, rgba(245,231,10,0.04) 100%)`
          : `linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)`,
        border: `1px solid ${isFree ? "rgba(245,231,10,0.40)" : CARD_BORDER}`,
        borderRadius: 22,
        padding: 18,
        marginBottom: 22,
        color: INK,
        fontFamily: "inherit",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: isFree ? YELLOW : MUTED,
          marginBottom: 8,
        }}
      >
        {isFree ? "Get premium" : tierLabel}
      </div>
      <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
        {isFree ? "Открой все возможности" : "Управление подпиской"}
      </div>
      <div style={{ marginTop: 6, fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
        {isFree
          ? "30 разборов Reels в месяц + сценарии Reels с нуля и контент-план. За 490 ₽."
          : expiresAt
            ? `Активна до ${new Date(expiresAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`
            : "Изменить тариф или посмотреть лимиты"}
      </div>
    </button>
  );
}

// =========== Grouped rows ===========

function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      {title && (
        <div
          style={{
            fontSize: 11,
            color: MUTED,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            fontWeight: 700,
            margin: "0 0 8px 4px",
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  onClick,
  readOnly,
  external,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  readOnly?: boolean;
  external?: boolean;
  last?: boolean;
}) {
  const interactive = !!onClick && !readOnly;
  return (
    <button
      onClick={onClick}
      disabled={readOnly}
      style={{
        appearance: "none",
        width: "100%",
        textAlign: "left",
        background: "transparent",
        border: "none",
        borderBottom: last ? "none" : `1px solid ${DIVIDER}`,
        color: INK,
        fontFamily: "inherit",
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: interactive ? "pointer" : "default",
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: MUTED,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500 }}>{label}</div>
      {value && (
        <div
          style={{
            fontSize: 13,
            color: MUTED,
            maxWidth: 140,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </div>
      )}
      {interactive && (
        <div style={{ color: SUB_MUTED, fontSize: 16, lineHeight: 1, marginLeft: 4 }}>
          {external ? "↗" : "›"}
        </div>
      )}
    </button>
  );
}

function SkeletonBlock({ height }: { height: number }) {
  return (
    <div
      className="shimmer"
      style={{
        height,
        marginBottom: 22,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 22,
        position: "relative",
        overflow: "hidden",
        opacity: 0.7,
      }}
    />
  );
}

// =========== Icons (24x24 stroke) ===========

function IgIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}
function TgIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M21 4L3 11l6 2 2 6 4-4 5 4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
function StreakIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 2c2 4-1 6 2 9 2 2 3 4 3 6a5 5 0 11-10 0c0-2 1-3 2-5 1 1 2 1 2 0 0-2-1-4 1-10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M7 4h10v4a5 5 0 01-10 0V4z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 5H3v2a3 3 0 003 3M19 5h2v2a3 3 0 01-3 3M9 20h6M12 14v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function CardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 5h16v11H8l-4 4V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M6 3h9l4 4v14H6V3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M15 3v4h4M8 12h8M8 16h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
