"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import StateBlock from "./StateBlock";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const SUB_MUTED = "rgba(255,255,255,0.42)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const OK = "#5BD66B";
const PREFILL_URL_KEY = "lex_prefill_reel_url";

const TYPE_ICON: Record<string, string> = {
  reel: "🎬",
  carousel: "🖼",
  caption: "✏️",
  idea: "💡",
  post: "📝",
};

type HomeScreenProps = { onStart?: () => void };

function LexLogo({ height = 34 }: { height?: number }) {
  return (
    <div
      aria-label="LEX AI"
      style={{ display: "inline-flex", alignItems: "center", gap: height * 0.34, height, lineHeight: 1 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.jpg"
        alt=""
        style={{
          height: height * 1.15,
          width: height * 1.15,
          objectFit: "cover",
          display: "block",
          borderRadius: height * 0.32,
        }}
      />
      <div style={{ fontSize: height * 0.62, fontWeight: 700, letterSpacing: "0.06em" }}>
        <span style={{ color: INK }}>LEX </span>
        <span style={{ color: YELLOW }}>AI</span>
      </div>
    </div>
  );
}

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

  // Подтягиваем проекты (если кэш пустой)
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

  // Подтягиваем план + материалы активного проекта
  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    getWeekPlan(activeId).then((p) => alive && setPlan(p)).catch(() => {});
    listProjectDrafts(activeId)
      .then((r) => alive && setDrafts(r.drafts))
      .catch(() => alive && setDrafts([]));
    listReelDecodes(activeId)
      .then((r) => alive && r.quota && setQuota(r.quota))
      .catch(() => {});
    return () => { alive = false; };
  }, [activeId]);

  const activeProject = projects.find((p) => p.id === activeId) || null;

  const goToProject = (tab?: string) => {
    hapticImpact("light");
    if (activeId) actions.setIds({ projectId: activeId });
    if (tab) actions.setScreenMeta("projectInitialTab", tab);
    actions.navigate(activeId ? "project" : "create-project");
  };

  // Открыть конкретный инструмент создания (таб ToolsScreen).
  const goToTool = (toolTab: string) => {
    hapticImpact("light");
    if (!activeId) { actions.navigate("create-project"); return; }
    actions.setIds({ projectId: activeId });
    actions.setScreenMeta("toolTab", toolTab);
    actions.navigate("tools");
  };

  const runDecode = () => {
    if (!url.trim()) return;
    hapticImpact("medium");
    try { localStorage.setItem(PREFILL_URL_KEY, url.trim()); } catch {}
    if (activeId) actions.setIds({ projectId: activeId });
    actions.setScreenMeta("projectInitialTab", "overview");
    actions.navigate(activeId ? "project" : "create-project");
  };

  // Нет проектов — экран создания первого
  if (projects.length === 0) {
    return (
      <ScreenWrap>
        <TopBar onSwitch={null} project={null} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18, textAlign: "center" }}>
          <div style={{ fontSize: 48 }}>🎬</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            Преврати любой Reels<br />в контент для своего блога
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: MUTED, lineHeight: 1.5 }}>
            Создай первый Instagram-проект — и LEX начнёт разбирать Reels
            и собирать сценарии под твою нишу.
          </p>
          <button onClick={() => { hapticImpact("medium"); actions.navigate("create-project"); }} style={primaryBtn}>
            Создать проект
          </button>
        </div>
      </ScreenWrap>
    );
  }

  return (
    <ScreenWrap>
      <TopBar
        project={activeProject}
        onSwitch={projects.length > 1 ? () => { hapticSelection(); setSwitcherOpen((v) => !v); } : null}
      />

      {/* Переключатель проектов */}
      {switcherOpen && projects.length > 1 && (
        <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => { hapticSelection(); setActiveId(p.id); setSwitcherOpen(false); }}
              style={{
                appearance: "none",
                textAlign: "left",
                padding: "12px 14px",
                borderRadius: 12,
                border: `1px solid ${p.id === activeId ? YELLOW : CARD_BORDER}`,
                background: p.id === activeId ? "rgba(245,231,10,0.08)" : CARD_BG,
                color: INK,
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {p.title}
            </button>
          ))}
        </div>
      )}

      {/* Что создаём сегодня */}
      <div
        style={{
          borderRadius: 20,
          padding: 18,
          marginBottom: 16,
          background:
            "radial-gradient(circle 200px at 100% 0%, rgba(245,133,41,0.20), transparent 60%)," +
            "radial-gradient(circle 220px at 0% 100%, rgba(129,52,175,0.18), transparent 60%)," +
            "linear-gradient(135deg, #160B14 0%, #0A0608 100%)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em" }}>
          Что создаём сегодня?
        </h2>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Вставь ссылку на Reels…"
          style={{
            appearance: "none",
            width: "100%",
            padding: "12px 14px",
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 12,
            color: INK,
            fontFamily: "inherit",
            fontSize: 14,
            outline: "none",
            marginBottom: 10,
          }}
        />
        <button
          onClick={runDecode}
          disabled={!url.trim()}
          style={{
            ...primaryBtn,
            opacity: url.trim() ? 1 : 0.5,
            marginBottom: 10,
          }}
        >
          Разобрать и адаптировать
        </button>

        {/* Подсказка-активатор: лечит «не понимаю что вставить» */}
        <div style={{ fontSize: 12, color: SUB_MUTED, lineHeight: 1.45, marginBottom: 12 }}>
          🎬 Не знаешь что вставить? Возьми вирусный Reels конкурента или лидера
          ниши — LEX покажет почему он работает.
        </div>

        {/* Счётчик разборов → осознание лимита (мягко ведёт к Pro) */}
        {quota && (
          <QuotaCounter quota={quota} onUpgrade={() => { hapticImpact("light"); actions.navigate("billing"); }} />
        )}

        {/* Быстрые действия — создание с нуля (ведут в инструменты) */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 12 }}>
          <QuickChip label="✨ Сценарий" onClick={() => goToTool("script")} />
          <QuickChip label="🖼 Карусель" onClick={() => goToTool("carousel")} />
          <QuickChip label="✏️ Подпись" onClick={() => goToTool("caption")} />
          <QuickChip label="📦 Пакет" onClick={() => goToTool("pack")} />
        </div>
      </div>

      {/* Прогресс недели */}
      {plan && plan.summary.total > 0 && (
        <Link
          href="#"
          onClick={(e) => { e.preventDefault(); hapticImpact("light"); actions.navigate("plan"); }}
          style={{ textDecoration: "none", display: "block", marginBottom: 16 }}
        >
          <div
            style={{
              borderRadius: 16,
              padding: 16,
              background: "linear-gradient(135deg, rgba(245,231,10,0.10) 0%, rgba(245,231,10,0.03) 100%)",
              border: "1px solid rgba(245,231,10,0.22)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: INK }}>План на неделю</span>
              <span style={{ fontSize: 13, color: YELLOW, fontWeight: 700 }}>
                {plan.summary.ready + plan.summary.published} из {plan.summary.total} готовы
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${plan.summary.progress_pct}%`,
                background: `linear-gradient(90deg, ${OK} 0%, ${YELLOW} 100%)`,
              }} />
            </div>
          </div>
        </Link>
      )}

      {/* Продолжить работу — незавершённые */}
      {drafts && (() => {
        const unfinished = drafts.filter((d) =>
          ["scenario_ready", "draft", "idea", "ready_to_shoot"].includes(d.status),
        ).slice(0, 3);
        if (unfinished.length === 0) return null;
        return (
          <Section title="Продолжить работу">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {unfinished.map((d) => (
                <MaterialRow key={d.id} draft={d} onClick={() => goToProject("library")} />
              ))}
            </div>
          </Section>
        );
      })()}

      {/* Последние материалы */}
      {drafts && drafts.length > 0 && (
        <Section title="Последние материалы" action={{ label: "Все →", onClick: () => goToProject("library") }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {drafts.slice(0, 5).map((d) => (
              <MaterialRow key={d.id} draft={d} onClick={() => goToProject("library")} />
            ))}
          </div>
        </Section>
      )}

      {/* Пусто */}
      {drafts && drafts.length === 0 && (
        <StateBlock
          emoji="🎬"
          title="Пока нет материалов"
          body="Вставь ссылку на Reels выше — и LEX соберёт первый сценарий."
        />
      )}
    </ScreenWrap>
  );
}

function TopBar({ project, onSwitch }: { project: ProjectDTO | null; onSwitch: (() => void) | null }) {
  const hour = new Date().getHours();
  const greeting = hour < 6 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <LexLogo height={30} />
      </div>
      <div style={{ fontSize: 13, color: MUTED }}>{greeting} 👋</div>
      {project && (
        <button
          onClick={onSwitch ?? undefined}
          style={{
            appearance: "none",
            background: "none",
            border: "none",
            padding: 0,
            marginTop: 2,
            color: INK,
            fontFamily: "inherit",
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            cursor: onSwitch ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {project.title}
          {onSwitch && <span style={{ color: MUTED, fontSize: 14 }}>▾</span>}
        </button>
      )}
    </div>
  );
}

function QuotaCounter({ quota, onUpgrade }: { quota: ReelQuotaDTO; onUpgrade: () => void }) {
  const left = Math.max(0, quota.limit - quota.used);
  const isPaid = quota.tier !== "free";
  // На платных тарифах не дёргаем — просто не показываем счётчик-апселл.
  if (isPaid) return null;

  const empty = left === 0;
  return (
    <button
      onClick={empty ? onUpgrade : undefined}
      style={{
        appearance: "none",
        width: "100%",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 12px",
        borderRadius: 10,
        border: `1px solid ${empty ? "rgba(245,231,10,0.35)" : CARD_BORDER}`,
        background: empty ? "rgba(245,231,10,0.08)" : "rgba(255,255,255,0.03)",
        color: INK,
        fontFamily: "inherit",
        cursor: empty ? "pointer" : "default",
      }}
    >
      <span style={{ fontSize: 13 }}>{empty ? "🔒" : "🎬"}</span>
      <span style={{ flex: 1, fontSize: 12, color: empty ? YELLOW : MUTED, fontWeight: empty ? 700 : 500 }}>
        {empty
          ? "Бесплатные разборы закончились — открой Pro"
          : `Осталось разборов: ${left} из ${quota.limit}`}
      </span>
      {empty && <span style={{ fontSize: 12, color: YELLOW, fontWeight: 800 }}>→</span>}
    </button>
  );
}

function QuickChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: "none",
        flexShrink: 0,
        padding: "8px 14px",
        borderRadius: 999,
        border: `1px solid ${CARD_BORDER}`,
        background: "rgba(255,255,255,0.05)",
        color: INK,
        fontFamily: "inherit",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: MUTED, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 700 }}>
          {title}
        </div>
        {action && (
          <button onClick={action.onClick} style={{ appearance: "none", background: "none", border: "none", color: YELLOW, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            {action.label}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function statusLabel(status: string): { label: string; color: string } {
  if (status === "published") return { label: "Опубликовано", color: OK };
  if (["ready_to_shoot", "shot", "ready_to_publish", "scheduled", "approved"].includes(status))
    return { label: "Готово к съёмке", color: YELLOW };
  return { label: "Черновик", color: SUB_MUTED };
}

function MaterialRow({ draft, onClick }: { draft: ContentDraftDTO; onClick: () => void }) {
  const sl = statusLabel(draft.status);
  const title = draft.title || draft.source_topic || "Без названия";
  return (
    <button
      onClick={onClick}
      style={{
        appearance: "none",
        textAlign: "left",
        width: "100%",
        padding: "12px 14px",
        borderRadius: 12,
        border: `1px solid ${CARD_BORDER}`,
        background: CARD_BG,
        color: INK,
        fontFamily: "inherit",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{TYPE_ICON[draft.content_type] || "📄"}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {title}
      </span>
      <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: sl.color }}>{sl.label}</span>
    </button>
  );
}

const primaryBtn: React.CSSProperties = {
  appearance: "none",
  width: "100%",
  padding: "14px 0",
  border: "none",
  borderRadius: 999,
  background: `linear-gradient(135deg, #FFF382 0%, ${YELLOW} 50%, #E5C500 100%)`,
  color: "#0A0608",
  fontSize: 15,
  fontWeight: 800,
  letterSpacing: "0.02em",
  fontFamily: "inherit",
  cursor: "pointer",
};

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
          "max(calc(env(safe-area-inset-top) + 56px), 88px) 18px " +
          "max(calc(env(safe-area-inset-bottom) + 96px), 110px)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {children}
    </div>
  );
}
