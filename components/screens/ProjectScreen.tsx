"use client";

import { useEffect, useState } from "react";
import { useFlow, useFlowActions } from "../../flow";
import {
  getProject,
  getProjectIg,
  getProjectDrafts,
  lexGetPlan,
  updateProject,
  deleteProject,
  lexAnalyze,
  lexWritePlan,
  addTgCompetitor,
  addIgCompetitor,
  markPublishedExternally,
  ApiError,
  type ProjectDTO,
  type IgAggregateDTO,
  type IgAggregateCompetitor,
  type IgAnalysisDTO,
  type IgPlanDTO,
  type TgDraftRow,
} from "../../lib/api";
import { hapticImpact, hapticNotify, hapticSelection } from "../../lib/telegram";
import { markAutoStart, useAutoStartAgents } from "../../hooks/useAutoStartAgents";
import BrandSetupCard from "../BrandSetupCard";
import ReelDecoderCard from "../ReelDecoderCard";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";

type Props = { onBack: () => void };
type Tab = "content" | "scout" | "settings";


// --- унифицированная карточка ленты ---
type FeedItem = {
  id: string;
  kind: "post" | "carousel" | "reel";
  preview: string;
  fullCopy?: string;          // полный текст для «Скопировать всё» (IG)
  status: string;
  createdAt: string;
  permalink?: string | null;
  reelJobId?: string | null;
  publishedAt?: string | null;
  publishedExternally?: boolean; // юзер сам отметил
  error?: string | null;
};

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

// Превращает технические коды ошибок в человеческие тексты.
function humanError(e: unknown, fallback: string): string {
  const raw =
    e instanceof ApiError
      ? e.message
      : e instanceof Error
        ? e.message
        : "";
  if (!raw) return fallback;
  // Маппинг известных кодов
  if (/no_competitors/i.test(raw)) {
    return "Сначала добавь хотя бы 1 конкурента в форме выше.";
  }
  if (/no_insights/i.test(raw)) {
    return "Сначала запусти анализ конкурентов — план собирается на его основе.";
  }
  if (/unauthorized/i.test(raw)) {
    return "Перезайди в приложение — сессия Telegram истекла.";
  }
  if (/project not found|проект не найден/i.test(raw)) {
    return "Проект не найден. Вернись на главную и открой его заново.";
  }
  // По умолчанию — обрезаем длинные технические тексты
  return raw.length > 140 ? fallback : raw;
}

