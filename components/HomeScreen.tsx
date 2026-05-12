"use client";

import { useEffect, useState } from "react";
import LiveActivityAmber from "./LiveActivityAmber";

const TAG_PREFIX: Record<string, string> = {
  "написать": "Напиши пост для канала про ",
  "анализ": "Проанализируй конкурентов в нише ",
  "код": "Напиши код для ",
  "стратегия": "Составь стратегию для ",
};

// ─── Типы ───────────────────────────────────────────────────────────────────

interface RecentTask {
  id: string;
  title: string;
  agent: string;
  time: string;
}

// ─── Данные ─────────────────────────────────────────────────────────────────

const QUICK_TAGS = ["написать", "анализ", "код", "стратегия"];

const RECENT_TASKS: RecentTask[] = [
  { id: "1", title: "3 поста для канала вайбкодинг", agent: "Алина", time: "10 мин" },
  { id: "2", title: "Контент-стратегия на Q2 2026",  agent: "Милена", time: "1 ч"    },
  { id: "3", title: "Telegram бот для записи",        agent: "Михаил", time: "3 ч"   },
];

const NAV_ITEMS = [
  { id: "home",     label: "главная", icon: HomeIcon     },
  { id: "team",     label: "команда", icon: UsersIcon    },
  { id: "projects", label: "проекты", icon: FoldersIcon  },
  { id: "history",  label: "история", icon: ClockIcon    },
];

// ─── Иконки (inline SVG, без зависимостей) ──────────────────────────────────

function HomeIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={active ? "url(#navGrad)" : "currentColor"}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id="navGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F0A020" />
          <stop offset="100%" stopColor="#D05020" />
        </linearGradient>
      </defs>
      <path d="M3 9.5L12 3L21 9.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function UsersIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={active ? "#F0A020" : "currentColor"}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
      <path d="M16 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.87" />
    </svg>
  );
}

function FoldersIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={active ? "#F0A020" : "currentColor"}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

function ClockIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={active ? "#F0A020" : "currentColor"}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="#0A0705" strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

// ─── Логотип-сигил ───────────────────────────────────────────────────────────

function Sigil() {
  return (
    <svg width="24" height="24" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sigilGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F0A020" />
          <stop offset="100%" stopColor="#C04020" />
        </linearGradient>
      </defs>
      <polygon
        points="15,3 27,10 27,20 15,27 3,20 3,10"
        fill="none" stroke="rgba(220,120,40,0.18)" strokeWidth="1"
      />
      <polygon
        points="15,7 23,12 23,18 15,23 7,18 7,12"
        fill="rgba(220,100,30,0.07)" stroke="rgba(220,100,30,0.30)" strokeWidth="0.8"
      />
      <circle cx="15" cy="15" r="2.3" fill="url(#sigilGrad)" />
    </svg>
  );
}

// ─── Главный компонент ───────────────────────────────────────────────────────

