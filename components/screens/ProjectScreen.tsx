"use client";

import { useEffect, useState } from "react";
import { useFlow, useFlowActions } from "../../flow";
import {
  getProject,
  getProjectIg,
  getProjectDrafts,
  type ProjectDTO,
  type IgAggregateDTO,
  type TgDraftRow,
} from "../../lib/api";
import { hapticImpact, hapticSelection } from "../../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";

type Props = { onBack: () => void };
type Tab = "content" | "scout" | "settings";

const LEGACY_BASE = "/projects";

// --- унифицированная карточка ленты ---
type FeedItem = {
  id: string;
  kind: "post" | "carousel" | "reel";
  preview: string;
  status: string;
  createdAt: string;
  permalink?: string | null;
  reelJobId?: string | null;
  publishedAt?: string | null;
};

export default function ProjectScreen({ onBack }: Props) {
  const { state } = useFlow();
  const actions = useFlowActions();
  const projectId = state.projectId;

  const [project, setProject] = useState<ProjectDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("content");

  // aggregate per platform
  const [ig, setIg] = useState<IgAggregateDTO | null>(null);
  const [tgDrafts, setTgDrafts] = useState<TgDraftRow[] | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    setError(null);
    (async () => {
      try {
        const r = await getProject(projectId);
        if (!alive) return;
        setProject(r.project);
        // подтягиваем агрегат сразу по платформе
        if (r.project.platform === "instagram") {
          const agg = await getProjectIg(projectId);
          if (alive) setIg(agg);
        } else {
          const d = await getProjectDrafts(projectId);
          if (alive) setTgDrafts(d.drafts || []);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Не удалось загрузить");
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  if (!projectId) {
    return (
      <ScreenWrap>
        <CenterMsg>
          <p style={{ color: MUTED }}>Проект не выбран.</p>
          <button onClick={() => actions.navigate("dashboard")} style={primaryBtn}>
            К ПРОЕКТАМ
          </button>
        </CenterMsg>
      </ScreenWrap>
    );
  }

  if (error && !project) {
    return (
      <ScreenWrap>
        <CenterMsg>
          <p style={{ color: MUTED, textAlign: "center" }}>{error}</p>
          <button onClick={onBack} style={primaryBtn}>
            НАЗАД
          </button>
        </CenterMsg>
      </ScreenWrap>
    );
  }

  if (!project) {
    return (
      <ScreenWrap>
        <CenterMsg>
          <p style={{ color: MUTED }}>Загружаем…</p>
        </CenterMsg>
      </ScreenWrap>
    );
  }

  const isIg = project.platform === "instagram";
  const handle = isIg
    ? project.instagram_username
      ? `@${project.instagram_username}`
      : null
    : project.channel_username
      ? `@${project.channel_username}`
      : null;
  const attached = !!handle;

  const newContent = () => {
    hapticImpact("light");
    actions.resetContent();
    actions.navigate("choose-format");
  };

  // unified feed для Content tab
  const feed: FeedItem[] | null = (() => {
    if (isIg) {
      if (!ig) return null;
      const items: FeedItem[] = [];
      for (const r of ig.reels) {
        items.push({
          id: r.id,
          kind: "reel",
          preview: r.body?.slice(0, 120) || "Reel",
          status: r.status || "pending",
          createdAt: r.created_at,
          permalink: r.ig_permalink,
          reelJobId: r.job?.id || null,
          publishedAt: r.published_at,
        });
      }
      for (const c of ig.carousels) {
        items.push({
          id: c.id,
          kind: "carousel",
          preview: c.body?.slice(0, 120) || "Карусель",
          status: c.status || "pending",
          createdAt: c.created_at,
          permalink: c.ig_permalink,
          publishedAt: c.published_at,
        });
      }
      items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return items;
    }
    if (tgDrafts === null) return null;
    return tgDrafts.map((d) => ({
      id: d.id,
      kind: "post" as const,
      preview: (d.body || "").slice(0, 120),
      status: d.status || "pending",
      createdAt: d.created_at || "",
      permalink: null,
      publishedAt: d.published_message_id ? "" : null,
    }));
  })();

  const openItem = (it: FeedItem) => {
    hapticImpact("light");
    actions.resetContent();
    if (it.kind === "reel" && it.reelJobId) {
      actions.setFormat("reel");
      actions.setIds({ reelJobId: it.reelJobId });
      actions.navigate("review");
      return;
    }
    if (it.kind === "post" || it.kind === "carousel") {
      actions.setFormat(it.kind);
      actions.setIds({ draftId: it.id });
      actions.navigate("review");
      return;
    }
    // reel без job id — открываем legacy
    if (typeof window !== "undefined") {
      window.location.href = `${LEGACY_BASE}/${projectId}`;
    }
  };

  return (
    <ScreenWrap>
      <Header
        project={project}
        handle={handle}
        followers={
          isIg
            ? ig?.snapshots?.[0]?.followers ?? project.instagram_followers ?? null
            : project.channel_subscribers ?? null
        }
      />

      <div style={{ display: "flex", gap: 4, marginTop: 16 }}>
        {(["content", "scout", "settings"] as Tab[]).map((t) => {
          const on = tab === t;
          return (
            <button
              key={t}
              onClick={() => {
                hapticSelection();
                setTab(t);
              }}
              style={{
                appearance: "none",
                flex: 1,
                padding: "10px 4px",
                borderRadius: 10,
                border: "none",
                background: on ? "rgba(245,231,10,0.10)" : "transparent",
                color: on ? YELLOW : MUTED,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: on ? 700 : 500,
                cursor: "pointer",
                borderBottom: on ? `2px solid ${YELLOW}` : `2px solid transparent`,
              }}
            >
              {t === "content" ? "Контент" : t === "scout" ? "Разведка" : "Настройки"}
            </button>
          );
        })}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          marginTop: 14,
        }}
      >
        {tab === "content" && (
          <ContentTab
            feed={feed}
            error={error}
            onNew={newContent}
            onOpen={openItem}
          />
        )}
        {tab === "scout" && (
          <ScoutTab
            projectId={projectId}
            isIg={isIg}
            competitorsCount={ig?.competitors.length ?? 0}
            lastSnapshotAt={ig?.snapshots?.[0]?.snapshot_at ?? null}
          />
        )}
        {tab === "settings" && (
          <SettingsTab
            projectId={projectId}
            isIg={isIg}
            handle={handle}
            attached={attached}
          />
        )}
      </div>

      {tab === "content" && (
        <button onClick={newContent} style={primaryBtn}>
          + НОВЫЙ КОНТЕНТ
        </button>
      )}
    </ScreenWrap>
  );
}

// =====================================================================
// Header
// =====================================================================

function Header({
  project,
  handle,
  followers,
}: {
  project: ProjectDTO;
  handle: string | null;
  followers: number | null;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <PlatformIcon platform={project.platform} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {project.title}
        </h1>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
          {project.platform === "instagram" ? "Instagram" : "Telegram"}
          {handle ? ` · ${handle}` : " · не подключено"}
          {typeof followers === "number" && followers > 0
            ? ` · ${formatCount(followers)}`
            : ""}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Content tab
// =====================================================================

function ContentTab({
  feed,
  error,
  onNew,
  onOpen,
}: {
  feed: FeedItem[] | null;
  error: string | null;
  onNew: () => void;
  onOpen: (it: FeedItem) => void;
}) {
  if (feed === null && !error) return <SkeletonList />;
  if (feed === null && error) {
    return (
      <Card>
        <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{error}</p>
      </Card>
    );
  }
  if (feed!.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 14,
          padding: "10px 8px",
        }}
      >
        <div style={{ fontSize: 44 }}>📝</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          Здесь пока пусто
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: MUTED, maxWidth: 280, lineHeight: 1.45 }}>
          Создайте первый пост, карусель, Reel или недельный план — команда
          AI соберёт черновик за 30 секунд.
        </p>
        <button onClick={onNew} style={{ ...primaryBtn, marginTop: 8 }}>
          СОЗДАТЬ
        </button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {feed!.map((it) => (
        <FeedCard key={`${it.kind}-${it.id}`} item={it} onOpen={() => onOpen(it)} />
      ))}
    </div>
  );
}

