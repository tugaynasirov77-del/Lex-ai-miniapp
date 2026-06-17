"use client";

import { useEffect, useState } from "react";
import { listReelDecodes, type ReelAnalysisDTO } from "../lib/api";
import { hapticImpact } from "../lib/telegram";

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
          <Section title={`🎯 Hook · ${item.analysis.hook.type}`}>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{item.analysis.hook.text}</p>
          </Section>
          <Section title="📐 Структура">
            {item.analysis.structure.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                <div
                  style={{
                    flexShrink: 0,
                    fontSize: 10,
                    color: YELLOW,
                    fontWeight: 700,
                    width: 56,
                    paddingTop: 2,
                  }}
                >
                  {fmtTime(s.start)}–{fmtTime(s.end)}
                </div>
                <div style={{ flex: 1, fontSize: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{s.label}</div>
                  <div style={{ color: MUTED, lineHeight: 1.4 }}>{s.text}</div>
                </div>
              </div>
            ))}
          </Section>
          <Section title="🔥 Почему сработало">
            {item.analysis.why_works.map((w, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.45, paddingLeft: 14, position: "relative", marginBottom: 4 }}>
                <span style={{ position: "absolute", left: 0, color: YELLOW }}>·</span>
                {w}
              </div>
            ))}
          </Section>
          <Section title="✨ Сценарий под твою нишу" highlight>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
              {item.analysis.adapt_to_brand}
            </p>
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

function Section({
  title,
  children,
  highlight,
}: {
  title: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        background: highlight
          ? `linear-gradient(135deg, rgba(245,231,10,0.08) 0%, rgba(245,231,10,0.02) 100%)`
          : "rgba(255,255,255,0.03)",
        border: highlight
          ? `1px solid rgba(245,231,10,0.30)`
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
          color: highlight ? YELLOW : MUTED,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function fmtTime(sec: number): string {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
