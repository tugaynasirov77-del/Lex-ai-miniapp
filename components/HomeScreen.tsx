"use client";

import { useEffect, useState } from "react";
import { useFlow, useFlowActions } from "../flow";
import {
  peekProjects,
  listProjects,
  getWeekPlan,
  listProjectDrafts,
  listReelDecodes,
  type ProjectDTO,
  type WeekPlanDTO,
  type ContentDraftDTO,
  type ReelQuotaDTO,
} from "../lib/api";
import { hapticImpact, hapticSelection } from "../lib/telegram";

// ─── Светлая тема (по референсу) ───
const BG = "#FFFFFF";
const INK = "#15151E";          // основной текст
const MUTED = "#6B6B7B";        // вторичный текст
const SUB_MUTED = "#9A9AAB";    // третичный
const CARD_BG = "#FFFFFF";
const CARD_BORDER = "#EEEEF2";
const SOFT = "#F6F6F9";         // мягкий фон карточек/полей
const IG_GRADIENT = "linear-gradient(95deg, #833AB4 0%, #DD2A7B 50%, #F77737 100%)";
const PINK = "#DD2A7B";
const PREFILL_URL_KEY = "lex_prefill_reel_url";
const PREFILL_IDEA_KEY = "lex_prefill_script_idea";

const TYPE_ICON: Record<string, string> = {
  reel: "🎬", carousel: "🖼", caption: "✏️", idea: "💡", post: "📝",
};

type HomeScreenProps = { onStart?: () => void };

// Идеи дня — стартовый набор готовых входов (бриф: не оставлять пустое поле).
const DAILY_IDEAS: { tag: string; tagColor: string; tagBg: string; emoji: string; title: string; category: string }[] = [
  { tag: "Популярно", tagColor: "#9B30C9", tagBg: "#F3E6FA", emoji: "🎯", title: "Расскажи ошибку, которая стоила тебе денег", category: "Бизнес" },
  { tag: "Тренд", tagColor: "#E0641B", tagBg: "#FCEEE2", emoji: "🔥", title: "Покажи свой рабочий процесс от начала до конца", category: "Личный бренд" },
  { tag: "Высокий охват", tagColor: "#2E9E5B", tagBg: "#E4F6EC", emoji: "⏱", title: "3 совета, которые сэкономят время каждому", category: "Лайфстайл" },
];