function FeedCard({ item, onOpen }: { item: FeedItem; onOpen: () => void }) {
  const kindLabel =
    item.kind === "reel" ? "Reel" : item.kind === "carousel" ? "Карусель" : "Пост";
  const status = humanStatus(item.status);
  return (
    <button
      onClick={onOpen}
      style={{
        appearance: "none",
        textAlign: "left",
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
        padding: 12,
        color: INK,
        fontFamily: "inherit",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 6,
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: YELLOW, fontWeight: 700 }}>{kindLabel}</span>
        <span style={{ color: MUTED }}>·</span>
        <StatusBadge label={status.label} tone={status.tone} />
        <span style={{ marginLeft: "auto", color: MUTED, fontSize: 11 }}>
          {formatDate(item.createdAt)}
        </span>
      </div>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.45,
          color: "rgba(255,255,255,0.85)",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {item.preview || "(без текста)"}
      </div>
    </button>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "warn" | "muted" | "live";
}) {
  const color =
    tone === "ok"
      ? "#5BD66B"
      : tone === "warn"
        ? "#F39B40"
        : tone === "live"
          ? YELLOW
          : MUTED;
  return (
    <span
      style={{
        color,
        fontWeight: 700,
        fontSize: 10,
      }}
    >
      {label}
    </span>
  );
}

// =====================================================================
// Scout tab — лёгкий перенос блоков из InstagramView
// =====================================================================

