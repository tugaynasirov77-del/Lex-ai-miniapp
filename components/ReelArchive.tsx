"use client";

import { useEffect, useState } from "react";
import { listReelDecodes, type ReelAnalysisDTO } from "../lib/api";
import { hapticImpact, hapticNotify } from "../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const SUB_MUTED = "rgba(255,255,255,0.42)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.10)";

type ArchiveItem = {
  id: string;
  shortcode: string;
  author_username: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  duration_sec: number;
  analysis: ReelAnalysisDTO;
  created_at: string;
};

type Props = { projectId: string; refreshKey?: number };

export default function ReelArchive({ projectId, refreshKey = 0 }: Props) {
  const [items, setItems] = useState<ArchiveItem[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listReelDecodes(projectId)
      .then((r) => {
        if (alive) setItems((r.items as any) || []);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [projectId, refreshKey]);

  if (items === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="shimmer"
            style={{
              height: 72,
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 14,
              position: "relative",
              overflow: "hidden",
              opacity: 0.5 - i * 0.1,
            }}
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 14,
          color: MUTED,
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        Здесь будут все твои разборы Reels.<br />
        Кинь ссылку в поле выше — и появится первый.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontSize: 11,
          color: MUTED,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          fontWeight: 700,
          marginBottom: 4,
          paddingLeft: 4,
        }}
      >
        Архив разборов · {items.length}
      </div>
      {items.map((it) => (
        <ArchiveCard
          key={it.id}
          item={it}
          open={openId === it.id}
          onToggle={() => {
            hapticImpact("light");
            setOpenId(openId === it.id ? null : it.id);
          }}
        />
      ))}
    </div>
  );
}

