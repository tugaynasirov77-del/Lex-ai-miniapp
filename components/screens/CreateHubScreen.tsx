"use client";

import { useEffect, useState } from "react";
import { useFlow, useFlowActions } from "../../flow";
import { peekProjects, listProjects, type ProjectDTO } from "../../lib/api";
import { hapticImpact } from "../../lib/telegram";

// ─── Тёмная тема (единая с HomeScreen) ───
const BG = "#0B0B11";
const INK = "#F4F4F8";
const MUTED = "#9A9AAB";
const SUB_MUTED = "#6B6B7B";
const CARD_BG = "#15151E";
const CARD_BORDER = "#262630";
const SOFT = "#1C1C26";

// Акценты иконок
const ACC_PURPLE = "#A24FD6";
const ACC_PINK = "#E84B91";
const ACC_BLUE = "#4FA8E8";
const ACC_GREEN = "#4FD489";
const ACC_ORANGE = "#F0944E";
const ACC_CYAN = "#7AC8FF";

function iconTile(hex: string): React.CSSProperties {
  return {
    background: `linear-gradient(150deg, ${hex}30, ${hex}12)`,
    border: `1px solid ${hex}3D`,
    boxShadow: `0 6px 16px ${hex}24, inset 0 1px 0 ${hex}22`,
  };
}

/** Идентификатор инструмента на экране /tools. */
export type ToolId =
  | "decoder"
  | "script"
  | "carousel"
  | "caption"
  | "pack";

type IconProps = { size?: number; color?: string };

type HubCard =
  | { kind: "tool"; tool: ToolId; Icon: (p: IconProps) => React.ReactElement; iconColor: string; accent: string; title: string; desc: string }
  | { kind: "library"; Icon: (p: IconProps) => React.ReactElement; iconColor: string; accent: string; title: string; desc: string };

const CARDS: HubCard[] = [
  {
    kind: "tool",
    tool: "decoder",
    Icon: SearchIcon,
    iconColor: "#C78BEB",
    accent: ACC_PURPLE,
    title: "Разобрать Reels",
    desc: "Вставь ссылку — LEX разложит хук, структуру и сценарий",
  },
  {
    kind: "tool",
    tool: "script",
    Icon: SparkleIcon,
    iconColor: "#F3A9CE",
    accent: ACC_PINK,
    title: "Сценарий с нуля",
    desc: "Reels без референса — задай тему, получишь сценарий",
  },
  {
    kind: "tool",
    tool: "carousel",
    Icon: CarouselIcon,
    iconColor: "#8FC9F5",
    accent: ACC_BLUE,
    title: "Карусель",
    desc: "Готовая карусель из 6 слайдов под твою нишу",
  },
  {
    kind: "tool",
    tool: "caption",
    Icon: PenIcon,
    iconColor: "#86E0AC",
    accent: ACC_GREEN,
    title: "Подпись и хештеги",
    desc: "5 вариантов подписи + 15 релевантных хештегов",
  },
  {
    kind: "tool",
    tool: "pack",
    Icon: PackIcon,
    iconColor: "#F5B988",
    accent: ACC_ORANGE,
    title: "Контент-пакет",
    desc: "Одна идея → Reels-сценарий + карусель + подпись",
  },
  {
    kind: "library",
    Icon: BulbIcon,
    iconColor: "#A9D8FF",
    accent: ACC_CYAN,
    title: "Сохранённые идеи",
    desc: "Открыть библиотеку материалов проекта",
  },
];

/** Выбираем «активный» IG-проект: state.projectId, иначе самый недавний по updated_at. */
function pickActiveProject(stateProjectId: string | null, projects: ProjectDTO[]): ProjectDTO | null {
  if (stateProjectId) {
    const p = projects.find((x) => x.id === stateProjectId);
    if (p) return p;
  }
  if (projects.length === 0) return null;
  const sorted = [...projects].sort((a, b) => {
    const at = new Date(a.updated_at || a.created_at || 0).getTime();
    const bt = new Date(b.updated_at || b.created_at || 0).getTime();
    return bt - at;
  });
  return sorted[0];
}

