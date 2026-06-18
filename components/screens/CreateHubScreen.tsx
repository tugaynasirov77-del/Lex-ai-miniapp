"use client";

import { useEffect, useState } from "react";
import { useFlow, useFlowActions } from "../../flow";
import { peekProjects, listProjects, type ProjectDTO } from "../../lib/api";
import { hapticImpact } from "../../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const SUB_MUTED = "rgba(255,255,255,0.42)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.10)";

/** Идентификатор инструмента на экране /tools. */
export type ToolId =
  | "decoder"
  | "script"
  | "carousel"
  | "caption"
  | "pack";

type HubCard =
  | { kind: "tool"; tool: ToolId; icon: string; title: string; desc: string; accent: string }
  | { kind: "library"; icon: string; title: string; desc: string; accent: string };

const CARDS: HubCard[] = [
  {
    kind: "tool",
    tool: "decoder",
    icon: "🔍",
    title: "Разобрать Reels",
    desc: "Вставь ссылку — LEX разложит хук, структуру и сценарий",
    accent: "rgba(245,231,10,0.10)",
  },
  {
    kind: "tool",
    tool: "script",
    icon: "✨",
    title: "Сценарий с нуля",
    desc: "Reels без референса — задай тему, получишь сценарий",
    accent: "rgba(221,42,123,0.12)",
  },
  {
    kind: "tool",
    tool: "carousel",
    icon: "🖼",
    title: "Карусель",
    desc: "Готовая карусель из 6 слайдов под твою нишу",
    accent: "rgba(40,160,235,0.12)",
  },
  {
    kind: "tool",
    tool: "caption",
    icon: "✏️",
    title: "Подпись и хештеги",
    desc: "5 вариантов подписи + 15 релевантных хештегов",
    accent: "rgba(91,214,107,0.12)",
  },
  {
    kind: "tool",
    tool: "pack",
    icon: "📦",
    title: "Контент-пакет",
    desc: "Одна идея → Reels-сценарий + карусель + подпись",
    accent: "rgba(245,133,41,0.14)",
  },
  {
    kind: "library",
    icon: "💡",
    title: "Сохранённые идеи",
    desc: "Открыть библиотеку материалов проекта",
    accent: "rgba(122,200,255,0.10)",
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
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>
        Создать
      </h1>
      <p style={{ margin: "6px 0 0", fontSize: 14, color: MUTED }}>
        Выбери, что собираем сегодня
      </p>
      {active && (
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: SUB_MUTED,
            letterSpacing: "0.04em",
          }}
        >
          Проект: <span style={{ color: INK, fontWeight: 600 }}>{active.title}</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
        {CARDS.map((c) => (
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
              borderRadius: 16,
              border: `1px solid ${CARD_BORDER}`,
              background: `linear-gradient(135deg, ${c.accent} 0%, ${CARD_BG} 70%)`,
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
                fontSize: 24,
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${CARD_BORDER}`,
              }}
            >
              {c.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}>{c.title}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 1.35 }}>
                {c.desc}
              </div>
            </div>
            <span style={{ color: SUB_MUTED, fontSize: 18, flexShrink: 0 }}>›</span>
          </button>
        ))}
      </div>

      {!active && (
        <p style={{ margin: "18px 0 0", fontSize: 12, color: SUB_MUTED, textAlign: "center", lineHeight: 1.5 }}>
          Сначала создадим Instagram-проект — выбери любой инструмент, и LEX
          предложит его собрать.
        </p>
      )}

      <style>{`
        ${YELLOW ? "" : ""}
      `}</style>
    </div>
  );
}