function ArchiveCard({
  item,
  open,
  onToggle,
}: {
  item: ArchiveItem;
  open: boolean;
  onToggle: () => void;
}) {
  const fmtCount = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}K`
      : String(n);
  const d = new Date(item.created_at);
  const dateStr = d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${open ? "rgba(245,231,10,0.30)" : CARD_BORDER}`,
        borderRadius: 14,
        overflow: "hidden",
        transition: "border-color 200ms",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          color: INK,
          fontFamily: "inherit",
          padding: 14,
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            @{item.author_username || "автор"}
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 11, color: MUTED }}>
            <span>👁 {fmtCount(item.view_count)}</span>
            <span>❤ {fmtCount(item.like_count)}</span>
            <span>💬 {fmtCount(item.comment_count)}</span>
            <span style={{ marginLeft: "auto", color: SUB_MUTED }}>{dateStr}</span>
          </div>
        </div>
        <div style={{ color: MUTED, fontSize: 14, lineHeight: 1, transition: "transform 200ms", transform: open ? "rotate(90deg)" : "none" }}>›</div>
      </button>

      {open && (
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Hook как цитата */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(221,42,123,0.10) 0%, rgba(221,42,123,0.03) 100%)",
              border: "1px solid rgba(221,42,123,0.30)",
              borderRadius: 14,
              padding: 12,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#F58AC0", marginBottom: 8 }}>
              🎯 Hook · {item.analysis.hook.type}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div
                style={{
                  flexShrink: 0,
                  width: 3,
                  background: "linear-gradient(180deg, #F58529 0%, #DD2A7B 100%)",
                  borderRadius: 3,
                }}
              />
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>
                «{item.analysis.hook.verbatim_quote || item.analysis.hook.text}»
              </p>
            </div>
          </div>

          {/* Storyboard или structure */}
          {item.analysis.storyboard && item.analysis.storyboard.length > 0 ? (
            <Section title="🎬 Раскадровка" accent="cyan">
              {item.analysis.storyboard.map((s) => (
                <div key={s.scene} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                  <div style={{ flexShrink: 0, width: 52, paddingTop: 2 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#7AC8FF" }}>Сцена {s.scene}</div>
                    <div style={{ fontSize: 10, color: SUB_MUTED }}>{fmtTime(s.start)}–{fmtTime(s.end)}</div>
                  </div>
                  <div style={{ flex: 1, fontSize: 12, lineHeight: 1.4 }}>
                    {s.what_in_frame && (
                      <div>
                        <span style={{ color: "#7AC8FF", fontWeight: 700 }}>📷 </span>
                        {s.what_in_frame}
                      </div>
                    )}
                    {s.what_said && (
                      <div style={{ marginTop: 2 }}>
                        <span style={{ color: "#7AC8FF", fontWeight: 700 }}>🗣 </span>
                        <span style={{ fontStyle: "italic" }}>«{s.what_said}»</span>
                      </div>
                    )}
                    {s.effect && (
                      <div style={{ marginTop: 2, color: MUTED }}>{s.effect}</div>
                    )}
                  </div>
                </div>
              ))}
            </Section>
          ) : (
            <Section title="📐 Структура" accent="cyan">
              {item.analysis.structure.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                  <div style={{ flexShrink: 0, fontSize: 10, color: "#7AC8FF", fontWeight: 700, width: 56, paddingTop: 2 }}>
                    {fmtTime(s.start)}–{fmtTime(s.end)}
                  </div>
                  <div style={{ flex: 1, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{s.label}</div>
                    <div style={{ color: MUTED, lineHeight: 1.4 }}>{s.text}</div>
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* Triggers */}
          {item.analysis.engagement_triggers && item.analysis.engagement_triggers.length > 0 && (
            <Section title="🧲 Психологические триггеры" accent="orange">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {item.analysis.engagement_triggers.map((t, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "4px 9px",
                      borderRadius: 999,
                      background: "rgba(240,160,48,0.10)",
                      border: "1px solid rgba(240,160,48,0.35)",
                      fontSize: 11,
                      color: "#FFC480",
                      fontWeight: 600,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Section>
          )}

          <Section title="🔥 Почему сработало" accent="orange">
            {item.analysis.why_works.map((w, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.45, paddingLeft: 14, position: "relative", marginBottom: 4 }}>
                <span style={{ position: "absolute", left: 0, color: "#FFC480" }}>·</span>
                {w}
              </div>
            ))}
          </Section>

          {item.analysis.takeaways && item.analysis.takeaways.length > 0 && (
            <Section title="🎯 Что забрать" accent="green">
              {item.analysis.takeaways.map((t, i) => (
                <div key={i} style={{ fontSize: 12, lineHeight: 1.45, paddingLeft: 20, position: "relative", marginBottom: 6 }}>
                  <span style={{ position: "absolute", left: 0, color: "#5BD66B", fontWeight: 800 }}>{i + 1}.</span>
                  {t}
                </div>
              ))}
            </Section>
          )}

          {item.analysis.shoot_yourself && item.analysis.shoot_yourself.length > 0 && (
            <Section title="🎬 Как снять такой же" accent="cyan">
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                {item.analysis.shoot_yourself.map((s, i) => (
                  <li key={i} style={{ fontSize: 12, lineHeight: 1.45, marginBottom: 4 }}>
                    {s.replace(/^\d+\.\s*/, "")}
                  </li>
                ))}
              </ol>
            </Section>
          )}

          <Section title="✨ Сценарий под твою нишу" highlight>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
              {item.analysis.adapt_to_brand}
            </p>
            <CopyButton text={item.analysis.adapt_to_brand} />
          </Section>

          {item.analysis.cta && (
            <Section title="📣 CTA в оригинале">
              <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.45 }}>{item.analysis.cta}</p>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

type Accent = "yellow" | "cyan" | "orange" | "green" | "pink";

const ACCENT: Record<Accent, { bg: string; border: string; title: string }> = {
  yellow: { bg: "rgba(245,231,10,0.08)", border: "rgba(245,231,10,0.30)", title: YELLOW },
  cyan: { bg: "rgba(122,200,255,0.06)", border: "rgba(122,200,255,0.28)", title: "#7AC8FF" },
  orange: { bg: "rgba(240,160,48,0.06)", border: "rgba(240,160,48,0.28)", title: "#FFC480" },
  green: { bg: "rgba(91,214,107,0.06)", border: "rgba(91,214,107,0.28)", title: "#5BD66B" },
  pink: { bg: "rgba(221,42,123,0.08)", border: "rgba(221,42,123,0.28)", title: "#F58AC0" },
};

function Section({
  title,
  children,
  highlight,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  highlight?: boolean;
  accent?: Accent;
}) {
  const palette = accent ? ACCENT[accent] : null;
  const isHighlight = highlight || accent === "yellow";
  return (
    <div
      style={{
        background: isHighlight
          ? `linear-gradient(135deg, rgba(245,231,10,0.08) 0%, rgba(245,231,10,0.02) 100%)`
          : palette
          ? palette.bg
          : "rgba(255,255,255,0.03)",
        border: isHighlight
          ? `1px solid rgba(245,231,10,0.30)`
          : palette
          ? `1px solid ${palette.border}`
          : `1px solid rgba(255,255,255,0.06)`,
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: isHighlight ? YELLOW : palette ? palette.title : MUTED,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            hapticNotify("success");
            setDone(true);
            setTimeout(() => setDone(false), 1800);
          },
          () => hapticNotify("error"),
        );
      }}
      style={{
        marginTop: 10,
        width: "100%",
        padding: "10px 14px",
        border: "none",
        borderRadius: 12,
        background: done ? "rgba(91,214,107,0.18)" : "rgba(245,231,10,0.16)",
        color: done ? "#5BD66B" : YELLOW,
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      {done ? "✓ Скопировано" : "📋 Скопировать сценарий"}
    </button>
  );
}

function fmtTime(sec: number): string {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
