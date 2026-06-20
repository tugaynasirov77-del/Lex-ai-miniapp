"use client";

import { useEffect, useState } from "react";
import { useFlow, useFlowActions } from "../flow";
import {
  peekProjects,
  listProjects,
  getWeekPlan,
  listProjectDrafts,
  listReelDecodes,
  getDailyIdeas,
  type ProjectDTO,
  type WeekPlanDTO,
  type ContentDraftDTO,
  type ReelQuotaDTO,
  type DailyIdeaDTO,
} from "../lib/api";
import { hapticImpact, hapticSelection } from "../lib/telegram";
import * as P from "./icons/PremiumIcons";

// ─── Тёмная тема ───
const BG = "#0B0B11";
const INK = "#F4F4F8";          // основной текст
const MUTED = "#9A9AAB";        // вторичный текст
const SUB_MUTED = "#6B6B7B";    // третичный
const CARD_BG = "#15151E";
const CARD_BORDER = "#262630";
const SOFT = "#1C1C26";         // мягкий фон карточек/полей
const IG_GRADIENT = "linear-gradient(95deg, #A24FD6 0%, #E84B91 50%, #F88A4A 100%)";
const PINK = "#E84B91";
// Акцентные цвета иконок
const ACC_PURPLE = "#A24FD6";
const ACC_PINK = "#E84B91";
const ACC_ORANGE = "#F0944E";
const ACC_GREEN = "#4FD489";
const TINT_PINK = "rgba(232,75,145,0.16)";

// Плашка иконки: лёгкий градиент + цветное кольцо + мягкое свечение (premium-вид)
function iconTile(hex: string): React.CSSProperties {
  return {
    background: `linear-gradient(150deg, ${hex}30, ${hex}12)`,
    border: `1px solid ${hex}3D`,
    boxShadow: `0 6px 16px ${hex}26, inset 0 1px 0 ${hex}24`,
  };
}
const PREFILL_URL_KEY = "lex_prefill_reel_url";
const PREFILL_IDEA_KEY = "lex_prefill_script_idea";


type HomeScreenProps = { onStart?: () => void };

// Визуальные пресеты карточек идей (цикл по индексу).
type IdeaVisual = { tag: string; tagColor: string; accent: string; icon: "target" | "flame" | "clock" };
const IDEA_VISUALS: IdeaVisual[] = [
  { tag: "Популярно", tagColor: "#C78BEB", accent: ACC_PURPLE, icon: "target" },
  { tag: "Тренд", tagColor: "#F0944E", accent: ACC_ORANGE, icon: "flame" },
  { tag: "Высокий охват", tagColor: "#4FD489", accent: ACC_GREEN, icon: "clock" },
];

// Контент карточки идеи (текст). hook — seed для генератора сценария.
type IdeaDef = { title: string; category: string; hook?: string };