export default function HomeScreen() {
  const [task, setTask]         = useState("");
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const initialH = vv.height;
    const onResize = () => {
      // keyboard considered open if viewport shrunk by 150px+
      setKbOpen(initialH - vv.height > 150);
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);
  const [activeNav, setActiveNav] = useState("home");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const handleTagClick = (tag: string) => {
    setActiveTag(tag);
    setTask(TAG_PREFIX[tag] ?? (tag + " "));
  };

  const handleSubmit = () => {
    const t = task.trim();
    if (!t || busy) return;
    setActiveTask(t);
    setTask("");
    setActiveTag(null);
  };

  const handleReset = () => {
    setActiveTask(null);
    setBusy(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={styles.shell}>
      {/* Фоновый градиент-меш */}
      <div style={styles.mesh} />

      {/* ── Хедер ── */}
      <header style={styles.header}>
        <div style={styles.logoRow}>
          <Sigil />
          <span style={styles.wordmark}>LEX AI</span>
        </div>
        <div style={styles.avatar}>Д</div>
      </header>

      {/* ── Герой ── */}
      <section style={styles.hero}>
        <h1 style={styles.h1}>
          Что решаем{" "}
          <span style={styles.gradText}>сегодня?</span>
        </h1>
        <p style={styles.sub}>— 8 агентов в сети</p>
      </section>

      {/* ── Инпут ── */}
      <div style={styles.inputWrap}>
        <textarea
          style={styles.textarea}
          value={task}
          onChange={e => setTask(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Опиши задачу команде..."
          rows={3}
          disabled={busy}
        />
        <button
          style={{
            ...styles.sendBtn,
            opacity: task.trim() && !busy ? 1 : 0.5,
          }}
          onClick={handleSubmit}
          disabled={busy}
          aria-label="Отправить"
        >
          <SendIcon />
        </button>
      </div>

      {/* ── Быстрые теги ── */}
      <div style={styles.tagsRow}>
        {QUICK_TAGS.map(tag => (
          <button
            key={tag}
            style={{
              ...styles.tag,
              ...(activeTag === tag ? styles.tagActive : {}),
            }}
            onClick={() => handleTagClick(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* ── Разделитель ── */}
      <div style={styles.divider} />

      {/* ── Live Activity / Недавние ── */}
      {activeTask ? (
        <LiveActivityAmber task={activeTask} onReset={handleReset} onBusy={setBusy} />
      ) : (
        <section style={styles.recent}>
          <p style={styles.recentLabel}>// недавние</p>

          {RECENT_TASKS.map(item => (
            <div key={item.id} style={styles.recentItem}>
              <div style={styles.recentDot} />
              <div style={styles.recentText}>
                <p style={styles.recentTitle}>{item.title}</p>
                <p style={styles.recentMeta}>{item.agent} · {item.time}</p>
              </div>
              <span style={styles.recentArrow}>›</span>
            </div>
          ))}
        </section>
      )}

      {/* ── Навигация ── */}
      {!kbOpen && (
        <nav style={styles.nav}>
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isOn = activeNav === id;
            return (
              <button
                key={id}
                style={styles.navItem}
                onClick={() => setActiveNav(id)}
                aria-label={label}
              >
                <Icon active={isOn} />
                <span style={{ ...styles.navLabel, ...(isOn ? styles.navLabelActive : {}) }}>
                  {label}
                </span>
                {isOn && <div style={styles.navPip} />}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

// ─── Стили ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  shell: {
    width: "100%",
    maxWidth: 390,
    minHeight: "100dvh",
    margin: "0 auto",
    background: "#0A0705",
    position: "relative",
    fontFamily: "'DM Sans', -apple-system, sans-serif",
    display: "flex",
    flexDirection: "column",
    paddingBottom: "calc(env(safe-area-inset-bottom) + 78px)",
  },

  mesh: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background: `
      radial-gradient(ellipse 300px 220px at 50% -10px, rgba(240,155,35,0.14) 0%, transparent 62%),
      radial-gradient(ellipse 180px 130px at 90% 90%, rgba(195,65,25,0.07) 0%, transparent 55%)
    `,
    zIndex: 0,
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "calc(env(safe-area-inset-top) + 96px) 22px 0",
    position: "relative",
    zIndex: 2,
  },

  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  wordmark: {
    fontWeight: 300,
    fontSize: 14,
    color: "rgba(240,232,218,0.78)",
    letterSpacing: "0.26em",
  },

  avatar: {
    width: 27,
    height: 27,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 300,
    color: "rgba(255,255,255,0.2)",
  },

  hero: {
    padding: "72px 22px 28px",
    position: "relative",
    zIndex: 2,
  },

  h1: {
    fontWeight: 200,
    fontSize: 28,
    color: "rgba(240,232,218,0.92)",
    lineHeight: 1.2,
    marginBottom: 10,
    whiteSpace: "nowrap",
    letterSpacing: "-0.4px",
  },

  // Градиент на тексте — через background-clip
  gradText: {
    background: "linear-gradient(135deg, #F0A020 0%, #E06020 55%, #C04020 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    fontWeight: 300,
  },

  sub: {
    fontWeight: 300,
    fontSize: 13,
    color: "rgba(255,255,255,0.22)",
    letterSpacing: "0.04em",
  },

  inputWrap: {
    padding: "0 22px",
    position: "relative",
    zIndex: 2,
    marginBottom: 14,
  },

  textarea: {
    width: "100%",
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: "16px 60px 16px 18px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 300,
    fontSize: 14,
    color: "rgba(240,228,208,0.7)",
    caretColor: "#F0A020",
    resize: "none",
    outline: "none",
    lineHeight: 1.5,
    boxSizing: "border-box",
  },

  sendBtn: {
    position: "absolute",
    right: 32,
    top: "50%",
    transform: "translateY(-50%)",
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    background: "linear-gradient(135deg, #F0A020, #D05020)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "opacity 0.2s, transform 0.15s",
    boxShadow: "0 4px 14px rgba(208,80,32,0.35)",
    padding: 0,
  },

  tagsRow: {
    padding: "0 22px",
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
    position: "relative",
    zIndex: 2,
    marginBottom: 28,
  },

  tag: {
    padding: "7px 14px",
    borderRadius: 7,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 300,
    fontSize: 12,
    letterSpacing: "0.03em",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.4)",
    transition: "border-color 0.15s, color 0.15s",
  },

  tagActive: {
    borderColor: "rgba(240,130,30,0.35)",
    color: "rgba(240,160,40,0.8)",
    background: "rgba(240,130,30,0.07)",
  },

  divider: {
    height: 1,
    background: "rgba(255,255,255,0.04)",
    margin: "0 22px 18px",
    position: "relative",
    zIndex: 2,
  },

  recent: {
    padding: "0 22px",
    position: "relative",
    zIndex: 2,
    flex: 1,
  },

  recentLabel: {
    fontWeight: 300,
    fontSize: 11,
    letterSpacing: "0.1em",
    color: "rgba(255,255,255,0.22)",
    marginBottom: 12,
  },

  recentItem: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: "10px 0",
    borderBottom: "1px solid rgba(255,255,255,0.03)",
    cursor: "pointer",
  },

  recentDot: {
    width: 5,
    height: 5,
    borderRadius: "50%",
    flexShrink: 0,
    background: "linear-gradient(135deg, #F0A020, #D05020)",
    opacity: 0.6,
  },

  recentText: { flex: 1 },

  recentTitle: {
    fontWeight: 400,
    fontSize: 14,
    color: "rgba(244,234,218,0.92)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    letterSpacing: "-0.1px",
  },

  recentMeta: {
    fontWeight: 300,
    fontSize: 11,
    color: "rgba(240,160,40,0.55)",
    marginTop: 3,
  },

  recentArrow: {
    fontSize: 12,
    color: "rgba(255,255,255,0.1)",
  },

  nav: {
    position: "fixed",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: 0,
    width: "100%",
    maxWidth: 390,
    display: "flex",
    justifyContent: "space-around",
    padding: "13px 0 max(20px, env(safe-area-inset-bottom))",
    borderTop: "1px solid rgba(255,255,255,0.05)",
    zIndex: 50,
    background: "rgba(10,7,5,0.85)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
  },

  navItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    cursor: "pointer",
    background: "none",
    border: "none",
    padding: "0 8px",
    color: "rgba(255,255,255,0.12)",
  },

  navLabel: {
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 300,
    fontSize: 10,
    letterSpacing: "0.04em",
    color: "rgba(255,255,255,0.25)",
  },

  navLabelActive: {
    background: "linear-gradient(135deg, #F0A020, #D05020)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },

  navPip: {
    width: 14,
    height: 2,
    borderRadius: 1,
    background: "linear-gradient(90deg, #F0A020, #D05020)",
  },
};
