"use client";

import { useEffect, useState } from "react";
import { useFlow, useFlowActions } from "../../flow";
import {
  getProject,
  getProjectIg,
  getProjectDrafts,
  getProjectIgAnalysis,
  getProjectIgPlan,
  attachInstagram,
  attachChannel,
  updateProject,
  deleteProject,
  runIgAnalysis,
  runIgPlan,
  ApiError,
  type ProjectDTO,
  type IgAggregateDTO,
  type IgAggregateCompetitor,
  type IgAnalysisDTO,
  type IgPlanDTO,
  type TgDraftRow,
} from "../../lib/api";
import { hapticImpact, hapticNotify, hapticSelection } from "../../lib/telegram";

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
  const [analysis, setAnalysis] = useState<IgAnalysisDTO | null>(null);
  const [plan, setPlan] = useState<IgPlanDTO | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    setError(null);
    if (refreshTick === 0) {
      // initial load — показываем skeleton
      setProject(null);
      setIg(null);
      setTgDrafts(null);
    } else {
      setRefreshing(true);
    }
    (async () => {
      try {
        const r = await getProject(projectId);
        if (!alive) return;
        setProject(r.project);
        if (r.project.platform === "instagram") {
          const [agg, an, pl] = await Promise.all([
            getProjectIg(projectId),
            getProjectIgAnalysis(projectId).catch(() => ({ analysis: null })),
            getProjectIgPlan(projectId).catch(() => ({ plan: null })),
          ]);
          if (!alive) return;
          setIg(agg);
          setAnalysis(an.analysis);
          setPlan(pl.plan);
        } else {
          const d = await getProjectDrafts(projectId);
          if (alive) setTgDrafts(d.drafts || []);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Не удалось загрузить");
      } finally {
        if (alive) setRefreshing(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId, refreshTick]);

  const refresh = () => {
    hapticSelection();
    setRefreshTick((t) => t + 1);
  };

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

  const quickCreate = (
    format: "post" | "carousel" | "reel" | "weekly-plan",
  ) => {
    hapticImpact("light");
    actions.resetContent();
    actions.setFormat(format);
    // Reel требует upload, остальное — brief.
    actions.navigate(format === "reel" ? "upload" : "project-brief");
  };

  // Маппинг "reel-tutorial"/"carousel-checklist"/etc → ContentFormat.
  const mapIdeaFormat = (raw?: string): "post" | "carousel" | "reel" => {
    const s = (raw || "").toLowerCase();
    if (s.includes("reel") || s.includes("video")) return "reel";
    if (s.includes("carousel") || s.includes("карус")) return "carousel";
    return "post";
  };

  const pickIdea = (item: {
    topic?: string;
    format?: string;
    hook?: string;
  }) => {
    const topic = (item.topic || "").trim();
    if (!topic) {
      // Идея без темы — fallback на обычный brief.
      quickCreate("post");
      return;
    }
    const fmt = mapIdeaFormat(item.format);
    hapticImpact("medium");
    actions.resetContent();
    actions.setFormat(fmt);
    // Прокидываем topic (+ hook склеиваем в подсказку через перенос).
    const enrichedTopic = item.hook
      ? `${topic}\n\nHook: ${item.hook.trim()}`
      : topic;
    actions.setBrief({
      topic: enrichedTopic,
      tone: "confident",
      platform: isIg ? "instagram" : "telegram",
    });
    // Маркер для banner'ов в brief/upload экранах.
    actions.setScreenMeta("fromPlanIdea", {
      topic,
      hook: item.hook?.trim() || null,
      format: fmt,
    });
    actions.navigate(fmt === "reel" ? "upload" : "project-brief");
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

      <QuickHub
        isIg={isIg}
        feedEmpty={feed?.length === 0}
        hasAnalysis={!!analysis}
        hasPlan={!!plan && (plan.items?.length ?? 0) > 0}
        topPlanIdea={plan?.items?.[0] ?? null}
        onCreate={quickCreate}
        onPickIdea={pickIdea}
        onOpenTab={(t) => {
          hapticSelection();
          setTab(t);
        }}
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
            refreshing={refreshing}
            isIg={isIg}
            onRefresh={refresh}
            onNew={newContent}
            onOpen={openItem}
            onQuick={quickCreate}
          />
        )}
        {tab === "scout" && (
          <ScoutTab
            projectId={projectId}
            isIg={isIg}
            competitors={ig?.competitors ?? []}
            analysis={analysis}
            plan={plan}
            lastSnapshotAt={ig?.snapshots?.[0]?.snapshot_at ?? null}
            onRefresh={refresh}
            onQuickCarousel={() => quickCreate("carousel")}
            onQuickPlan={() => quickCreate("weekly-plan")}
            onPickIdea={pickIdea}
          />
        )}
        {tab === "settings" && (
          <SettingsTab
            project={project}
            isIg={isIg}
            handle={handle}
            attached={attached}
            onProjectUpdated={(p) => {
              setProject(p);
              setRefreshTick((t) => t + 1);
            }}
            onDeleted={() => {
              actions.resetFlow();
              actions.navigate("dashboard");
            }}
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

type QuickFormat = "post" | "carousel" | "reel" | "weekly-plan";

function ContentTab({
  feed,
  error,
  refreshing,
  isIg,
  onRefresh,
  onNew,
  onOpen,
  onQuick,
}: {
  feed: FeedItem[] | null;
  error: string | null;
  refreshing: boolean;
  isIg: boolean;
  onRefresh: () => void;
  onNew: () => void;
  onOpen: (it: FeedItem) => void;
  onQuick: (f: QuickFormat) => void;
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
        <QuickFormatRow isIg={isIg} onQuick={onQuick} />
        <button onClick={onNew} style={{ ...ghostBtn, marginTop: 4 }}>
          выбрать формат →
        </button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <QuickFormatRow isIg={isIg} onQuick={onQuick} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 2px 4px",
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: MUTED,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {feed!.length} {plural(feed!.length, "элемент", "элемента", "элементов")}
        </span>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          style={{
            appearance: "none",
            background: "transparent",
            border: "none",
            color: refreshing ? MUTED : YELLOW,
            fontSize: 12,
            fontWeight: 600,
            cursor: refreshing ? "default" : "pointer",
            padding: "4px 6px",
            fontFamily: "inherit",
          }}
        >
          {refreshing ? "обновляем…" : "↻ обновить"}
        </button>
      </div>
      {feed!.map((it) => (
        <FeedCard key={`${it.kind}-${it.id}`} item={it} onOpen={() => onOpen(it)} />
      ))}
    </div>
  );
}

function QuickHub({
  isIg,
  feedEmpty,
  hasAnalysis,
  hasPlan,
  topPlanIdea,
  onCreate,
  onPickIdea,
  onOpenTab,
}: {
  isIg: boolean;
  feedEmpty: boolean;
  hasAnalysis: boolean;
  hasPlan: boolean;
  topPlanIdea: { topic?: string; format?: string; hook?: string } | null;
  onCreate: (f: QuickFormat) => void;
  onPickIdea: (it: { topic?: string; format?: string; hook?: string }) => void;
  onOpenTab: (t: Tab) => void;
}) {
  type Action = {
    key: string;
    label: string;
    icon: string;
    onTap: () => void;
    primary?: boolean;
  };

  const actions: Action[] = [];

  // 1. Если есть свежий план — приоритетный shortcut «Собрать из плана».
  if (hasPlan && topPlanIdea?.topic) {
    actions.push({
      key: "from-plan",
      label: "Из плана",
      icon: "✨",
      onTap: () => onPickIdea(topPlanIdea),
      primary: true,
    });
  }

  if (isIg) {
    actions.push(
      { key: "carousel", label: "Карусель", icon: "🖼", onTap: () => onCreate("carousel"), primary: !hasPlan },
      { key: "reel", label: "Reel", icon: "🎬", onTap: () => onCreate("reel") },
    );
    if (!hasAnalysis) {
      actions.push({ key: "scout", label: "Конкуренты", icon: "🔍", onTap: () => onOpenTab("scout") });
    } else if (!hasPlan) {
      actions.push({ key: "plan", label: "Собрать план", icon: "🗓", onTap: () => onCreate("weekly-plan") });
    } else {
      actions.push({ key: "scout", label: "Разведка", icon: "🔍", onTap: () => onOpenTab("scout") });
    }
  } else {
    actions.push(
      { key: "post", label: "Пост", icon: "✍️", onTap: () => onCreate("post"), primary: !hasPlan },
      { key: "plan", label: "План недели", icon: "🗓", onTap: () => onCreate("weekly-plan") },
      { key: "scout", label: "Разведка", icon: "🔍", onTap: () => onOpenTab("scout") },
    );
  }

  // Когда лента пустая — делаем hub чуть заметнее.
  const emphasized = feedEmpty;

  return (
    <div
      style={{
        marginTop: 14,
        padding: emphasized ? 12 : 10,
        borderRadius: 14,
        background: emphasized ? "rgba(245,231,10,0.05)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${emphasized ? "rgba(245,231,10,0.25)" : CARD_BORDER}`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: MUTED,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {emphasized ? "С чего начать" : "Быстрые действия"}
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          padding: "0 0 2px",
        }}
      >
        {actions.map((a) => {
          const primary = a.primary;
          return (
            <button
              key={a.key}
              onClick={() => {
                hapticImpact("light");
                a.onTap();
              }}
              style={{
                appearance: "none",
                flex: "0 0 auto",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 14px",
                borderRadius: 999,
                border: primary
                  ? "none"
                  : `1px solid ${CARD_BORDER}`,
                background: primary ? YELLOW : "rgba(255,255,255,0.04)",
                color: primary ? "#0A0608" : INK,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: primary ? 800 : 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: primary
                  ? `0 8px 20px ${YELLOW}33, 0 0 0 1px rgba(255,255,255,0.12) inset`
                  : "none",
              }}
            >
              <span style={{ fontSize: 14 }}>{a.icon}</span>
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuickFormatRow({
  isIg,
  onQuick,
}: {
  isIg: boolean;
  onQuick: (f: QuickFormat) => void;
}) {
  // TG-проект → только post + plan. IG-проект → carousel + reel + plan.
  // Post оставляем во всех (универсален).
  const items: { key: QuickFormat; label: string; icon: string }[] = isIg
    ? [
        { key: "carousel", label: "Карусель", icon: "🖼" },
        { key: "reel", label: "Reel", icon: "🎬" },
        { key: "post", label: "Пост", icon: "✍️" },
        { key: "weekly-plan", label: "План", icon: "🗓" },
      ]
    : [
        { key: "post", label: "Пост", icon: "✍️" },
        { key: "weekly-plan", label: "План", icon: "🗓" },
      ];

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        padding: "2px 0 6px",
        marginBottom: 2,
      }}
    >
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onQuick(it.key)}
          style={{
            appearance: "none",
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            borderRadius: 999,
            border: `1px solid ${CARD_BORDER}`,
            background: "rgba(255,255,255,0.04)",
            color: INK,
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: 14 }}>{it.icon}</span>
          {it.label}
        </button>
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
  competitors,
  analysis,
  plan,
  lastSnapshotAt,
  onRefresh,
  onQuickCarousel,
  onQuickPlan,
  onPickIdea,
}: {
  projectId: string;
  isIg: boolean;
  competitors: IgAggregateCompetitor[];
  analysis: IgAnalysisDTO | null;
  plan: IgPlanDTO | null;
  lastSnapshotAt: string | null;
  onRefresh: () => void;
  onQuickCarousel: () => void;
  onQuickPlan: () => void;
  onPickIdea: (item: { topic?: string; format?: string; hook?: string }) => void;
}) {
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const runAnalysis = async () => {
    if (analysisBusy) return;
    setAnalysisBusy(true);
    setActionErr(null);
    hapticImpact("medium");
    try {
      await runIgAnalysis(projectId);
      hapticNotify("success");
      onRefresh();
    } catch (e) {
      hapticNotify("error");
      setActionErr(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Не получилось.",
      );
    } finally {
      setAnalysisBusy(false);
    }
  };

  const runPlan = async () => {
    if (planBusy) return;
    setPlanBusy(true);
    setActionErr(null);
    hapticImpact("medium");
    try {
      await runIgPlan(projectId);
      hapticNotify("success");
      onRefresh();
    } catch (e) {
      hapticNotify("error");
      setActionErr(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Не получилось.",
      );
    } finally {
      setPlanBusy(false);
    }
  };
  if (!isIg) {
    return (
      <Card>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
          Разведка канала
        </div>
        <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
          Конкуренты, статистика канала и стратегия — пока в полной версии.
        </p>
        <LegacyLink href={`${LEGACY_BASE}/${projectId}`} label="Открыть в полной версии →" />
      </Card>
    );
  }

  const themes = analysis?.result?.content_themes?.slice(0, 5) ?? [];
  const hooks = analysis?.result?.hook_patterns?.slice(0, 4) ?? [];
  const opportunities = analysis?.result?.opportunities?.slice(0, 3) ?? [];
  const planItems = plan?.items?.slice(0, 4) ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Конкуренты */}
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>Конкуренты</div>
          <span style={{ fontSize: 12, color: MUTED }}>
            {competitors.length}{" "}
            {plural(competitors.length, "аккаунт", "аккаунта", "аккаунтов")}
          </span>
        </div>
        {competitors.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
            Добавьте 3–5 конкурентов — Анна соберёт отчёт по нише.
          </p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {competitors.slice(0, 8).map((c) => (
              <span
                key={c.id}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "5px 10px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${CARD_BORDER}`,
                  color: INK,
                }}
              >
                @{c.username}
              </span>
            ))}
            {competitors.length > 8 && (
              <span style={{ fontSize: 12, color: MUTED, alignSelf: "center" }}>
                +{competitors.length - 8}
              </span>
            )}
          </div>
        )}
        <LegacyLink
          href={`${LEGACY_BASE}/${projectId}`}
          label={competitors.length === 0 ? "Добавить конкурентов →" : "Управлять →"}
        />
      </Card>

      {/* Анализ Анны */}
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 6,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>Анализ Анны</div>
          {analysis?.created_at && (
            <span style={{ fontSize: 11, color: MUTED }}>
              {formatDate(analysis.created_at)}
            </span>
          )}
        </div>
        {!analysis ? (
          <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
            Анализа пока нет. Запустите его в полной версии.
          </p>
        ) : (
          <>
            {analysis.result?.executive_summary && (
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.85)",
                  lineHeight: 1.5,
                }}
              >
                {analysis.result.executive_summary}
              </p>
            )}
            {themes.length > 0 && (
              <SubBlock title="Темы ниши">
                <ChipRow items={themes} />
              </SubBlock>
            )}
            {hooks.length > 0 && (
              <SubBlock title="Hook-паттерны">
                <ChipRow items={hooks} />
              </SubBlock>
            )}
            {opportunities.length > 0 && (
              <SubBlock title="Возможности">
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 16,
                    fontSize: 12,
                    color: "rgba(255,255,255,0.8)",
                    lineHeight: 1.5,
                  }}
                >
                  {opportunities.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </SubBlock>
            )}
          </>
        )}
        <button
          onClick={runAnalysis}
          disabled={analysisBusy || competitors.length === 0}
          style={{
            ...miniBtn,
            marginTop: 10,
            opacity: analysisBusy || competitors.length === 0 ? 0.5 : 1,
          }}
        >
          {analysisBusy
            ? "АННА АНАЛИЗИРУЕТ…"
            : analysis
              ? "ПЕРЕЗАПУСТИТЬ АНАЛИЗ"
              : "ЗАПУСТИТЬ АНАЛИЗ"}
        </button>
        {competitors.length === 0 && (
          <p style={{ margin: "6px 0 0", fontSize: 11, color: MUTED }}>
            Сначала добавьте конкурентов.
          </p>
        )}
        <LegacyLink
          href={`${LEGACY_BASE}/${projectId}`}
          label="Полный отчёт →"
        />
      </Card>

      {/* Недельный план */}
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 6,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>Недельный план</div>
          {plan?.week_start && (
            <span style={{ fontSize: 11, color: MUTED }}>с {plan.week_start}</span>
          )}
        </div>
        {!plan || planItems.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
            Планa пока нет. Сначала запустите анализ конкурентов.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {planItems.map((it, i) => (
              <button
                key={i}
                onClick={() => onPickIdea(it)}
                style={{
                  appearance: "none",
                  textAlign: "left",
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 10,
                  padding: "8px 10px",
                  color: "rgba(255,255,255,0.85)",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                <span
                  style={{
                    minWidth: 56,
                    fontSize: 10,
                    fontWeight: 700,
                    color: YELLOW,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {it.format || "пост"}
                </span>
                <span style={{ flex: 1 }}>{it.topic || "—"}</span>
                <span style={{ color: MUTED, fontSize: 16, fontWeight: 700 }}>›</span>
              </button>
            ))}
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 11,
                color: MUTED,
                textAlign: "center",
              }}
            >
              Тапните идею — соберём контент по ней
            </p>
            {(plan.items?.length ?? 0) > planItems.length && (
              <span style={{ fontSize: 11, color: MUTED, textAlign: "center" }}>
                +{(plan.items?.length ?? 0) - planItems.length} ещё в полном плане
              </span>
            )}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            onClick={runPlan}
            disabled={planBusy || !analysis}
            style={{
              ...miniBtn,
              flex: 1,
              opacity: planBusy || !analysis ? 0.5 : 1,
            }}
          >
            {planBusy
              ? "АЛЕКСАНДР СОБИРАЕТ…"
              : plan
                ? "ОБНОВИТЬ ПЛАН"
                : "СОБРАТЬ ПЛАН"}
          </button>
          {plan && (
            <button
              onClick={onQuickCarousel}
              style={{
                ...miniBtn,
                flex: 1,
                background: "transparent",
                border: `1px solid ${YELLOW}`,
                color: YELLOW,
              }}
            >
              → КАРУСЕЛЬ
            </button>
          )}
        </div>
        {!analysis && (
          <p style={{ margin: "6px 0 0", fontSize: 11, color: MUTED }}>
            Сначала запустите анализ конкурентов.
          </p>
        )}
        {actionErr && (
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#F39B40" }}>
            {actionErr}
          </p>
        )}
        <LegacyLink
          href={`${LEGACY_BASE}/${projectId}`}
          label="Полный план →"
        />
      </Card>

      {/* footer meta */}
      <div style={{ fontSize: 11, color: MUTED, textAlign: "center", padding: "4px 0" }}>
        {lastSnapshotAt
          ? `Последний снапшот: ${formatDate(lastSnapshotAt)}`
          : "Снапшотов пока нет"}
      </div>
    </div>
  );
}

function SubBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: MUTED,
          marginBottom: 4,
          fontWeight: 600,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function ChipRow({ items }: { items: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {items.map((t, i) => (
        <span
          key={i}
          style={{
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.85)",
          }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

// =====================================================================
// Settings tab
// =====================================================================

function SettingsTab({
  project,
  isIg,
  handle,
  attached,
  onProjectUpdated,
  onDeleted,
}: {
  project: ProjectDTO;
  isIg: boolean;
  handle: string | null;
  attached: boolean;
  onProjectUpdated: (project: ProjectDTO) => void;
  onDeleted: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Подключение */}
      {!attached ? (
        isIg ? (
          <IgAttachCard projectId={project.id} onAttached={onProjectUpdated} />
        ) : (
          <TgAttachCard projectId={project.id} onAttached={onProjectUpdated} />
        )
      ) : (
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
                color: "#5BD66B",
                marginLeft: "auto",
              }}
            >
              подключён
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
            Подключён {handle}. Можно публиковать.
          </p>
          <LegacyLink
            href={`${LEGACY_BASE}/${project.id}`}
            label="Управлять подключением →"
          />
        </Card>
      )}

      <RenameCard project={project} onUpdated={onProjectUpdated} />

      <Card>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
          Тариф и квоты
        </div>
        <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
          Free / Pro / Business — управление подпиской и лимитами.
        </p>
        <LegacyLink href="/billing" label="Открыть биллинг →" />
      </Card>

      <DeleteCard project={project} onDeleted={onDeleted} />
    </div>
  );
}

// --- TG attach (native) ---

function TgAttachCard({
  projectId,
  onAttached,
}: {
  projectId: string;
  onAttached: (project: ProjectDTO) => void;
}) {
  const [channel, setChannel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ message: string; needAdmin?: boolean } | null>(null);

  const submit = async () => {
    const c = channel.trim();
    if (!c) return;
    setBusy(true);
    setErr(null);
    hapticImpact("light");
    try {
      const r = await attachChannel(projectId, { channel: c });
      if (r && (r as any).project) {
        hapticNotify("success");
        onAttached((r as any).project as ProjectDTO);
        return;
      }
      throw new ApiError(500, "Не получили данные канала.");
    } catch (e) {
      hapticNotify("error");
      if (e instanceof ApiError) {
        // backend возвращает message при bot_not_in_channel / bot_not_admin
        const message = e.message || "Не получилось подключить.";
        setErr({
          message,
          needAdmin: /админ|administrator|bot_not_in_channel|bot_not_admin/i.test(
            message,
          ),
        });
      } else {
        setErr({ message: e instanceof Error ? e.message : "Не получилось." });
      }
      setBusy(false);
    }
  };

  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700 }}>Telegram-канал</div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#F39B40",
            marginLeft: "auto",
          }}
        >
          не подключён
        </span>
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 12, color: MUTED, lineHeight: 1.45 }}>
        Введите @username канала или ссылку t.me/.... Перед подключением
        добавьте @Lex_app_bot в канал АДМИНОМ — без этого публикация не
        заработает.
      </p>
      <input
        value={channel}
        onChange={(e) => {
          setChannel(e.target.value);
          if (err) setErr(null);
        }}
        placeholder="@my_channel"
        maxLength={80}
        style={inputStyle}
      />
      {err && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 10px",
            background: "rgba(243,155,64,0.08)",
            border: `1px solid rgba(243,155,64,0.3)`,
            borderRadius: 10,
            fontSize: 12,
            color: "#F39B40",
            lineHeight: 1.4,
          }}
        >
          {err.message}
          {err.needAdmin && (
            <div style={{ marginTop: 4, color: MUTED }}>
              Сделайте бота админом канала и нажмите «ПРОВЕРИТЬ ЕЩЁ РАЗ».
            </div>
          )}
        </div>
      )}
      <button
        onClick={submit}
        disabled={busy || !channel.trim()}
        style={{
          ...miniBtn,
          marginTop: 10,
          opacity: busy || !channel.trim() ? 0.5 : 1,
        }}
      >
        {busy ? "ПРОВЕРЯЕМ…" : err ? "ПРОВЕРИТЬ ЕЩЁ РАЗ" : "ПОДКЛЮЧИТЬ КАНАЛ"}
      </button>
      <LegacyLink
        href={`${LEGACY_BASE}/${projectId}`}
        label="Подключить вручную →"
      />
    </Card>
  );
}