export default function ProjectScreen({ onBack }: Props) {
  const { state } = useFlow();
  const actions = useFlowActions();
  const projectId = state.projectId;

  const [project, setProject] = useState<ProjectDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Поддержка инициализации таба из flow.screenMeta.projectInitialTab
  // (используется когда заходим из глобальных Настроек в "настройки проекта")
  const initialTab = (state.screenMeta?.projectInitialTab as Tab) || "content";
  const [tab, setTab] = useState<Tab>(initialTab);
  // Если зашли именно за настройками — прячем кнопку "Создать контент" и табы
  const settingsOnly = initialTab === "settings";

  // aggregate per platform
  const [ig, setIg] = useState<IgAggregateDTO | null>(null);
  const [tgDrafts, setTgDrafts] = useState<TgDraftRow[] | null>(null);
  const [analysis, setAnalysis] = useState<IgAnalysisDTO | null>(null);
  const [plan, setPlan] = useState<IgPlanDTO | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  // Auto-start агентов после onboarding (флаг ставится в AddCompetitorsScreen).
  // По завершении обоих вызовов перечитываем данные проекта.
  const [autoStartRetry, setAutoStartRetry] = useState(0);
  const autoStart = useAutoStartAgents(
    projectId,
    project?.platform ?? null,
    () => setRefreshTick((t) => t + 1),
    autoStartRetry,
  );
  const retryAutoStart = () => {
    if (!projectId) return;
    hapticImpact("light");
    markAutoStart(projectId);
    setAutoStartRetry((k) => k + 1);
  };

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
        // Единый LEX-план кешируется в projects.lex_week_plan, тащим один раз.
        const planFetch = lexGetPlan(projectId).catch(() => ({ plan: null }));
        // И для IG и для TG тянем всё через getProjectDrafts —
        // там есть lex_carousel/lex_reel/published_externally.
        const [d, pl, agg] = await Promise.all([
          getProjectDrafts(projectId),
          planFetch,
          r.project.platform === "instagram"
            ? getProjectIg(projectId).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (!alive) return;
        setTgDrafts(d.drafts || []);
        setIg(agg);
        setAnalysis(null);
        setPlan(pl.plan as any);
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
          <button
            onClick={() => {
              // Сбрасываем projectId, иначе при back опять упрёмся в тот же
              // битый проект. Уводим юзера на dashboard явно.
              actions.resetFlow();
              actions.navigate("dashboard");
            }}
            style={primaryBtn}
          >
            К ПРОЕКТАМ
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

  /**
   * «Собрать» из идеи плана — открываем LexCreateScreen с предзаполненными
   * format и topic через screenMeta. Юзер видит готовую форму, жмёт «Создать».
   */
  const assembleIdea = (item: {
    topic?: string;
    format?: string;
    hook?: string;
  }) => {
    const topic = (item.topic || "").trim();
    if (!topic || !projectId) return;
    const fmt = mapIdeaFormat(item.format);
    hapticImpact("medium");
    const enrichedTopic = item.hook ? `${topic}\n\nHook: ${item.hook.trim()}` : topic;
    actions.setFormat(fmt);
    actions.setScreenMeta("lexTopic", enrichedTopic);
    actions.setScreenMeta("lexFormat", fmt === "reel" ? "reel" : fmt === "carousel" ? "carousel" : "post");
    actions.navigate("lex-create");
  };

  // unified feed для Content/Архив tab.
  // Для IG и TG одинаково — тянем content_drafts через getProjectDrafts.
  const feed: FeedItem[] | null = (() => {
    if (tgDrafts === null) return null;
    return tgDrafts.map((d: any) => {
      const kind: FeedItem["kind"] =
        d.content_type === "carousel"
          ? "carousel"
          : d.content_type === "reel"
            ? "reel"
            : "post";
      // Полный текст для «Скопировать всё» (только для IG-форматов)
      let fullCopy: string | undefined;
      if (kind === "carousel" && d.lex_carousel) {
        const c = d.lex_carousel;
        const slides = (c.slides || [])
          .map((s: any) => `Слайд ${s.num}: ${s.text}`)
          .join("\n\n");
        fullCopy = [
          `🎯 ${c.topic || ""}`,
          c.hook ? `Hook: ${c.hook}` : "",
          "",
          "СЛАЙДЫ:",
          slides,
          "",
          "CAPTION:",
          c.caption || "",
          "",
          (c.hashtags || []).join(" "),
        ]
          .filter(Boolean)
          .join("\n");
      } else if (kind === "reel" && d.lex_reel) {
        const r = d.lex_reel;
        const scenes = (r.scenes || [])
          .map(
            (s: any) =>
              `[${s.seconds}] ${s.action}${s.on_screen ? `\n   в кадре: ${s.on_screen}` : ""}`
          )
          .join("\n\n");
        fullCopy = [
          `🎬 ${r.topic || ""}`,
          `HOOK: ${r.hook || ""}`,
          "",
          "РАСКАДРОВКА:",
          scenes,
          "",
          `Музыка: ${r.music_hint || ""}`,
          "",
          `Caption: ${r.caption || ""}`,
          (r.hashtags || []).join(" "),
        ].join("\n");
      } else if (kind === "post") {
        fullCopy = d.body || "";
      }
      return {
        id: d.id,
        kind,
        preview:
          stripHtml(d.chosen_title || d.body || "").slice(0, 120) ||
          (kind === "carousel" ? "Карусель" : kind === "reel" ? "Reels" : "Пост"),
        fullCopy,
        status: d.status || "pending",
        createdAt: d.created_at || "",
        permalink: d.ig_permalink || null,
        publishedAt: d.published_message_id || d.published_at ? "" : null,
        publishedExternally: !!d.published_externally,
        error: d.error || null,
      };
    });
  })();
  // Подавляем неиспользуемые после рефакторинга переменные.
  void ig;

  const openItem = (it: FeedItem) => {
    hapticImpact("light");
    actions.resetContent();

    // 1. FAILED / REJECTED — честный retry-путь.
    // Reel → upload (новое видео). Post/carousel → сразу в brief с retry
    // banner, не заставляем юзера выбирать формат заново.
    if (it.status === "failed" || it.status === "rejected") {
      actions.setFormat(it.kind === "reel" ? "reel" : it.kind);
      actions.setScreenMeta("retryContext", {
        kind: it.kind,
        preview: it.preview || null,
        error: it.error || null,
      });
      actions.navigate(it.kind === "reel" ? "upload" : "project-brief");
      return;
    }

    // 2. AWAITING_APPROVAL reel — сразу в reel-approve, минуя review.
    if (it.kind === "reel" && it.status === "awaiting_approval" && it.reelJobId) {
      actions.setFormat("reel");
      actions.setIds({ reelJobId: it.reelJobId });
      actions.navigate("lex-create");
      return;
    }

    // 3. Всё остальное — review (для published/approved/done — read-only
    //    режим определяется внутри ReviewScreen по статусу).
    if (it.kind === "reel" && it.reelJobId) {
      actions.setFormat("reel");
      actions.setIds({ reelJobId: it.reelJobId });
      actions.navigate("lex-create");
      return;
    }
    if (it.kind === "post" || it.kind === "carousel") {
      actions.setFormat(it.kind);
      actions.setIds({ draftId: it.id });
      actions.navigate("lex-create");
      return;
    }
    // reel без job id — невалидное состояние, тихо игнорируем
    // (никакого редиректа в legacy: единый flow остаётся в Mini App).
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

      <FirstTimeTip />

      {/* AutoStartBanner удалён — больше не показываем "Агенты работают" */}

      {/* Главная кнопка + табы скрыты в режиме settingsOnly */}
      {!settingsOnly && (
        <button
          onClick={() => {
            hapticImpact("medium");
            actions.navigate("lex-create");
          }}
          style={{
            marginTop: 14,
            width: "100%",
            minHeight: 56,
            border: "none",
            borderRadius: 999,
            background: `linear-gradient(135deg, #FFF382 0%, ${YELLOW} 45%, #E5C500 100%)`,
            color: "#0A0608",
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            cursor: "pointer",
            boxShadow:
              `0 18px 44px ${YELLOW}40, 0 4px 14px ${YELLOW}33, 0 0 0 1px rgba(255,255,255,0.20) inset, 0 -2px 6px rgba(0,0,0,0.20) inset`,
          }}
        >
          + Создать контент
        </button>
      )}

      {/* Reel Decoder — флагман для IG-проектов */}
      {!settingsOnly && isIg && (
        <div style={{ marginTop: 14 }}>
          <ReelDecoderCard projectId={projectId} />
        </div>
      )}

      {!settingsOnly && (
      <div
        style={{
          display: "flex",
          gap: 4,
          marginTop: 18,
          padding: 4,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid rgba(255,255,255,0.08)`,
          borderRadius: 999,
        }}
      >
        {(["content", "scout"] as Tab[]).map((t) => {
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
                padding: "10px 16px",
                borderRadius: 999,
                border: "none",
                background: on
                  ? `linear-gradient(135deg, #FFF382 0%, ${YELLOW} 50%, #E5C500 100%)`
                  : "transparent",
                color: on ? "#0A0608" : MUTED,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: on ? 800 : 600,
                letterSpacing: on ? "0.02em" : "0.01em",
                cursor: "pointer",
                boxShadow: on
                  ? `0 6px 18px ${YELLOW}40, 0 0 0 1px rgba(255,255,255,0.15) inset`
                  : "none",
                transition: "background 200ms, color 200ms, box-shadow 200ms",
              }}
            >
              {t === "content"
                ? isIg
                  ? "Архив"
                  : "Контент"
                : isIg
                  ? "Идеи"
                  : "Разведка"}
            </button>
          );
        })}
      </div>
      )}

      {!settingsOnly && <TabHint tab={tab} isIg={isIg} />}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          marginTop: 6,
          // Запас под safe-area-bottom и iOS-клавиатуру, чтобы последняя
          // карточка (DeleteCard в Settings) реально доскролливалась.
          paddingBottom:
            "max(calc(env(safe-area-inset-bottom) + 110px), 130px)",
        }}
      >
        {tab === "content" && (
          <ContentTab
            feed={feed}
            error={error}
            refreshing={refreshing}
            isIg={isIg}
            plan={plan}
            onRefresh={refresh}
            onOpen={openItem}
            onAssemble={assembleIdea}
            onAdjust={pickIdea}
            onCopy={(it) => {
              if (!it.fullCopy) return;
              navigator.clipboard?.writeText(it.fullCopy).then(
                () => hapticNotify("success"),
                () => hapticNotify("error"),
              );
            }}
            onTogglePublished={async (it) => {
              hapticImpact("light");
              try {
                await markPublishedExternally(it.id, !it.publishedExternally);
                refresh();
              } catch {
                hapticNotify("error");
              }
            }}
          />
        )}
        {tab === "scout" && isIg && (
          <IgIdeasTab
            insights={(project as any)?.lex_insights ?? null}
            onPickHook={(hook) =>
              assembleIdea({ topic: hook, format: "post", hook })
            }
            onPickCarousel={(title, structure) =>
              assembleIdea({
                topic: `${title}\n\nСтруктура: ${structure}`,
                format: "carousel",
              })
            }
            onPickReel={(format, example) =>
              assembleIdea({
                topic: `${format}\n\n${example}`,
                format: "reel",
              })
            }
            onGoSettings={() => setTab("settings")}
          />
        )}
        {tab === "scout" && !isIg && (
          <ScoutTab
            projectId={projectId}
            isIg={isIg}
            competitors={ig?.competitors ?? []}
            analysis={analysis}
            lexInsights={(project as any)?.lex_insights ?? null}
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
            onContinueSetup={() => {
              actions.navigate("create-project");
            }}
            onOpenBilling={() => actions.navigate("billing")}
            onProjectUpdated={(p) => {
              setProject(p);
              setRefreshTick((t) => t + 1);
            }}
            onBrandSaved={() => {
              // После сохранения Brand Setup → перетянуть project с
              // обновлёнными lex_insights + auto-переключиться на «Идеи».
              setTimeout(() => {
                setRefreshTick((t) => t + 1);
                setTab("scout");
                hapticNotify("success");
              }, 1500);
            }}
            onDeleted={() => {
              actions.resetFlow();
              actions.navigate("dashboard");
            }}
          />
        )}
      </div>

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
  plan,
  onRefresh,
  onOpen,
  onAssemble,
  onAdjust,
  onCopy,
  onTogglePublished,
}: {
  feed: FeedItem[] | null;
  error: string | null;
  refreshing: boolean;
  isIg: boolean;
  plan: IgPlanDTO | null;
  onRefresh: () => void;
  onOpen: (it: FeedItem) => void;
  onAssemble: (item: { topic?: string; format?: string; hook?: string }) => void;
  onAdjust: (item: { topic?: string; format?: string; hook?: string }) => void;
  onCopy?: (it: FeedItem) => void;
  onTogglePublished?: (it: FeedItem) => void;
}) {
  const planItems = plan?.items ?? [];
  const hasPlan = planItems.length > 0;

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
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {hasPlan ? (
          <PlanIdeas
            items={planItems}
            onAssemble={onAssemble}
            onAdjust={onAdjust}
          />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: 12,
              padding: "16px 8px",
            }}
          >
            <div style={{ fontSize: 36 }}>🗓</div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              План готовится
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: MUTED,
                maxWidth: 280,
                lineHeight: 1.45,
              }}
            >
              LEX AI собирает идеи на неделю. Как только готово — здесь
              появятся карточки с темами, нужно будет только одобрить.
            </p>
          </div>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {hasPlan && (
        <PlanIdeas
          items={planItems}
          onAssemble={onAssemble}
          onAdjust={onAdjust}
        />
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 2px 4px",
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
          Готовое · {feed!.length}{" "}
          {plural(feed!.length, "элемент", "элемента", "элементов")}
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
        <FeedCard
          key={`${it.kind}-${it.id}`}
          item={it}
          isIg={isIg}
          onOpen={() => onOpen(it)}
          onCopy={onCopy}
          onTogglePublished={onTogglePublished}
        />
      ))}
    </div>
  );
}