function ScoutTab({
  projectId,
  isIg,
  competitorsCount,
  lastSnapshotAt,
}: {
  projectId: string;
  isIg: boolean;
  competitorsCount: number;
  lastSnapshotAt: string | null;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {isIg ? (
        <>
          <Card>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: YELLOW }}>
                {competitorsCount}
              </span>
              <span style={{ fontSize: 13, color: MUTED }}>
                конкурент{plural(competitorsCount, "", "а", "ов")}
              </span>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: MUTED }}>
              {competitorsCount === 0
                ? "Добавьте 3–5 конкурентов, чтобы Анна собрала отчёт."
                : "Анна анализирует темы, hooks, gaps."}
            </p>
            <LegacyLink
              href={`${LEGACY_BASE}/${projectId}`}
              label={competitorsCount === 0 ? "Добавить конкурентов →" : "Открыть анализ →"}
            />
          </Card>
          <Card>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
              Недельный план
            </div>
            <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
              Александр собирает 7 идей по неделям из отчёта Анны. Открыть и
              согласовать план — в полной версии.
            </p>
            <LegacyLink href={`${LEGACY_BASE}/${projectId}`} label="Открыть план →" />
          </Card>
          <Card>
            <div style={{ fontSize: 12, color: MUTED }}>
              Последний снапшот:{" "}
              <span style={{ color: INK }}>
                {lastSnapshotAt ? formatDate(lastSnapshotAt) : "—"}
              </span>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
            Разведка канала
          </div>
          <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
            Конкуренты, статистика канала и стратегия — пока в полной версии
            экрана проекта.
          </p>
          <LegacyLink href={`${LEGACY_BASE}/${projectId}`} label="Открыть в полной версии →" />
        </Card>
      )}
    </div>
  );
}

// =====================================================================
// Settings tab
// =====================================================================

function SettingsTab({
  projectId,
  isIg,
  handle,
  attached,
}: {
  projectId: string;
  isIg: boolean;
  handle: string | null;
  attached: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Card>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 6,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {isIg ? "Instagram-аккаунт" : "Telegram-канал"}
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: attached ? "#5BD66B" : "#F39B40",
              marginLeft: "auto",
            }}
          >
            {attached ? "подключён" : "не подключён"}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
          {attached
            ? `Подключён ${handle}. Можно публиковать.`
            : isIg
              ? "Без подключения Instagram нельзя публиковать карусели и Reel."
              : "Без подключения канала нельзя публиковать посты."}
        </p>
        <LegacyLink
          href={`${LEGACY_BASE}/${projectId}`}
          label={attached ? "Управлять подключением →" : isIg ? "Подключить Instagram →" : "Подключить канал →"}
        />
      </Card>

      <Card>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
          Тариф и квоты
        </div>
        <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
          Free / Pro / Business — управление подпиской и лимитами.
        </p>
        <LegacyLink href="/billing" label="Открыть биллинг →" />
      </Card>

      <Card>
        <div style={{ fontSize: 13, color: MUTED }}>
          Управление проектом (переименование, удаление) — в полной версии.
        </div>
        <LegacyLink href={`${LEGACY_BASE}/${projectId}`} label="Открыть проект →" />
      </Card>
    </div>
  );
}

// =====================================================================
// shared pieces
// =====================================================================

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 16,
        padding: 14,
      }}
    >
      {children}
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
            borderRadius: 14,
            padding: 14,
            height: 76,
            opacity: 0.5 - i * 0.1,
          }}
        />
      ))}
    </div>
  );
}

function LegacyLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_self"
      rel="noreferrer"
      style={{
        display: "inline-block",
        marginTop: 10,
        color: YELLOW,
        fontSize: 13,
        fontWeight: 600,
        textDecoration: "none",
      }}
    >
      {label}
    </a>
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
        background: tg ? "rgba(40,160,235,0.14)" : "rgba(225,48,108,0.14)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: tg ? "#28A0EB" : "#E1306C",
        fontWeight: 800,
        fontSize: 16,
      }}
    >
      {tg ? "TG" : "IG"}
    </div>
  );
}

function CenterMsg({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        textAlign: "center",
      }}
    >
      {children}
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
          "max(calc(env(safe-area-inset-bottom) + 24px), 36px)",
      }}
    >
      {children}
    </div>
  );
}

// --- helpers ---

function humanStatus(s: string): { label: string; tone: "ok" | "warn" | "muted" | "live" } {
  switch (s) {
    case "published":
      return { label: "опубликовано", tone: "ok" };
    case "approved":
      return { label: "запланировано", tone: "ok" };
    case "ready":
    case "pending":
      return { label: "черновик", tone: "live" };
    case "rejected":
    case "failed":
      return { label: "отклонено", tone: "warn" };
    case "done":
      return { label: "готово", tone: "ok" };
    case "awaiting_approval":
      return { label: "нужны акценты", tone: "live" };
    case "rendering":
    case "claimed":
    case "generating":
      return { label: "в работе", tone: "live" };
    default:
      return { label: s || "—", tone: "muted" };
  }
}

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "только что";
    if (diffMin < 60) return `${diffMin} мин назад`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} ч назад`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD} дн назад`;
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const primaryBtn: React.CSSProperties = {
  width: "100%",
  minHeight: 56,
  padding: "18px 0",
  border: "none",
  borderRadius: 999,
  background: YELLOW,
  color: "#0A0608",
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
  boxShadow: `0 20px 48px ${YELLOW}33, 0 0 0 1px rgba(255,255,255,0.12) inset`,
};
