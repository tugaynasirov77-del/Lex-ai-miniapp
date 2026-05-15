"use client";

import { useEffect, useState } from "react";
import LiveActivityAmber from "./LiveActivityAmber";
import AtomLogo from "./AtomLogo";
import { loadRecent, formatAgo, type RecentTaskEntry } from "../lib/recentTasks";
import { hapticImpact, hapticSelection } from "../lib/telegram";

const TAG_PREFIX: Record<string, string> = {
  "написать": "Напиши пост для канала про ",
  "анализ": "Проанализируй конкурентов в нише ",
  "код": "Напиши код для ",
  "стратегия": "Составь стратегию для ",
};

// ─── Данные ─────────────────────────────────────────────────────────────────

const QUICK_TAGS = ["написать", "анализ", "код", "стратегия"];

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="#0A0705" strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

// ─── Главный компонент ───────────────────────────────────────────────────────

export default function HomeScreen() {
  const [task, setTask]         = useState("");
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<RecentTaskEntry[]>([]);

  useEffect(() => {
    setRecent(loadRecent());
  }, [activeTask]);

  // Прогрев кэша LEX_TEAM_RULES на mount, не чаще чем раз в 5 минут.
  // Делает первый реальный запрос юзера дешевле в ~10 раз на input-токенах.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const last = Number(localStorage.getItem("lex_cache_warmup_at") || 0);
      if (Date.now() - last < 5 * 60 * 1000) return; // ещё свежий
      localStorage.setItem("lex_cache_warmup_at", String(Date.now()));
    } catch {}
    fetch("/api/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "warmup" }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  const [activeTag, setActiveTag] = useState<string | null>(null);

  const handleTagClick = (tag: string) => {
    hapticSelection();
    setActiveTag(tag);
    setTask(TAG_PREFIX[tag] ?? (tag + " "));
  };

  const handleSubmit = () => {
    const t = task.trim();
    if (!t || busy) return;
    hapticImpact("medium");
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
          <AtomLogo size={26} uid="hs" />
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

          {recent.length === 0 ? (
            <p style={{ ...styles.recentMeta, marginTop: 4 }}>пока пусто — отправь первую задачу</p>
          ) : (
            recent.map(item => (
              <div
                key={item.id}
                style={styles.recentItem}
                onClick={() => setTask(item.title)}
              >
                <div style={styles.recentDot} />
                <div style={styles.recentText}>
                  <p style={styles.recentTitle}>{item.title}</p>
                  <p style={styles.recentMeta}>{item.agentName} · {formatAgo(item.createdAt)}</p>
                </div>
                <span style={styles.recentArrow}>›</span>
              </div>
            ))
          )}
        </section>
      )}

    </div>
  );
}

// ─── Стили ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  shell: {
    width: "100%",
    position: "relative",
    fontFamily: "'DM Sans', -apple-system, sans-serif",
    display: "flex",
    flexDirection: "column",
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
    fontSize: 16,
    color: "#F1E3C4",
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
    color: "rgba(255,255,255,0.4)",
  },

  hero: {
    padding: "72px 22px 28px",
    position: "relative",
    zIndex: 2,
  },

  h1: {
    fontWeight: 200,
    fontSize: 30,
    color: "#F8F0DC",
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
    fontSize: 15,
    color: "rgba(255,255,255,0.45)",
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
    fontSize: 16,
    color: "#EDDCB4",
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
    fontWeight: 400,
    fontSize: 14,
    letterSpacing: "0.03em",
    background: "rgba(240,140,40,0.08)",
    border: "1px solid rgba(240,140,40,0.28)",
    color: "rgba(245,200,120,0.95)",
    transition: "transform 0.15s cubic-bezier(0.16,1,0.3,1)",
  },

  tagActive: {},

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
    fontSize: 13,
    letterSpacing: "0.1em",
    color: "rgba(255,255,255,0.45)",
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

  recentText: { flex: 1, minWidth: 0, overflow: "hidden" },

  recentTitle: {
    fontWeight: 500,
    fontSize: 16,
    color: "#F5EBD7",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    letterSpacing: "-0.1px",
  },

  recentMeta: {
    fontWeight: 400,
    fontSize: 13,
    color: "rgba(255,190,80,0.95)",
    marginTop: 3,
  },

  recentArrow: {
    fontSize: 14,
    color: "rgba(255,255,255,0.1)",
  },

};