// --- План: карточки идей с «Собрать» / «Корректировать» ---
function PlanIdeas({
  items,
  onAssemble,
  onAdjust,
}: {
  items: Array<{
    topic?: string;
    format?: string;
    hook?: string;
    cta?: string;
    priority?: string;
  }>;
  onAssemble: (item: { topic?: string; format?: string; hook?: string }) => void;
  onAdjust: (item: { topic?: string; format?: string; hook?: string }) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 2px",
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: YELLOW,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 800,
          }}
        >
          План недели
        </span>
        <span style={{ fontSize: 11, color: MUTED }}>
          · {items.length} идей · только одобрить
        </span>
      </div>
      {items.map((it, idx) => (
        <PlanIdeaCard
          key={idx}
          item={it}
          onAssemble={() => onAssemble(it)}
          onAdjust={() => onAdjust(it)}
        />
      ))}
    </div>
  );
}

function PlanIdeaCard({
  item,
  onAssemble,
  onAdjust,
}: {
  item: { topic?: string; format?: string; hook?: string };
  onAssemble: () => void;
  onAdjust: () => void;
}) {
  const fmt = (item.format || "post").toLowerCase();
  const fmtLabel = /reel|video/.test(fmt)
    ? "Reel"
    : /carousel|карус/.test(fmt)
      ? "Карусель"
      : "Пост";
  const fmtColor = /reel|video/.test(fmt)
    ? "#E1306C"
    : /carousel|карус/.test(fmt)
      ? "#28A0EB"
      : YELLOW;

  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: fmtColor,
            padding: "3px 8px",
            borderRadius: 999,
            border: `1px solid ${fmtColor}66`,
            background: `${fmtColor}14`,
          }}
        >
          {fmtLabel}
        </span>
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          lineHeight: 1.35,
          marginBottom: item.hook ? 4 : 10,
        }}
      >
        {item.topic || "Без темы"}
      </div>
      {item.hook && (
        <div
          style={{
            fontSize: 12,
            color: MUTED,
            lineHeight: 1.4,
            marginBottom: 10,
          }}
        >
          Hook: {item.hook}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => {
            hapticImpact("light");
            onAssemble();
          }}
          style={{
            appearance: "none",
            flex: 1,
            padding: "10px 12px",
            border: "none",
            borderRadius: 999,
            background: YELLOW,
            color: "#0A0608",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            cursor: "pointer",
            boxShadow: `0 8px 20px ${YELLOW}33, 0 0 0 1px rgba(255,255,255,0.12) inset`,
          }}
        >
          Собрать
        </button>
        <button
          onClick={() => {
            hapticSelection();
            onAdjust();
          }}
          style={{
            appearance: "none",
            padding: "10px 14px",
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 999,
            background: "transparent",
            color: INK,
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Корректировать
        </button>
      </div>
    </div>
  );
}

const TIP_KEY = "lex.tip.project.v1";

function FirstTimeTip() {
  const [hidden, setHidden] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setHidden(localStorage.getItem(TIP_KEY) === "1");
    } catch {
      setHidden(true);
    }
  }, []);

  if (hidden !== false) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(TIP_KEY, "1");
    } catch {
      /* noop */
    }
    setHidden(true);
  };

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 14,
        background: "rgba(40,160,235,0.06)",
        border: "1px solid rgba(40,160,235,0.25)",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <div style={{ fontSize: 18 }}>💡</div>
      <div style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
        Это рабочее пространство проекта. Сверху — быстрые действия для старта.
        В <b style={{ color: INK }}>Контенте</b> — история ваших постов и Reels.
        В <b style={{ color: INK }}>Разведке</b> — конкуренты, анализ и план.
        В <b style={{ color: INK }}>Настройках</b> — подключения и управление.
      </div>
      <button
        onClick={dismiss}
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          color: MUTED,
          fontSize: 18,
          cursor: "pointer",
          lineHeight: 1,
          padding: 0,
          fontFamily: "inherit",
        }}
        aria-label="Понятно"
      >
        ×
      </button>
    </div>
  );
}