export default function CreateHubScreen() {
  const { state } = useFlow();
  const actions = useFlowActions();

  const [projects, setProjects] = useState<ProjectDTO[]>(
    () => peekProjects()?.projects.filter((p) => p.platform === "instagram") ?? [],
  );

  useEffect(() => {
    let alive = true;
    listProjects()
      .then((r) => {
        if (alive) setProjects(r.projects.filter((p) => p.platform === "instagram"));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const active = pickActiveProject(state.projectId, projects);

  const openTool = (tool: ToolId) => {
    hapticImpact("medium");
    if (!active) {
      actions.navigate("create-project");
      return;
    }
    actions.setIds({ projectId: active.id });
    actions.setScreenMeta("toolTab", tool);
    actions.navigate("tools");
  };

  const openLibrary = () => {
    hapticImpact("medium");
    if (!active) {
      actions.navigate("create-project");
      return;
    }
    actions.setIds({ projectId: active.id });
    actions.setScreenMeta("projectInitialTab", "library");
    actions.navigate("project");
  };

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
      {/* Шапка: заголовок + проект-чип справа */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6, minHeight: 36 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>
          Создать
        </h1>
        {active && (
          <div
            style={{
              flexShrink: 0, background: SOFT, border: `1px solid ${CARD_BORDER}`,
              borderRadius: 999, padding: "7px 13px", fontSize: 12.5, fontWeight: 600,
              color: INK, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {active.title}
          </div>
        )}
      </div>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: MUTED }}>
        Выбери, что собираем сегодня
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {CARDS.map((c) => {
          const Icon = c.Icon;
          return (
            <button
              key={c.title}
              onClick={() => (c.kind === "tool" ? openTool(c.tool) : openLibrary())}
              style={{
                appearance: "none",
                textAlign: "left",
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: 16,
                borderRadius: 18,
                border: `1px solid ${CARD_BORDER}`,
                background: CARD_BG,
                color: INK,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  flexShrink: 0,
                  borderRadius: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ...iconTile(c.accent),
                }}
              >
                <Icon color={c.iconColor} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}>{c.title}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 1.35 }}>
                  {c.desc}
                </div>
              </div>
              <span style={{ color: SUB_MUTED, fontSize: 18, flexShrink: 0 }}>›</span>
            </button>
          );
        })}
      </div>

      {!active && (
        <p style={{ margin: "18px 0 0", fontSize: 12, color: SUB_MUTED, textAlign: "center", lineHeight: 1.5 }}>
          Сначала создадим Instagram-проект — выбери любой инструмент, и LEX
          предложит его собрать.
        </p>
      )}
    </div>
  );
}

// ─── Line-иконки (outline, consistent stroke) ───

function SearchIcon({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke={color} strokeWidth="1.8" />
      <path d="M16.5 16.5L21 21" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SparkleIcon({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3l1.7 4.7L18.5 9.5l-4.8 1.8L12 16l-1.7-4.7L5.5 9.5l4.8-1.8L12 3z" fill={color} />
      <path d="M18.5 14.5l.7 1.9 1.8.7-1.8.7-.7 1.9-.7-1.9-1.8-.7 1.8-.7.7-1.9z" fill={color} />
    </svg>
  );
}

function CarouselIcon({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="8" y="5" width="11" height="14" rx="2.5" stroke={color} strokeWidth="1.8" />
      <path d="M5 8v9a2 2 0 002 2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PenIcon({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 19l1-4L16 5l3 3L9 18l-4 1z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 7l3 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PackIcon({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M4 7.5l8 4.5 8-4.5M12 12v9" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function BulbIcon({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9 17h6M10 20h4M12 3a6 6 0 014 10.5c-.6.6-1 1.2-1 2H9c0-.8-.4-1.4-1-2A6 6 0 0112 3z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