// Фолбэк, когда проекта/AI-идей ещё нет (бриф: не оставлять пустое поле).
const FALLBACK_IDEAS: IdeaDef[] = [
  { title: "Расскажи ошибку, которая стоила тебе денег", category: "Бизнес" },
  { title: "Покажи свой рабочий процесс от начала до конца", category: "Личный бренд" },
  { title: "3 совета, которые сэкономят время каждому", category: "Лайфстайл" },
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
  const [ideas, setIdeas] = useState<DailyIdeaDTO[] | null>(null);
  const [ideasLoading, setIdeasLoading] = useState(false);
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
    setIdeasLoading(true);
    getDailyIdeas(activeId)
      .then((r) => { if (alive) setIdeas(r.ideas); })
      .catch(() => {})
      .finally(() => { if (alive) setIdeasLoading(false); });
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

  const useIdea = (idea: IdeaDef) => {
    hapticImpact("light");
    try { localStorage.setItem(PREFILL_IDEA_KEY, idea.hook || idea.title); } catch {}
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
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "flex-start", marginBottom: 22, minHeight: 30 }}>
        <LexLogo height={26} />
        {activeProject && (
          <button
            onClick={() => { if (projects.length > 1) { hapticSelection(); setSwitcherOpen((v) => !v); } }}
            style={{
              position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
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
                background: p.id === activeId ? TINT_PINK : CARD_BG,
                color: INK, fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              {p.title}
            </button>
          ))}
        </div>
      )}

      {/* Заголовок */}
      <h1 style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.12, textAlign: "center", color: INK }}>
        Превращайте вирусные Reels
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, whiteSpace: "nowrap" }}>
          <span style={{ background: IG_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            в готовые сценарии
          </span>
          <BoltIcon size={24} />
        </span>
      </h1>
      <p style={{ margin: "12px auto 22px", fontSize: 14, color: MUTED, lineHeight: 1.5, textAlign: "center", maxWidth: 320 }}>
        Вставьте ссылку на Reels — мы разберём видео и создадим сценарий, который работает.
      </p>

      {/* Карточка ввода + градиентная кнопка */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 22, padding: 16, boxShadow: "0 8px 28px rgba(20,20,40,0.06)", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 4px 14px" }}>
          <div style={{ flexShrink: 0, display: "flex" }}><P.PremiumLinkIcon size={44} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 2 }}>Вставьте ссылку на Reels</div>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/..."
              style={{
                appearance: "none", width: "100%", outline: "none",
                background: SOFT, color: INK, fontFamily: "inherit", fontSize: 13,
                border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: "9px 12px",
              }}
            />
          </div>
          <button
            onClick={async () => {
              hapticSelection();
              try { const t = await navigator.clipboard.readText(); if (t) setUrl(t.trim()); } catch {}
            }}
            aria-label="Вставить из буфера"
            style={{ appearance: "none", alignSelf: "flex-end", flexShrink: 0, width: 38, height: 38, borderRadius: 10, border: `1px solid ${CARD_BORDER}`, background: SOFT, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
          >
            <CopyIcon color={MUTED} />
          </button>
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
          <SparkleIcon /> Создать свой сценарий
        </button>
        <div style={{ fontSize: 11, color: SUB_MUTED, textAlign: "center", marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <FlameIcon size={13} color="#F0944E" /> 340+ блогеров уже разбирают Reels с LEX
          {quota && quota.tier === "free" && (
            <> · осталось {Math.max(0, quota.limit - quota.used)} из {quota.limit}</>
          )}
        </div>
      </div>

      {/* 3 фичи */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 22, padding: "20px 14px", marginBottom: 24, boxShadow: "0 8px 28px rgba(20,20,40,0.05)" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <Feature icon={<P.PremiumVideoIcon size={48} />} accent={ACC_PURPLE} title="Разбор вирусного контента" body="Анализируем структуру, крючки и посыл видео" />
          <Feature icon={<P.PremiumWandIcon size={48} />} accent={ACC_PINK} title="Готовый сценарий под вас" body="Получите текст, который можно сразу снимать" />
          <Feature icon={<P.PremiumTrendIcon size={48} />} accent={ACC_ORANGE} title="Больше охватов и подписчиков" body="Используйте рабочие форматы и приёмы" />
        </div>
      </div>

      {/* Идеи для Reels на сегодня */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <InstagramIcon color={PINK} />
          <span style={{ fontSize: 18, fontWeight: 800, color: INK, letterSpacing: "-0.02em" }}>Идеи для Reels на сегодня</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, overflowX: "auto", WebkitOverflowScrolling: "touch", margin: "0 -18px", padding: "0 18px 4px", scrollbarWidth: "none" }}>
        {ideasLoading && !ideas
          ? [0, 1, 2].map((i) => <IdeaSkeleton key={i} visual={IDEA_VISUALS[i % IDEA_VISUALS.length]} />)
          : (ideas && ideas.length > 0 ? ideas : FALLBACK_IDEAS).map((idea, i) => (
              <IdeaCard key={i} idea={idea} visual={IDEA_VISUALS[i % IDEA_VISUALS.length]} onUse={() => useIdea(idea)} />
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
          <div style={{ height: 8, borderRadius: 4, background: "#262630", overflow: "hidden" }}>
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
    <div aria-label="LEX AI" style={{ display: "inline-flex", alignItems: "center", height, lineHeight: 1 }}>
      <div style={{ fontSize: height * 0.72, fontWeight: 800, letterSpacing: "0.06em" }}>
        <span style={{ color: INK }}>LEX </span>
        <span style={{ background: IG_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>AI</span>
      </div>
    </div>
  );
}

function Feature({ icon, accent: _accent, title, body }: { icon: React.ReactNode; accent: string; title: string; body: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "0 4px" }}>
      <div style={{ margin: "0 auto 10px", display: "flex", justifyContent: "center" }}>{icon}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: INK, lineHeight: 1.25, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.35 }}>{body}</div>
    </div>
  );
}

function IdeaSkeleton({ visual }: { visual: IdeaVisual }) {
  return (
    <div style={{ flexShrink: 0, width: 168, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 18, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 13, ...iconTile(visual.accent) }} />
        <span style={{ width: 50, height: 18, borderRadius: 999, background: SOFT }} />
      </div>
      <div style={{ height: 13, borderRadius: 5, background: SOFT, marginBottom: 7 }} />
      <div style={{ height: 13, width: "75%", borderRadius: 5, background: SOFT, marginBottom: 14 }} />
      <div style={{ height: 11, width: "45%", borderRadius: 5, background: SOFT, marginBottom: 16 }} />
      <div style={{ height: 38, borderRadius: 12, background: SOFT }} />
    </div>
  );
}

function IdeaCard({ idea, visual, onUse }: { idea: IdeaDef; visual: IdeaVisual; onUse: () => void }) {
  const icon =
    visual.icon === "target" ? <P.PremiumTargetIcon size={44} />
    : visual.icon === "flame" ? <P.PremiumFlameIcon size={44} />
    : <P.PremiumClockIcon size={44} />;
  return (
    <div style={{ flexShrink: 0, width: 168, display: "flex", flexDirection: "column", background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 18, padding: 14, boxShadow: "0 6px 20px rgba(20,20,40,0.04)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div>{icon}</div>
        <span style={{ fontSize: 9.5, fontWeight: 700, padding: "4px 8px", borderRadius: 999, background: `${visual.accent}22`, border: `1px solid ${visual.accent}33`, color: visual.tagColor, whiteSpace: "nowrap" }}>{visual.tag}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: INK, lineHeight: 1.3, marginBottom: 6 }}>{idea.title}</div>
      <div style={{ fontSize: 12, color: SUB_MUTED, marginBottom: 14 }}>{idea.category}</div>
      <div style={{ flex: 1 }} />
      <button
        onClick={onUse}
        style={{
          appearance: "none", width: "100%", padding: "11px 0", borderRadius: 12,
          border: `1px solid ${PINK}33`, background: `${PINK}1F`, color: "#F6B6D3",
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
      <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 9, background: SOFT, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED }}><TypeIcon type={draft.content_type} /></span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
      <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: sl.color }}>{sl.label}</span>
    </button>
  );
}

// ─── Стилизованные line-иконки (outline, currentColor) ───
type IconProps = { size?: number; color?: string };

function LinkIcon({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9 15l6-6M10.5 6.5l1.2-1.2a4 4 0 015.7 5.7l-1.2 1.2M13.5 17.5l-1.2 1.2a4 4 0 01-5.7-5.7l1.2-1.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VideoIcon({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="4.5" stroke={color} strokeWidth="1.7" />
      <path d="M3.5 8.5h17" stroke={color} strokeWidth="1.5" />
      <path d="M7.5 4.2l2 4.3M13 4.2l2 4.3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10.5 11.8l3.8 2.4-3.8 2.4v-4.8z" fill={color} />
    </svg>
  );
}

function WandIcon({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 20l9-9" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 2.5l1.1 2.9 2.9 1.1-2.9 1.1L16 10.5l-1.1-2.9L12 6.5l2.9-1.1L16 2.5z" fill={color} />
      <path d="M19.5 12.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5z" fill={color} />
    </svg>
  );
}

function TrendIcon({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 15l5-5 3 3 6-7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 6h4v4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TargetIcon({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="10.5" cy="13.5" r="7.5" stroke={color} strokeWidth="1.7" />
      <circle cx="10.5" cy="13.5" r="3.6" stroke={color} strokeWidth="1.7" />
      <circle cx="10.5" cy="13.5" r="0.9" fill={color} />
      <path d="M10.5 13.5L19.5 4.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M15.5 4.5h4v4" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FlameIcon({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12.5 2c.4 2.8 2.3 4.3 3.6 5.9C17.6 9.7 18.5 11.6 18.5 14a6.5 6.5 0 11-13 0c0-2.3 1.1-4 2.3-5.4.3 1.1.9 1.9 1.8 2.4C8.7 8 10 5.4 12.5 2z" fill={color} />
    </svg>
  );
}

function ClockIcon({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1.7" />
      <path d="M12 7.5V12l3 1.8" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BoltIcon({ size = 24 }: IconProps) {
  const id = "lex-bolt-grad";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ verticalAlign: "-0.16em" }}>
      <defs>
        <linearGradient id={id} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A24FD6" />
          <stop offset="0.5" stopColor="#E84B91" />
          <stop offset="1" stopColor="#F88A4A" />
        </linearGradient>
      </defs>
      <path d="M13 2L4.5 13.2c-.4.5 0 1.3.7 1.3H11l-1 7.5 8.5-11.2c.4-.5 0-1.3-.7-1.3H12l1-7.5z" fill={`url(#${id})`} />
    </svg>
  );
}

function TypeIcon({ type, size = 16, color = "currentColor" }: IconProps & { type: string }) {
  if (type === "reel") return <VideoIcon size={size} color={color} />;
  if (type === "carousel") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="7" y="5" width="12" height="14" rx="2.5" stroke={color} strokeWidth="1.7" />
      <path d="M4 8v9a2 2 0 002 2h8" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
  if (type === "idea") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9 17h6M10 20h4M12 3a6 6 0 014 10.5c-.6.6-1 1.2-1 2H9c0-.8-.4-1.4-1-2A6 6 0 0112 3z" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  // caption / post / прочее — текстовые строки
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="3" stroke={color} strokeWidth="1.7" />
      <path d="M8 9h8M8 13h8M8 17h5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CopyIcon({ size = 18, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="9" y="9" width="11" height="11" rx="2.5" stroke={color} strokeWidth="1.7" />
      <path d="M5 15V6.5A1.5 1.5 0 016.5 5H15" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function InstagramIcon({ size = 20, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke={color} strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" stroke={color} strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1.1" fill={color} />
    </svg>
  );
}

function SparkleIcon({ size = 18, color = "#FFFFFF" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" fill={color} />
      <path d="M18 14l.8 2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-1L18 14z" fill={color} />
    </svg>
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
          "max(calc(env(safe-area-inset-top) + 68px), 100px) 18px " +
          "max(calc(env(safe-area-inset-bottom) + 96px), 110px)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {children}
    </div>
  );
}