function TabHint({ tab, isIg }: { tab: Tab; isIg?: boolean }) {
  const text =
    tab === "content"
      ? isIg
        ? "Весь созданный контент. Отмечай что опубликовал в IG."
        : "История ваших постов, Reels и каруселей."
      : tab === "scout"
        ? isIg
          ? "Готовые идеи для постов, каруселей и Reels на основе твоей ниши."
          : "Конкуренты, анализ ниши и недельный план."
        : "Подключения, тариф и управление проектом.";
  return (
    <div
      style={{
        fontSize: 11,
        color: MUTED,
        textAlign: "center",
        margin: "8px 0 2px",
        letterSpacing: "0.01em",
      }}
    >
      {text}
    </div>
  );
}

// --- Auto-start agents progress banner (видим в обоих табах: Контент/Разведка) ---

function AutoStartBanner({
  analysisRunning,
  planRunning,
  analysisDone,
  planDone,
  error,
  onRetry,
}: {
  analysisRunning: boolean;
  planRunning: boolean;
  analysisDone: boolean;
  planDone: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div
      style={{
        marginTop: 14,
        padding: 12,
        borderRadius: 14,
        background: "rgba(245,231,10,0.06)",
        border: `1px solid rgba(245,231,10,0.3)`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: YELLOW,
          fontWeight: 800,
          marginBottom: 8,
        }}
      >
        Агенты работают
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <AgentRow
          icon="🔍"
          name="Анна"
          task="разбирает конкурентов"
          running={analysisRunning}
          done={analysisDone}
        />
        <AgentRow
          icon="🗓"
          name="Александр"
          task="собирает план недели"
          running={planRunning}
          done={planDone}
        />
      </div>
      {error && (
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              fontSize: 12,
              color: "#F39B40",
              lineHeight: 1.4,
              marginBottom: 4,
            }}
          >
            Не дозвонились до агентов. Проверьте интернет и попробуйте снова.
          </div>
          <div
            style={{
              fontSize: 11,
              color: MUTED,
              lineHeight: 1.4,
              marginBottom: 8,
              wordBreak: "break-word",
            }}
          >
            {error}
          </div>
          <button
            onClick={onRetry}
            style={{
              appearance: "none",
              border: "none",
              borderRadius: 999,
              background: YELLOW,
              color: "#0A0608",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 800,
              padding: "8px 16px",
              cursor: "pointer",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Попробовать снова
          </button>
        </div>
      )}
    </div>
  );
}

function AgentRow({
  icon,
  name,
  task,
  running,
  done,
}: {
  icon: string;
  name: string;
  task: string;
  running: boolean;
  done: boolean;
}) {
  const status = running ? "…" : done ? "✓" : "—";
  const color = done ? "#5BD66B" : running ? YELLOW : MUTED;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontWeight: 700 }}>{name}</span>
      <span style={{ color: MUTED }}>{task}</span>
      <span
        style={{
          marginLeft: "auto",
          color,
          fontWeight: 800,
          fontSize: 14,
        }}
      >
        {status}
      </span>
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

  // Review-only режим: юзер не выбирает формат руками.
  // Если план есть — primary действие «Из плана» (топ-идея).
  // Если нет — единственная подсказка «Разведка» (там добавить конкурентов /
  // дождаться анализатора).
  if (hasPlan && topPlanIdea?.topic) {
    actions.push({
      key: "from-plan",
      label: "Из плана",
      icon: "→",
      onTap: () => onPickIdea(topPlanIdea),
      primary: true,
    });
  }
  if (!hasAnalysis) {
    actions.push({
      key: "scout",
      label: "Конкуренты",
      icon: "·",
      onTap: () => onOpenTab("scout"),
      primary: !hasPlan,
    });
  } else {
    actions.push({
      key: "scout",
      label: "Разведка",
      icon: "·",
      onTap: () => onOpenTab("scout"),
    });
  }
  // Anti-warning: onCreate ещё используется ScoutTab.onQuickCarousel/Plan.
  void onCreate;
  void isIg;

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