export default function HomeScreen(_props: HomeScreenProps = {}) {
  const { state } = useFlow();
  const actions = useFlowActions();

  const [projects, setProjects] = useState<ProjectDTO[]>(
    () => peekProjects()?.projects.filter((p) => p.platform === "instagram") ?? [],
  );
  const [activeId, setActiveId] = useState<string | null>(
    state.projectId || projects[0]?.id || null,
  );
  const [plan, setPlan] = useState<WeekPlanDTO | null>(null);
  const [drafts, setDrafts] = useState<ContentDraftDTO[] | null>(null);
  const [quota, setQuota] = useState<ReelQuotaDTO | null>(null);
  const [url, setUrl] = useState("");
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    listProjects()
      .then((r) => {
        if (!alive) return;
        const ig = r.projects.filter((p) => p.platform === "instagram");
        setProjects(ig);
        if (!activeId && ig[0]) setActiveId(ig[0].id);
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    getWeekPlan(activeId).then((p) => alive && setPlan(p)).catch(() => {});
    listProjectDrafts(activeId).then((r) => alive && setDrafts(r.drafts)).catch(() => alive && setDrafts([]));
    listReelDecodes(activeId).then((r) => alive && r.quota && setQuota(r.quota)).catch(() => {});
    return () => { alive = false; };
  }, [activeId]);

  const activeProject = projects.find((p) => p.id === activeId) || null;

  const runDecode = () => {
    if (!url.trim()) return;
    hapticImpact("medium");
    try { localStorage.setItem(PREFILL_URL_KEY, url.trim()); } catch {}
    if (activeId) actions.setIds({ projectId: activeId });
    actions.setScreenMeta("projectInitialTab", "overview");
    actions.navigate(activeId ? "project" : "create-project");
  };

  const goToTool = (toolTab: string) => {
    hapticImpact("light");
    if (!activeId) { actions.navigate("create-project"); return; }
    actions.setIds({ projectId: activeId });
    actions.setScreenMeta("toolTab", toolTab);
    actions.navigate("tools");
  };

  const useIdea = (title: string) => {
    hapticImpact("light");
    try { localStorage.setItem(PREFILL_IDEA_KEY, title); } catch {}
    goToTool("script");
  };

  const goLibrary = () => {
    hapticImpact("light");
    if (activeId) actions.setIds({ projectId: activeId });
    actions.setScreenMeta("projectInitialTab", "library");
    actions.navigate(activeId ? "project" : "create-project");
  };

  return (
    <ScreenWrap>
      {/* Мини-хедер: лого + переключатель проекта */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <LexLogo height={26} />
        {activeProject && (
          <button
            onClick={() => { if (projects.length > 1) { hapticSelection(); setSwitcherOpen((v) => !v); } }}
            style={{
              appearance: "none", background: SOFT, border: `1px solid ${CARD_BORDER}`,
              borderRadius: 999, padding: "6px 12px", color: INK, fontFamily: "inherit",
              fontSize: 13, fontWeight: 600, cursor: projects.length > 1 ? "pointer" : "default",
              display: "flex", alignItems: "center", gap: 6, maxWidth: 160,
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {activeProject.title}
            </span>
            {projects.length > 1 && <span style={{ color: MUTED, fontSize: 11 }}>▾</span>}
          </button>
        )}
      </div>

      {switcherOpen && projects.length > 1 && (
        <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => { hapticSelection(); setActiveId(p.id); setSwitcherOpen(false); }}
              style={{
                appearance: "none", textAlign: "left", padding: "12px 14px", borderRadius: 12,
                border: `1px solid ${p.id === activeId ? PINK : CARD_BORDER}`,
                background: p.id === activeId ? "#FCEAF2" : CARD_BG,
                color: INK, fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              {p.title}
            </button>
          ))}
        </div>
      )}

      {/* Заголовок */}
      <h1 style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.12, textAlign: "center", color: INK }}>
        Превращайте вирусные Reels
        <br />
        <span style={{ background: IG_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          в готовые сценарии
        </span>{" "}
        ⚡
      </h1>
      <p style={{ margin: "12px auto 22px", fontSize: 14, color: MUTED, lineHeight: 1.5, textAlign: "center", maxWidth: 320 }}>
        Вставьте ссылку на Reels — мы разберём видео и создадим сценарий, который работает.
      </p>

      {/* Карточка ввода + градиентная кнопка */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 22, padding: 16, boxShadow: "0 8px 28px rgba(20,20,40,0.06)", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 4px 14px" }}>
          <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 14, background: "#FCEAF2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔗</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 2 }}>Вставьте ссылку на Reels</div>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/..."
              style={{
                appearance: "none", width: "100%", border: "none", outline: "none",
                background: "transparent", color: INK, fontFamily: "inherit", fontSize: 13,
                padding: 0,
              }}
            />
          </div>
        </div>
        <button
          onClick={runDecode}
          disabled={!url.trim()}
          style={{
            appearance: "none", width: "100%", padding: "16px 0", border: "none", borderRadius: 16,
            background: IG_GRADIENT, color: "#FFFFFF", fontSize: 16, fontWeight: 800,
            letterSpacing: "0.01em", fontFamily: "inherit",
            cursor: url.trim() ? "pointer" : "not-allowed",
            opacity: url.trim() ? 1 : 0.55,
            boxShadow: url.trim() ? "0 12px 28px rgba(221,42,123,0.35)" : "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <span>✨</span> Создать свой сценарий
        </button>
        <div style={{ fontSize: 11, color: SUB_MUTED, textAlign: "center", marginTop: 10 }}>
          🔥 340+ блогеров уже разбирают Reels с LEX
          {quota && quota.tier === "free" && (
            <> · осталось {Math.max(0, quota.limit - quota.used)} из {quota.limit}</>
          )}
        </div>
      </div>

      {/* 3 фичи */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 22, padding: "20px 14px", marginBottom: 24, boxShadow: "0 8px 28px rgba(20,20,40,0.05)" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <Feature emoji="📺" bg="#F3E6FA" title="Разбор вирусного контента" body="Анализируем структуру, крючки и посыл видео" />
          <Feature emoji="🪄" bg="#FCEAF2" title="Готовый сценарий под вас" body="Получите текст, который можно сразу снимать" />
          <Feature emoji="📈" bg="#FCEEE2" title="Больше охватов и подписчиков" body="Используйте рабочие форматы и приёмы" />
        </div>
      </div>

      {/* Идеи для Reels на сегодня */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>📸</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: INK, letterSpacing: "-0.02em" }}>Идеи для Reels на сегодня</span>
        </div>
        <button onClick={goLibrary} style={{ appearance: "none", background: "none", border: "none", color: PINK, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Смотреть все
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {DAILY_IDEAS.map((idea, i) => (
          <IdeaCard key={i} idea={idea} onUse={() => useIdea(idea.title)} />
        ))}
      </div>

      {/* Прогресс недели — для существующих юзеров (под референс-блоками) */}
      {plan && plan.summary.total > 0 && (
        <button
          onClick={() => { hapticImpact("light"); actions.navigate("plan"); }}
          style={{ appearance: "none", width: "100%", textAlign: "left", marginTop: 24, padding: 16, borderRadius: 18, border: `1px solid ${CARD_BORDER}`, background: SOFT, cursor: "pointer", fontFamily: "inherit" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: INK }}>План на неделю</span>
            <span style={{ fontSize: 13, color: PINK, fontWeight: 700 }}>
              {plan.summary.ready + plan.summary.published} из {plan.summary.total} готовы
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "#EAEAF0", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${plan.summary.progress_pct}%`, background: IG_GRADIENT }} />
          </div>
        </button>
      )}

      {/* Последние материалы */}
      {drafts && drafts.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>Последние материалы</span>
            <button onClick={goLibrary} style={{ appearance: "none", background: "none", border: "none", color: PINK, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Все →</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {drafts.slice(0, 4).map((d) => (
              <MaterialRow key={d.id} draft={d} onClick={goLibrary} />
            ))}
          </div>
        </div>
      )}
    </ScreenWrap>
  );
}

function LexLogo({ height = 26 }: { height?: number }) {
  return (
    <div aria-label="LEX AI" style={{ display: "inline-flex", alignItems: "center", gap: height * 0.34, height, lineHeight: 1 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.jpg" alt="" style={{ height: height * 1.15, width: height * 1.15, objectFit: "cover", display: "block", borderRadius: height * 0.32 }} />
      <div style={{ fontSize: height * 0.66, fontWeight: 800, letterSpacing: "0.04em" }}>
        <span style={{ color: INK }}>LEX </span>
        <span style={{ background: IG_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>AI</span>
      </div>
    </div>
  );
}

function Feature({ emoji, bg, title, body }: { emoji: string; bg: string; title: string; body: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "0 4px" }}>
      <div style={{ width: 46, height: 46, margin: "0 auto 10px", borderRadius: 14, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{emoji}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: INK, lineHeight: 1.25, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.35 }}>{body}</div>
    </div>
  );
}

function IdeaCard({ idea, onUse }: { idea: typeof DAILY_IDEAS[number]; onUse: () => void }) {
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 18, padding: 16, boxShadow: "0 6px 20px rgba(20,20,40,0.04)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: idea.tagBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{idea.emoji}</div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 9px", borderRadius: 999, background: idea.tagBg, color: idea.tagColor }}>{idea.tag}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: INK, lineHeight: 1.3, marginBottom: 6 }}>{idea.title}</div>
      <div style={{ fontSize: 12, color: SUB_MUTED, marginBottom: 14 }}>{idea.category}</div>
      <button
        onClick={onUse}
        style={{
          appearance: "none", width: "100%", padding: "11px 0", borderRadius: 12,
          border: `1.5px solid ${PINK}`, background: "transparent", color: PINK,
          fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}
      >
        Получить сценарий
      </button>
    </div>
  );
}

function statusLabel(status: string): { label: string; color: string } {
  if (status === "published") return { label: "Опубликовано", color: "#2E9E5B" };
  if (["ready_to_shoot", "shot", "ready_to_publish", "scheduled", "approved"].includes(status))
    return { label: "Готово к съёмке", color: "#E0641B" };
  return { label: "Черновик", color: SUB_MUTED };
}

function MaterialRow({ draft, onClick }: { draft: ContentDraftDTO; onClick: () => void }) {
  const sl = statusLabel(draft.status);
  const title = draft.title || draft.source_topic || "Без названия";
  return (
    <button
      onClick={onClick}
      style={{
        appearance: "none", textAlign: "left", width: "100%", padding: "12px 14px", borderRadius: 14,
        border: `1px solid ${CARD_BORDER}`, background: CARD_BG, color: INK, fontFamily: "inherit",
        cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{TYPE_ICON[draft.content_type] || "📄"}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
      <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: sl.color }}>{sl.label}</span>
    </button>
  );
}

function ScreenWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: BG,
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding:
          "max(calc(env(safe-area-inset-top) + 56px), 80px) 18px " +
          "max(calc(env(safe-area-inset-bottom) + 96px), 110px)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {children}
    </div>
  );
}
