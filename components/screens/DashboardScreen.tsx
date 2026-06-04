"use client";

import { useEffect, useState } from "react";
import { useFlowActions } from "../../flow";
import { listProjects, type ProjectDTO } from "../../lib/api";
import { hapticImpact, hapticSelection } from "../../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";

type Props = { onBack: () => void };
type Filter = "all" | "telegram" | "instagram";

export default function DashboardScreen({ onBack: _onBack }: Props) {
  const actions = useFlowActions();
  const [data, setData] = useState<ProjectDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = async () => {
    setError(null);
    try {
      const r = await listProjects();
      setData(r.projects || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goCreate = () => {
    hapticImpact("light");
    actions.navigate("create-project");
  };

  const goProject = (id: string) => {
    hapticImpact("light");
    actions.setIds({ projectId: id });
    actions.navigate("project");
  };

  const filtered = (data || []).filter((p) =>
    filter === "all" ? true : p.platform === filter,
  );

  return (
    <ScreenWrap>
      <Header />

      {/* Filter tabs */}
      {data && data.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          {(["all", "telegram", "instagram"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                hapticSelection();
                setFilter(f);
              }}
              style={{
                appearance: "none",
                border: `1px solid ${filter === f ? YELLOW : CARD_BORDER}`,
                background: filter === f ? YELLOW : "transparent",
                color: filter === f ? "#0A0608" : INK,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: filter === f ? 700 : 500,
                padding: "8px 14px",
                borderRadius: 999,
                cursor: "pointer",
              }}
            >
              {f === "all" ? "Все" : f === "telegram" ? "Telegram" : "Instagram"}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div
        style={{
          marginTop: 18,
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {data === null && !error && <SkeletonList />}
        {error && (
          <ErrorBlock
            body={error}
            ctaLabel="ПОВТОРИТЬ"
            onCta={() => {
              setData(null);
              load();
            }}
          />
        )}
        {data && data.length === 0 && <EmptyState onCreate={goCreate} />}
        {data && data.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((p) => (
              <ProjectCard key={p.id} project={p} onPick={() => goProject(p.id)} />
            ))}
            {filtered.length === 0 && (
              <p style={{ color: MUTED, fontSize: 13, textAlign: "center", padding: 24 }}>
                В этом фильтре нет проектов.
              </p>
            )}
          </div>
        )}
      </div>

      {data && data.length > 0 && (
        <button onClick={goCreate} style={primaryBtn}>
          + НОВЫЙ ПРОЕКТ
        </button>
      )}
    </ScreenWrap>
  );
}

// --- pieces ---

function Header() {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: MUTED,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        Личный кабинет
      </div>
      <h1
        style={{
          margin: "10px 0 0",
          fontSize: 30,
          lineHeight: 1.02,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
        }}
      >
        Мои проекты
      </h1>
    </div>
  );
}

function ProjectCard({
  project,
  onPick,
}: {
  project: ProjectDTO;
  onPick: () => void;
}) {
  const isIg = project.platform === "instagram";
  const handle = isIg
    ? project.instagram_username
      ? `@${project.instagram_username}`
      : null
    : project.channel_username
      ? `@${project.channel_username}`
      : null;
  const followers = isIg ? project.instagram_followers : project.channel_subscribers;
  const isAuto = /^(Reel |План: |Карусель: |Пост: )/.test(project.title);

  return (
    <button
      onClick={onPick}
      style={{
        appearance: "none",
        textAlign: "left",
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 16,
        padding: 14,
        display: "flex",
        gap: 12,
        alignItems: "center",
        color: INK,
        fontFamily: "inherit",
        cursor: "pointer",
      }}
    >
      <PlatformIcon platform={project.platform} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            marginBottom: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {project.title}
          {isAuto && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 10,
                color: MUTED,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              авто
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: MUTED, display: "flex", gap: 8 }}>
          {handle ? <span>{handle}</span> : <span>Не подключено</span>}
          {typeof followers === "number" && followers > 0 && (
            <span>· {formatCount(followers)}</span>
          )}
        </div>
      </div>
      <div style={{ color: MUTED, fontSize: 18 }}>›</div>
    </button>
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
      }}
    >
      <span
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: tg ? "#28A0EB" : "#E1306C",
        }}
      >
        {tg ? "TG" : "IG"}
      </span>
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
            borderRadius: 16,
            padding: 14,
            height: 68,
            opacity: 0.5 - i * 0.1,
          }}
        />
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 14,
        padding: "20px 8px",
      }}
    >
      <div style={{ fontSize: 44 }}>🗂️</div>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>
        Создайте первый проект
      </h2>
      <p style={{ margin: 0, fontSize: 13, color: MUTED, maxWidth: 280, lineHeight: 1.45 }}>
        Проект — это Telegram-канал или Instagram-аккаунт, который мы ведём:
        пишем контент, следим за конкурентами, собираем недельный план.
      </p>
      <button onClick={onCreate} style={{ ...primaryBtn, marginTop: 10 }}>
        СОЗДАТЬ ПРОЕКТ
      </button>
    </div>
  );
}

function ErrorBlock({
  body,
  ctaLabel,
  onCta,
}: {
  body: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 14,
        padding: "40px 8px",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Не удалось загрузить</h2>
      <p style={{ margin: 0, fontSize: 13, color: MUTED, maxWidth: 280 }}>{body}</p>
      <button onClick={onCta} style={primaryBtn}>
        {ctaLabel}
      </button>
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

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const primaryBtn: React.CSSProperties = {
  width: "100%",
  minHeight: 56,
  marginTop: 14,
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
