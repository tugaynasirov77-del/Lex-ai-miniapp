"use client";

import { useState } from "react";
import { decodeReel, type ReelDecodeDTO, type ReelQuotaDTO } from "../lib/api";
import { hapticImpact, hapticNotify } from "../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const SUB_MUTED = "rgba(255,255,255,0.42)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.10)";

type Props = {
  projectId: string;
  onDecoded?: () => void;
};

export default function ReelDecoderCard({ projectId, onDecoded }: Props) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [decode, setDecode] = useState<ReelDecodeDTO | null>(null);
  const [quota, setQuota] = useState<ReelQuotaDTO | null>(null);
  const [cached, setCached] = useState(false);

  async function run() {
    if (!url.trim() || busy) return;
    setBusy(true);
    setErr(null);
    setDecode(null);
    hapticImpact("medium");
    try {
      const r = await decodeReel(projectId, url.trim());
      setDecode(r.decode);
      setCached(r.cached);
      if (r.quota) setQuota(r.quota);
      hapticNotify("success");
      onDecoded?.();
    } catch (e: any) {
      hapticNotify("error");
      const msg = e?.message || "не удалось разобрать";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        background: `linear-gradient(135deg, rgba(245,231,10,0.10) 0%, rgba(245,231,10,0.02) 60%, rgba(255,255,255,0.02) 100%)`,
        border: `1px solid rgba(245,231,10,0.35)`,
        borderRadius: 20,
        padding: 18,
        marginBottom: 14,
        boxShadow: `0 18px 44px rgba(245,231,10,0.10)`,
      }}
    >
      {/* Hero */}
      <div
        style={{
          fontSize: 10,
          color: YELLOW,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 800,
        }}
      >
        Новое в IG
      </div>
      <h2
        style={{
          margin: "8px 0 6px",
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        Разбери любой Reels за минуту
      </h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
        Кидай ссылку — LEX разложит хук, структуру, таймкоды и метрики. Плюс готовый
        сценарий под твою нишу.
      </p>

      {/* Input + button */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (err) setErr(null);
          }}
          placeholder="https://www.instagram.com/reel/..."
          style={{
            appearance: "none",
            width: "100%",
            padding: "12px 14px",
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 12,
            color: INK,
            fontFamily: "inherit",
            fontSize: 14,
            outline: "none",
          }}
          disabled={busy}
        />
        <button
          onClick={run}
          disabled={busy || !url.trim()}
          style={{
            appearance: "none",
            width: "100%",
            padding: "14px 0",
            border: "none",
            borderRadius: 999,
            background: `linear-gradient(135deg, #FFF382 0%, ${YELLOW} 50%, #E5C500 100%)`,
            color: "#0A0608",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontFamily: "inherit",
            cursor: busy || !url.trim() ? "wait" : "pointer",
            opacity: busy || !url.trim() ? 0.55 : 1,
            boxShadow:
              busy || !url.trim()
                ? "none"
                : `0 14px 32px rgba(245,231,10,0.40), 0 0 0 1px rgba(255,255,255,0.16) inset`,
          }}
        >
          {busy ? "Разбираю…" : "🔍 Разобрать Reels"}
        </button>
      </div>

      {/* Quota */}
      {quota && (
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: SUB_MUTED,
            textAlign: "center",
          }}
        >
          Осталось разборов: {Math.max(0, quota.limit - quota.used)}/{quota.limit} · тариф {quota.tier.toUpperCase()}
        </div>
      )}

      {/* Loading state */}
      {busy && (
        <div style={{ marginTop: 14, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
          📥 Скачиваю видео из Instagram…<br />
          🎙 Транскрибирую речь…<br />
          🧠 Анализирую структуру…
        </div>
      )}

      {/* Error */}
      {err && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 10,
            background: "rgba(255,115,115,0.08)",
            border: "1px solid rgba(255,115,115,0.30)",
            fontSize: 12,
            color: "#FF8B8B",
          }}
        >
          {err}
        </div>
      )}

      {/* Result */}
      {decode && (
        <ResultBlock decode={decode} cached={cached} />
      )}
    </div>
  );
}

// ───────────── Result ─────────────

function ResultBlock({ decode, cached }: { decode: ReelDecodeDTO; cached: boolean }) {
  const m = decode.metadata;
  const a = decode.analysis;
  const fmtCount = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}K`
      : String(n);

  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      {cached && (
        <div style={{ fontSize: 10, color: SUB_MUTED, textAlign: "center" }}>
          📦 из кэша — этот ролик уже разбирали недавно
        </div>
      )}

      {/* Metrics */}
      <div
        style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 14,
          padding: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>
            @{m.author_username || "автор"}
          </span>
          <span style={{ fontSize: 11, color: SUB_MUTED }}>
            {Math.round(m.duration_sec)} сек
          </span>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
          <Stat label="Просмотры" value={fmtCount(m.view_count)} />
          <Stat label="Лайки" value={fmtCount(m.like_count)} />
          <Stat label="Коммент." value={fmtCount(m.comment_count)} />
        </div>
      </div>

      {/* Hook */}
      <Section title={`🎯 Hook · ${a.hook.type}`}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{a.hook.text}</p>
        <div style={{ marginTop: 6, fontSize: 11, color: SUB_MUTED }}>
          Первые {a.hook.seconds} сек
        </div>
      </Section>

      {/* Structure */}
      <Section title="📐 Структура">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {a.structure.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 10 }}>
              <div
                style={{
                  flexShrink: 0,
                  fontSize: 10,
                  color: YELLOW,
                  fontWeight: 700,
                  width: 50,
                  paddingTop: 2,
                }}
              >
                {fmtTime(s.start)}–{fmtTime(s.end)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.45 }}>{s.text}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Why works */}
      <Section title="🔥 Почему это сработало">
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {a.why_works.map((w, i) => (
            <li key={i} style={{ fontSize: 13, lineHeight: 1.45, paddingLeft: 14, position: "relative" }}>
              <span style={{ position: "absolute", left: 0, color: YELLOW }}>·</span>
              {w}
            </li>
          ))}
        </ul>
      </Section>

      {/* Adapt to brand */}
      <Section title="✨ Сценарий под твою нишу" highlight>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
          {a.adapt_to_brand}
        </p>
        <CopyButton text={a.adapt_to_brand} />
      </Section>

      {/* CTA */}
      {a.cta && (
        <Section title="📣 CTA в оригинале">
          <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.45 }}>{a.cta}</p>
        </Section>
      )}

      {/* Transcript collapsed */}
      <TranscriptToggle transcript={decode.transcript} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 16, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 10, color: SUB_MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
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
          : CARD_BG,
        border: highlight
          ? `1px solid rgba(245,231,10,0.30)`
          : `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: highlight ? YELLOW : MUTED,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function TranscriptToggle({ transcript }: { transcript: string }) {
  const [open, setOpen] = useState(false);
  if (!transcript) return null;
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          color: MUTED,
          fontSize: 11,
          padding: "8px 0",
          cursor: "pointer",
          fontFamily: "inherit",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {open ? "▲ скрыть транскрипт" : "▼ показать транскрипт"}
      </button>
      {open && (
        <div
          style={{
            fontSize: 12,
            color: MUTED,
            lineHeight: 1.55,
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 12,
            padding: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {transcript}
        </div>
      )}
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