function FeedCard({
  item,
  onOpen,
  isIg,
  onCopy,
  onTogglePublished,
}: {
  item: FeedItem;
  onOpen: () => void;
  isIg?: boolean;
  onCopy?: (item: FeedItem) => void;
  onTogglePublished?: (item: FeedItem) => void;
}) {
  const kindLabel =
    item.kind === "reel" ? "Reel" : item.kind === "carousel" ? "Карусель" : "Пост";
  const status = humanStatus(item.status);
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
        padding: 14,
        color: INK,
        fontFamily: "inherit",
        width: "100%",
      }}
    >
      {/* Top row: type + date */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: YELLOW,
            fontWeight: 700,
          }}
        >
          {kindLabel}
        </span>
        <span style={{ marginLeft: "auto", color: MUTED, fontSize: 11 }}>
          {formatDate(item.createdAt)}
        </span>
      </div>

      {/* Preview */}
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.45,
          color: "rgba(255,255,255,0.9)",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: isIg ? 4 : 2,
          WebkitBoxOrient: "vertical",
          marginBottom: 8,
          whiteSpace: "pre-wrap",
        }}
      >
        {item.preview || "(без текста)"}
      </div>

      {(item.status === "failed" || item.status === "rejected") && item.error && (
        <div
          style={{
            fontSize: 11,
            color: "#F39B40",
            lineHeight: 1.4,
            marginBottom: 8,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          ⚠ {humanizeError(item.error)}
        </div>
      )}

      {/* Bottom row: status pill + actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {isIg ? (
          <PublishedToggle
            checked={!!item.publishedExternally}
            onChange={() => onTogglePublished?.(item)}
          />
        ) : (
          <StatusPill label={status.label} tone={status.tone} />
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {isIg && item.fullCopy && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy?.(item);
              }}
              style={{
                appearance: "none",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.04em",
                padding: "6px 12px",
                borderRadius: 999,
                background: YELLOW,
                border: "none",
                color: "#0A0608",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              СКОПИРОВАТЬ ВСЁ
            </button>
          )}
          {!isIg && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              style={{
                appearance: "none",
                fontSize: 11,
                fontWeight: 600,
                padding: "6px 10px",
                borderRadius: 999,
                background: "transparent",
                border: `1px solid ${CARD_BORDER}`,
                color: INK,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ОТКРЫТЬ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PublishedToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      style={{
        appearance: "none",
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 0,
        fontFamily: "inherit",
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          border: `1.5px solid ${checked ? "#5BD66B" : CARD_BORDER}`,
          background: checked ? "#5BD66B" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#0A0608",
          fontSize: 11,
          fontWeight: 900,
        }}
      >
        {checked ? "✓" : ""}
      </span>
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          fontWeight: 600,
          color: checked ? "#5BD66B" : MUTED,
        }}
      >
        {checked ? "опубликовано" : "не опубликовано"}
      </span>
    </button>
  );
}

function StatusPill({
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
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${color}`,
        background: `${color}1a`,
        color,
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: color,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}

// =====================================================================
// Scout tab — лёгкий перенос блоков из InstagramView
// =====================================================================

type LexInsightsLite = {
  niche_summary?: string;
  audience_pains?: string[];
  working_hooks?: string[];
  content_themes?: string[];
  tone_notes?: string;
  pitfalls?: string[];
  ready_hooks?: string[];
  carousel_themes?: { title: string; structure: string }[];
  reel_formats?: { format: string; example: string }[];
  posting_schedule?: string;
  hashtag_strategy?: string[];
  updated_at?: string;
};

function ScoutTab({
  projectId,
  isIg,
  competitors,
  analysis,
  lexInsights,
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
  lexInsights: LexInsightsLite | null;
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
      await lexAnalyze(projectId);
      hapticNotify("success");
      onRefresh();
    } catch (e) {
      hapticNotify("error");
      setActionErr(humanError(e, "Не получилось запустить анализ."));
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
      await lexWritePlan(projectId);
      hapticNotify("success");
      onRefresh();
    } catch (e) {
      hapticNotify("error");
      setActionErr(humanError(e, "Не получилось собрать план."));
    } finally {
      setPlanBusy(false);
    }
  };
  const planItems = plan?.items?.slice(0, 4) ?? [];
  // Старые поля analysis больше не используются — оставлено для совместимости типов
  void analysis;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Конкуренты — универсальный блок для TG и IG с inline-формой */}
      <CompetitorsCard
        projectId={projectId}
        isIg={isIg}
        igCompetitors={competitors}
        onChanged={onRefresh}
      />

      {/* Анализ ниши — отображаем lex_insights из БД */}
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 6,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>Анализ ниши</div>
          {lexInsights?.updated_at && (
            <span style={{ fontSize: 11, color: MUTED }}>
              {formatDate(lexInsights.updated_at)}
            </span>
          )}
        </div>
        {!lexInsights ? (
          <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
            Добавь конкурентов выше — LEX AI разберёт их и соберёт insights для ниши.
          </p>
        ) : (
          <>
            {lexInsights.niche_summary && (
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.9)",
                  lineHeight: 1.5,
                }}
              >
                {lexInsights.niche_summary}
              </p>
            )}
            {!!lexInsights.audience_pains?.length && (
              <SubBlock title="Боли аудитории">
                <ChipRow items={lexInsights.audience_pains} />
              </SubBlock>
            )}
            {!!lexInsights.working_hooks?.length && (
              <SubBlock title="Рабочие hooks у конкурентов">
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 16,
                    fontSize: 12,
                    color: "rgba(255,255,255,0.8)",
                    lineHeight: 1.5,
                  }}
                >
                  {lexInsights.working_hooks.slice(0, 5).map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </SubBlock>
            )}
            {!!lexInsights.content_themes?.length && (
              <SubBlock title="Темы ниши">
                <ChipRow items={lexInsights.content_themes} />
              </SubBlock>
            )}
            {lexInsights.tone_notes && (
              <SubBlock title="Тон конкурентов">
                <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
                  {lexInsights.tone_notes}
                </p>
              </SubBlock>
            )}
            {!!lexInsights.pitfalls?.length && (
              <SubBlock title="Чего избегать">
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 16,
                    fontSize: 12,
                    color: "rgba(255,255,255,0.8)",
                    lineHeight: 1.5,
                  }}
                >
                  {lexInsights.pitfalls.slice(0, 5).map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </SubBlock>
            )}

            {/* Playbook (IG) */}
            {!!lexInsights.ready_hooks?.length && (
              <SubBlock title={`Готовые hooks · ${lexInsights.ready_hooks.length}`}>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 16,
                    fontSize: 12,
                    color: "rgba(255,255,255,0.85)",
                    lineHeight: 1.55,
                  }}
                >
                  {lexInsights.ready_hooks.slice(0, 20).map((h, i) => (
                    <li key={i} style={{ marginBottom: 3 }}>{h}</li>
                  ))}
                </ul>
              </SubBlock>
            )}
            {!!lexInsights.carousel_themes?.length && (
              <SubBlock title={`Идеи каруселей · ${lexInsights.carousel_themes.length}`}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {lexInsights.carousel_themes.slice(0, 10).map((c, i) => (
                    <div key={i} style={{ fontSize: 12, lineHeight: 1.5 }}>
                      <div style={{ color: INK, fontWeight: 600 }}>· {c.title}</div>
                      {c.structure && (
                        <div style={{ color: MUTED, marginLeft: 12 }}>{c.structure}</div>
                      )}
                    </div>
                  ))}
                </div>
              </SubBlock>
            )}
            {!!lexInsights.reel_formats?.length && (
              <SubBlock title={`Форматы Reels · ${lexInsights.reel_formats.length}`}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {lexInsights.reel_formats.slice(0, 6).map((r, i) => (
                    <div key={i} style={{ fontSize: 12, lineHeight: 1.5 }}>
                      <div style={{ color: INK, fontWeight: 600 }}>· {r.format}</div>
                      {r.example && (
                        <div style={{ color: MUTED, marginLeft: 12 }}>{r.example}</div>
                      )}
                    </div>
                  ))}
                </div>
              </SubBlock>
            )}
            {lexInsights.posting_schedule && (
              <SubBlock title="Расписание постинга">
                <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                  {lexInsights.posting_schedule}
                </p>
              </SubBlock>
            )}
            {!!lexInsights.hashtag_strategy?.length && (
              <SubBlock title="Хэштеги для ниши">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {lexInsights.hashtag_strategy.map((h, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 11,
                        padding: "4px 8px",
                        borderRadius: 999,
                        background: `${YELLOW}14`,
                        border: `1px solid ${YELLOW}40`,
                        color: YELLOW,
                      }}
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </SubBlock>
            )}
          </>
        )}
        <button
          onClick={runAnalysis}
          disabled={analysisBusy}
          style={{
            ...miniBtn,
            marginTop: 10,
            opacity: analysisBusy ? 0.5 : 1,
          }}
        >
          {analysisBusy
            ? "LEX AI АНАЛИЗИРУЕТ…"
            : lexInsights
              ? "ПЕРЕЗАПУСТИТЬ АНАЛИЗ"
              : "ЗАПУСТИТЬ АНАЛИЗ"}
        </button>
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
            disabled={planBusy || !lexInsights}
            style={{
              ...miniBtn,
              flex: 1,
              opacity: planBusy || !lexInsights ? 0.5 : 1,
            }}
          >
            {planBusy
              ? "LEX AI СОБИРАЕТ…"
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

// =====================================================================
// IG Ideas — упрощённый таб для IG-проектов:
// playbook из brand_kit + тапаемые кнопки CTA.
// Заменяет "Разведку" с конкурентами для IG.
// =====================================================================

function IgIdeasTab({
  insights,
  onPickHook,
  onPickCarousel,
  onPickReel,
  onGoSettings,
}: {
  insights: LexInsightsLite | null;
  onPickHook: (hook: string) => void;
  onPickCarousel: (title: string, structure: string) => void;
  onPickReel: (format: string, example: string) => void;
  onGoSettings: () => void;
}) {
  if (!insights) {
    return (
      <Card>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
          Идеи появятся после Brand Setup
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
          Открой Настройки → Профиль бренда. Расскажи о нише, аудитории и тоне.
          LEX AI соберёт playbook: готовые hooks, идеи каруселей и Reels-форматы.
        </p>
        <button
          onClick={onGoSettings}
          style={{
            ...miniBtn,
            background: YELLOW,
            color: "#0A0608",
          }}
        >
          ОТКРЫТЬ НАСТРОЙКИ →
        </button>
      </Card>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Niche summary */}
      {insights.niche_summary && (
        <Card>
          <div style={{ fontSize: 11, color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
            твоя ниша
          </div>
          <p style={{ margin: 0, fontSize: 13, color: INK, lineHeight: 1.5 }}>
            {insights.niche_summary}
          </p>
        </Card>
      )}

      {/* Ready hooks */}
      {!!insights.ready_hooks?.length && (
        <Card>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            Готовые hooks для постов
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: MUTED }}>
            Тапни — создадим пост по этой теме
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {insights.ready_hooks.slice(0, 12).map((h, i) => (
              <button
                key={i}
                onClick={() => {
                  hapticImpact("light");
                  onPickHook(h);
                }}
                style={ideaRowStyle}
              >
                <span style={{ flex: 1, fontSize: 13, color: INK, lineHeight: 1.45, textAlign: "left" }}>
                  {h}
                </span>
                <span style={{ color: YELLOW, fontSize: 14, fontWeight: 700, marginLeft: 8 }}>›</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Carousel ideas */}
      {!!insights.carousel_themes?.length && (
        <Card>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            Идеи каруселей
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: MUTED }}>
            Тапни — соберём карусель с готовой структурой
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {insights.carousel_themes.slice(0, 8).map((c, i) => (
              <button
                key={i}
                onClick={() => {
                  hapticImpact("light");
                  onPickCarousel(c.title, c.structure);
                }}
                style={{ ...ideaRowStyle, flexDirection: "column", alignItems: "stretch", gap: 4 }}
              >
                <div style={{ fontSize: 13, color: INK, fontWeight: 600, textAlign: "left" }}>
                  · {c.title}
                </div>
                {c.structure && (
                  <div style={{ fontSize: 11, color: MUTED, textAlign: "left" }}>
                    {c.structure}
                  </div>
                )}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Reel ideas */}
      {!!insights.reel_formats?.length && (
        <Card>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            Форматы Reels
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: MUTED }}>
            Тапни — напишем сценарий в этом формате
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {insights.reel_formats.slice(0, 6).map((r, i) => (
              <button
                key={i}
                onClick={() => {
                  hapticImpact("light");
                  onPickReel(r.format, r.example);
                }}
                style={{ ...ideaRowStyle, flexDirection: "column", alignItems: "stretch", gap: 4 }}
              >
                <div style={{ fontSize: 13, color: INK, fontWeight: 600, textAlign: "left" }}>
                  · {r.format}
                </div>
                {r.example && (
                  <div style={{ fontSize: 11, color: MUTED, textAlign: "left" }}>
                    {r.example}
                  </div>
                )}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Hashtags */}
      {!!insights.hashtag_strategy?.length && (
        <Card>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
            Хэштеги для ниши
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {insights.hashtag_strategy.map((h, i) => (
              <span
                key={i}
                style={{
                  fontSize: 11,
                  padding: "5px 9px",
                  borderRadius: 999,
                  background: `${YELLOW}14`,
                  border: `1px solid ${YELLOW}40`,
                  color: YELLOW,
                }}
              >
                {h}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Schedule */}
      {insights.posting_schedule && (
        <Card>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
            Расписание постинга
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
            {insights.posting_schedule}
          </p>
        </Card>
      )}
    </div>
  );
}

const ideaRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 10,
  padding: "10px 12px",
  cursor: "pointer",
  fontFamily: "inherit",
  color: INK,
};

function CompetitorsCard({
  projectId,
  isIg,
  igCompetitors,
  onChanged,
}: {
  projectId: string;
  isIg: boolean;
  igCompetitors: IgAggregateCompetitor[];
  onChanged: () => void;
}) {
  // Для IG список приходит из агрегата, для TG показываем только локально добавленных.
  // Полноценный TG-list — TODO (нужен GET endpoint для competitor_channels).
  const initialIg = igCompetitors.map((c) => c.username);
  const [local, setLocal] = useState<string[]>([]);
  const all = isIg ? Array.from(new Set([...initialIg, ...local])) : local;

  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function normalize(raw: string): string {
    let s = raw.trim().replace(/^https?:\/\/(t\.me|instagram\.com|www\.instagram\.com)\//i, "");
    s = s.replace(/^@/, "").replace(/\/$/, "");
    return s.toLowerCase();
  }

  async function add() {
    const handle = normalize(value);
    if (!handle || handle.length < 3) {
      setErr("Минимум 3 символа.");
      return;
    }
    if (all.includes(handle)) {
      setErr("Уже добавлен.");
      return;
    }
    setBusy(true);
    setErr(null);
    hapticImpact("light");
    try {
      if (isIg) {
        await addIgCompetitor(projectId, { handle });
      } else {
        await addTgCompetitor(projectId, { username: handle });
      }
      setLocal((prev) => [...prev, handle]);
      setValue("");
      hapticNotify("success");
      onChanged();
    } catch (e) {
      hapticNotify("error");
      setErr(humanError(e, "Не получилось добавить."));
    } finally {
      setBusy(false);
    }
  }

  return (
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
          {all.length}{" "}
          {plural(all.length, "аккаунт", "аккаунта", "аккаунтов")}
        </span>
      </div>

      {all.length === 0 ? (
        <p style={{ margin: "0 0 10px", fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
          Добавь 1–5 конкурентов — LEX AI разберёт их и соберёт insights для ниши.
        </p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {all.slice(0, 12).map((u) => (
            <span
              key={u}
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
              @{u}
            </span>
          ))}
          {all.length > 12 && (
            <span style={{ fontSize: 12, color: MUTED, alignSelf: "center" }}>
              +{all.length - 12}
            </span>
          )}
        </div>
      )}

      {/* Inline-форма добавления */}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (err) setErr(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder={isIg ? "@username из IG" : "@username канала"}
          disabled={busy}
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 10,
            padding: "10px 12px",
            color: INK,
            fontSize: 14,
            fontFamily: "inherit",
            outline: "none",
          }}
        />
        <button
          onClick={add}
          disabled={busy || !value.trim()}
          style={{
            padding: "0 16px",
            background: YELLOW,
            color: "#0A0608",
            border: "none",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.06em",
            cursor: busy || !value.trim() ? "not-allowed" : "pointer",
            opacity: busy || !value.trim() ? 0.5 : 1,
          }}
        >
          {busy ? "…" : "+ ДОБАВИТЬ"}
        </button>
      </div>
      {err && (
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "#FF7373" }}>{err}</p>
      )}
    </Card>
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
  onContinueSetup,
  onOpenBilling,
  onProjectUpdated,
  onBrandSaved,
  onDeleted,
}: {
  project: ProjectDTO;
  isIg: boolean;
  handle: string | null;
  attached: boolean;
  onContinueSetup: () => void;
  onOpenBilling: () => void;
  onProjectUpdated: (project: ProjectDTO) => void;
  onBrandSaved?: () => void;
  onDeleted: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Подключение */}
      {!attached ? (
        <FinishSetupCard isIg={isIg} onContinue={onContinueSetup} />
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
            {isIg ? (
              <>
                Привязан {handle}. Агенты используют его для разведки и
                подсказок. <b style={{ color: INK }}>Публикация пока вручную</b>{" "}
                — мы готовим карусели/Reels, вы публикуете с телефона.
              </>
            ) : (
              <>Подключён {handle}. Можно публиковать.</>
            )}
          </p>
        </Card>
      )}

      {/* Профиль бренда — ядро IG-проекта, заменяет «разведку конкурентов» */}
      {isIg && (
        <BrandSetupCard projectId={project.id} onSaved={() => onBrandSaved?.()} />
      )}

      <RenameCard project={project} onUpdated={onProjectUpdated} />

      <DeleteCard project={project} onDeleted={onDeleted} />
    </div>
  );
}

// --- Support card (открывает @Strateg_alex_bot — бот поддержки) ---

function SupportCard() {
  const openSupport = () => {
    hapticImpact("light");
    const url = "https://t.me/Strateg_alex_bot";
    const tg = (typeof window !== "undefined" && (window as any).Telegram?.WebApp) || null;
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else if (tg?.openLink) tg.openLink(url);
    else window.open(url, "_blank");
  };
  return (
    <Card>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
        Поддержка
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
        Нашёл баг или есть вопрос — напиши нам в бота. Ответим в течение суток.
      </p>
      <button
        onClick={openSupport}
        style={{
          ...miniBtn,
          background: "rgba(255,255,255,0.06)",
          color: INK,
          border: `1px solid ${CARD_BORDER}`,
        }}
      >
        НАПИСАТЬ В ПОДДЕРЖКУ →
      </button>
    </Card>
  );
}

// --- Finish setup banner (единая точка возврата в onboarding) ---

function FinishSetupCard({
  isIg,
  onContinue,
}: {
  isIg: boolean;
  onContinue: () => void;
}) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          {isIg ? "Instagram-аккаунт" : "Telegram-канал"}
        </div>
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
      <p style={{ margin: "0 0 12px", fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
        {isIg ? (
          <>
            Без аккаунта LEX AI не понимает вашу нишу — анализ и план получатся
            обобщёнными. Подключение занимает минуту, это просто @username.{" "}
            <b style={{ color: INK }}>Публикация в IG пока вручную</b> — авто
            добавим позже.
          </>
        ) : (
          <>
            Без подключения агенты не смогут публиковать. Завершите подключение
            — займёт минуту.
          </>
        )}
      </p>
      <button
        onClick={() => {
          hapticImpact("light");
          onContinue();
        }}
        style={{
          ...miniBtn,
          background: YELLOW,
          color: "#0A0608",
        }}
      >
        {isIg ? "ПОДКЛЮЧИТЬ INSTAGRAM →" : "ЗАВЕРШИТЬ ПОДКЛЮЧЕНИЕ →"}
      </button>
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
      {tg ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M21.5 3.5L2.8 10.7c-1.1.4-1.1 1.1-.2 1.4l4.8 1.5 1.9 5.9c.2.7.4.9 1 .9.5 0 .7-.2 1-.5l2.4-2.3 4.9 3.6c.9.5 1.5.2 1.7-.8L23 5.2c.3-1.3-.5-1.9-1.5-1.7z"
            fill="#FFFFFF"
          />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="#FFFFFF" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="4" stroke="#FFFFFF" strokeWidth="1.8" />
          <circle cx="17.2" cy="6.8" r="1.1" fill="#FFFFFF" />
        </svg>
      )}
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
          "max(calc(env(safe-area-inset-bottom) + 100px), 116px)",
      }}
    >
      {children}
    </div>
  );
}

// --- helpers ---

function humanizeError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("whisper") || s.includes("transcribe")) {
    return "Не удалось расшифровать аудио. Попробуйте другой файл.";
  }
  if (s.includes("ffmpeg") || s.includes("render")) {
    return "Не удалось собрать видео. Попробуйте загрузить заново.";
  }
  if (s.includes("download") || s.includes("source") || s.includes("storage")) {
    return "Не удалось скачать видео. Попробуйте загрузить заново.";
  }
  if (s.includes("timeout")) {
    return "Слишком долго. Попробуйте ещё раз.";
  }
  if (s.includes("audio")) {
    return "В видео не нашли голос — нужна речь.";
  }
  if (s.includes("quota") || s.includes("limit")) {
    return "Достигнут лимит — обновите тариф.";
  }
  // Длинные технические — сокращаем.
  return raw.length > 80 ? "Что-то пошло не так. Попробуйте ещё раз." : raw;
}

function humanStatus(
  s: string,
): { label: string; tone: "ok" | "warn" | "muted" | "live"; action: string } {
  switch (s) {
    case "published":
      return { label: "опубликовано", tone: "ok", action: "Посмотреть" };
    case "approved":
    case "scheduled":
      return { label: "запланировано", tone: "ok", action: "Управлять" };
    case "ready":
    case "pending":
      return { label: "черновик", tone: "live", action: "Принять решение" };
    case "rejected":
      return { label: "отклонено", tone: "warn", action: "Создать новый" };
    case "failed":
      return { label: "ошибка", tone: "warn", action: "Пересобрать" };
    case "done":
      return { label: "готово", tone: "ok", action: "Открыть" };
    case "awaiting_approval":
      return { label: "нужны акценты", tone: "live", action: "Выбрать акценты" };
    case "rendering":
    case "claimed":
    case "generating":
      return { label: "в работе", tone: "live", action: "Смотреть прогресс" };
    default:
      return { label: s || "—", tone: "muted", action: "Открыть" };
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
