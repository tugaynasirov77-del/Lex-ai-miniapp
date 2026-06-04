"use client";

import { useEffect, useState } from "react";
import { useFlow, useFlowActions } from "../../flow";
import { getProject, type ProjectDTO } from "../../lib/api";
import { hapticImpact, hapticSelection } from "../../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";

type Props = { onBack: () => void };
type Tab = "content" | "scout" | "settings";

const LEGACY_BASE = "/projects";

export default function ProjectScreen({ onBack }: Props) {
  const { state } = useFlow();
  const actions = useFlowActions();
  const projectId = state.projectId;

  const [project, setProject] = useState<ProjectDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("content");

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    (async () => {
      try {
        const r = await getProject(projectId);
        if (alive) setProject(r.project);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Не удалось загрузить");
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  if (!projectId) {
    // context lost — отправляем в dashboard
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

  const newContent = () => {
    hapticImpact("light");
    // projectId уже в FlowState — content-flow подхватит его.
    actions.resetContent();
    actions.navigate("choose-format");
  };

  return (
    <ScreenWrap>
      {/* Header */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
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
              {isIg ? "Instagram" : "Telegram"}
              {handle ? ` · ${handle}` : " · не подключено"}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
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

      {/* Body */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          marginTop: 14,
        }}
      >
        {tab === "content" && <ContentTab onNew={newContent} />}
        {tab === "scout" && <ScoutTab projectId={projectId} platform={project.platform} />}
        {tab === "settings" && (
          <SettingsTab projectId={projectId} platform={project.platform} />
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

// --- Tabs ---

function ContentTab({ onNew: _onNew }: { onNew: () => void }) {
  // Минимальный MVP: подсказка-empty state + CTA. Историю drafts покажем
  // через legacy-страницу в следующей итерации.
  return (
    <Card>
      <div style={{ fontSize: 28, marginBottom: 6 }}>📝</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
        Создавайте контент
      </div>
      <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
        Пост, карусель, Reel или недельный план — выберите формат, и команда
        AI соберёт черновик за 30 секунд.
      </p>
    </Card>
  );
}

function ScoutTab({
  projectId,
  platform,
}: {
  projectId: string;
  platform: "telegram" | "instagram";
}) {
  const isIg = platform === "instagram";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Card>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
          {isIg ? "Анализ конкурентов (Анна)" : "Разведка канала"}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
          {isIg
            ? "Список IG-конкурентов, отчёт Анны и недельный план Александра — в полной версии экрана проекта."
            : "Конкуренты, статистика канала и стратегия — в полной версии экрана проекта."}
        </p>
        <LegacyLink href={`${LEGACY_BASE}/${projectId}`} label="Открыть в полной версии →" />
      </Card>
    </div>
  );
}

function SettingsTab({
  projectId,
  platform,
}: {
  projectId: string;
  platform: "telegram" | "instagram";
}) {
  const isIg = platform === "instagram";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Card>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
          {isIg ? "Подключить Instagram" : "Подключить Telegram-канал"}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
          Без подключения нельзя публиковать. Привязка делается в полной
          версии экрана проекта.
        </p>
        <LegacyLink href={`${LEGACY_BASE}/${projectId}`} label="Открыть в полной версии →" />
      </Card>
      <Card>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
          Тариф и квоты
        </div>
        <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
          Управление подпиской и лимитами.
        </p>
        <LegacyLink href="/billing" label="Открыть биллинг →" />
      </Card>
    </div>
  );
}

// --- pieces ---

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