// --- Rename (inline) ---

function RenameCard({
  project,
  onUpdated,
}: {
  project: ProjectDTO;
  onUpdated: (p: ProjectDTO) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSave =
    title.trim().length >= 2 &&
    title.trim().length <= 80 &&
    title.trim() !== project.title &&
    !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setErr(null);
    hapticImpact("light");
    try {
      const r = await updateProject(project.id, { title: title.trim() });
      hapticNotify("success");
      onUpdated(r.project);
      setEditing(false);
    } catch (e) {
      hapticNotify("error");
      setErr(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Не получилось.",
      );
      setBusy(false);
    }
  };

  const cancel = () => {
    setTitle(project.title);
    setErr(null);
    setEditing(false);
  };

  return (
    <Card>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
        Название проекта
      </div>
      {!editing ? (
        <>
          <div
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.85)",
              marginBottom: 6,
              wordBreak: "break-word",
            }}
          >
            {project.title}
          </div>
          <button
            onClick={() => {
              hapticSelection();
              setEditing(true);
            }}
            style={{
              ...miniBtn,
              background: "transparent",
              border: `1px solid ${CARD_BORDER}`,
              color: INK,
            }}
          >
            Переименовать
          </button>
        </>
      ) : (
        <>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (err) setErr(null);
            }}
            maxLength={80}
            style={inputStyle}
            autoFocus
          />
          {err && (
            <p style={{ fontSize: 11, color: "#F39B40", margin: "8px 0 0" }}>{err}</p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={cancel}
              disabled={busy}
              style={{
                ...miniBtn,
                background: "transparent",
                border: `1px solid ${CARD_BORDER}`,
                color: INK,
                flex: 1,
              }}
            >
              Отмена
            </button>
            <button
              onClick={save}
              disabled={!canSave}
              style={{
                ...miniBtn,
                flex: 1,
                opacity: canSave ? 1 : 0.5,
              }}
            >
              {busy ? "СОХРАНЯЕМ…" : "СОХРАНИТЬ"}
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

// --- Delete (double confirm) ---

function DeleteCard({
  project,
  onDeleted,
}: {
  project: ProjectDTO;
  onDeleted: () => void;
}) {
  const [stage, setStage] = useState<"idle" | "confirm" | "busy">("idle");
  const [confirmText, setConfirmText] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const expected = project.title.trim();
  const canDelete = stage === "confirm" && confirmText.trim() === expected;

  const triggerDelete = async () => {
    if (!canDelete) return;
    setStage("busy");
    setErr(null);
    hapticImpact("medium");
    try {
      await deleteProject(project.id);
      hapticNotify("success");
      onDeleted();
    } catch (e) {
      hapticNotify("error");
      setErr(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Не получилось удалить.",
      );
      setStage("confirm");
    }
  };

  if (stage === "idle") {
    return (
      <Card>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
          Удалить проект
        </div>
        <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
          Безвозвратно удалит весь контент проекта: черновики, планы, разведку,
          историю публикаций.
        </p>
        <button
          onClick={() => {
            hapticSelection();
            setStage("confirm");
          }}
          style={{
            ...miniBtn,
            marginTop: 10,
            background: "transparent",
            border: `1px solid #F4496A`,
            color: "#F4496A",
          }}
        >
          Удалить проект
        </button>
      </Card>
    );
  }

  return (
    <Card>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          marginBottom: 4,
          color: "#F4496A",
        }}
      >
        Подтвердите удаление
      </div>
      <p
        style={{
          margin: "0 0 8px",
          fontSize: 13,
          color: "rgba(255,255,255,0.85)",
          lineHeight: 1.5,
        }}
      >
        Это действие нельзя отменить. Чтобы подтвердить, введите название
        проекта точно как сейчас:
      </p>
      <p
        style={{
          margin: "0 0 8px",
          fontSize: 13,
          color: YELLOW,
          fontWeight: 700,
          wordBreak: "break-word",
        }}
      >
        {expected}
      </p>
      <input
        value={confirmText}
        onChange={(e) => {
          setConfirmText(e.target.value);
          if (err) setErr(null);
        }}
        placeholder="Введите название проекта"
        style={inputStyle}
        autoFocus
        disabled={stage === "busy"}
      />
      {err && (
        <p style={{ fontSize: 11, color: "#F39B40", margin: "8px 0 0" }}>{err}</p>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          onClick={() => {
            setStage("idle");
            setConfirmText("");
            setErr(null);
          }}
          disabled={stage === "busy"}
          style={{
            ...miniBtn,
            background: "transparent",
            border: `1px solid ${CARD_BORDER}`,
            color: INK,
            flex: 1,
          }}
        >
          Отмена
        </button>
        <button
          onClick={triggerDelete}
          disabled={!canDelete}
          style={{
            ...miniBtn,
            background: canDelete ? "#F4496A" : "transparent",
            border: `1px solid #F4496A`,
            color: canDelete ? "#FFFFFF" : "#F4496A",
            opacity: canDelete ? 1 : 0.5,
            flex: 1,
          }}
        >
          {stage === "busy" ? "УДАЛЯЕМ…" : "УДАЛИТЬ"}
        </button>
      </div>
    </Card>
  );
}

function IgAttachCard({
  projectId,
  onAttached,
}: {
  projectId: string;
  onAttached: (project: ProjectDTO) => void;
}) {
  const [username, setUsername] = useState("");
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    const u = username.trim().replace(/^@/, "");
    if (!u) return;
    setBusy(true);
    setErr(null);
    hapticImpact("light");
    try {
      const r = await attachInstagram(projectId, {
        username: u,
        account_id: accountId.trim() || undefined,
      });
      hapticNotify("success");
      onAttached(r.project);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Не получилось.";
      hapticNotify("error");
      setErr(msg);
      setBusy(false);
    }
  };

  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700 }}>Instagram-аккаунт</div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#F39B40",
            marginLeft: "auto",
          }}
        >
          не подключён
        </span>
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 12, color: MUTED, lineHeight: 1.45 }}>
        Без подключения нельзя публиковать карусели и Reel. Введите @username
        аккаунта. account_id — опционально (нужен для прямой публикации через
        Graph API).
      </p>
      <input
        value={username}
        onChange={(e) => {
          setUsername(e.target.value);
          if (err) setErr(null);
        }}
        placeholder="@username"
        maxLength={60}
        style={inputStyle}
      />
      <input
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
        placeholder="IG account_id (можно позже)"
        maxLength={32}
        style={{ ...inputStyle, marginTop: 8 }}
      />
      {err && (
        <p style={{ fontSize: 11, color: "#F39B40", margin: "8px 0 0" }}>{err}</p>
      )}
      <button
        onClick={submit}
        disabled={busy || !username.trim()}
        style={{
          ...miniBtn,
          marginTop: 10,
          opacity: busy || !username.trim() ? 0.5 : 1,
        }}
      >
        {busy ? "ПОДКЛЮЧАЕМ…" : "ПОДКЛЮЧИТЬ"}
      </button>
      <LegacyLink href={`${LEGACY_BASE}/${projectId}`} label="Подключить вручную →" />
    </Card>
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 12,
  color: INK,
  fontSize: 14,
  fontFamily: "inherit",
  padding: "10px 12px",
  outline: "none",
};

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "rgba(255,255,255,0.58)",
  fontSize: 13,
  cursor: "pointer",
  padding: "8px 0",
  fontFamily: "inherit",
};

const miniBtn: React.CSSProperties = {
  width: "100%",
  padding: "12px 0",
  border: "none",
  borderRadius: 999,
  background: YELLOW,
  color: "#0A0608",
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
  fontFamily: "inherit",
};

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
