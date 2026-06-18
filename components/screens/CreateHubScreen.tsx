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

// Куда ведёт карточка: вкладка проекта (projectInitialTab).
type HubCard = {
  icon: string;
  title: string;
  desc: string;
  tab: "overview" | "library";
  accent: string;
};

const CARDS: HubCard[] = [
  {
    icon: "🔍",
    title: "Разобрать Reels",
    desc: "Вставь ссылку, получи разбор + сценарий",
    tab: "overview",
    accent: "rgba(245,231,10,0.10)",
  },
  {
    icon: "✨",
    title: "Сценарий с нуля",
    desc: "Reels без референса, по твоей теме",
    tab: "overview",
    accent: "rgba(221,42,123,0.12)",
  },
  {
    icon: "🖼",
    title: "Карусель",
    desc: "Готовая карусель из 6 слайдов",
    tab: "overview",
    accent: "rgba(40,160,235,0.12)",
  },
  {
    icon: "✏️",
    title: "Подпись и хештеги",
    desc: "Цепляющая подпись под пост",
    tab: "overview",
    accent: "rgba(91,214,107,0.12)",
  },
  {
    icon: "💡",
    title: "Сохранённые идеи",
    desc: "Открыть библиотеку материалов",
    tab: "library",
    accent: "rgba(245,133,41,0.12)",
  },
];

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

  // Активный проект: текущий из flow, иначе первый IG-проект.
  const activeId = state.projectId || projects[0]?.id || null;

  const open = (tab: HubCard["tab"]) => {
    hapticImpact("medium");
    if (!activeId) {
      // Нет проекта — сначала создаём.
      actions.navigate("create-project");
      return;
    }
    actions.setIds({ projectId: activeId });
    actions.setScreenMeta("projectInitialTab", tab);
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

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
        {CARDS.map((c) => (
          <button
            key={c.title}
            onClick={() => open(c.tab)}
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

      {!activeId && (
        <p style={{ margin: "18px 0 0", fontSize: 12, color: SUB_MUTED, textAlign: "center", lineHeight: 1.5 }}>
          Сначала создадим Instagram-проект — выбери любой инструмент, и LEX
          предложит его собрать.
        </p>
      )}
    </div>
  );
}
