"use client";

import { useState } from "react";
import {
  generateCaptions,
  type CaptionGenResultDTO,
  type CaptionQuotaDTO,
  type CaptionVariantDTO,
} from "../lib/api";
import { hapticImpact, hapticNotify } from "../lib/telegram";
import PaywallSheet from "./PaywallSheet";
import ProLock, { useIsFree } from "./ProLock";

const YELLOW = "#E84B91";
const PINK = "#E84B91";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const SUB_MUTED = "rgba(255,255,255,0.42)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.10)";

type Props = { projectId: string };

export default function CaptionGeneratorCard({ projectId }: Props) {
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<CaptionGenResultDTO | null>(null);
  const [quota, setQuota] = useState<CaptionQuotaDTO | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const isFree = useIsFree();

  async function run() {
    if (topic.trim().length < 5 || busy) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    hapticImpact("medium");
    try {
      const r = await generateCaptions(projectId, topic.trim());
      setResult(r.result);
      setQuota(r.quota);
      setActiveIdx(0);
      hapticNotify("success");
    } catch (e: any) {
      hapticNotify("error");
      if (e?.status === 402) {
        setPaywallOpen(true);
        return;
      }
      setErr(e?.message || "Не получилось сгенерировать");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 20,
        padding: 18,
        marginTop: 18,
        overflow: "hidden",
        background:
          "radial-gradient(circle 200px at 0% 0%, rgba(122,200,255,0.18), transparent 60%)," +
          "radial-gradient(circle 220px at 100% 100%, rgba(232,75,145,0.14), transparent 60%)," +
          "linear-gradient(135deg, #16101C 0%, #0B0911 100%)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 18px 44px rgba(232,75,145,0.10)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#F58AC0",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 800,
        }}
      >
        AI · Подписи и хештеги
      </div>
      <h2
        style={{
          margin: "8px 0 6px",
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
        }}
      >
        Подпись под Reels за 10 секунд
      </h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
        Опиши идею Reels — получи 5 готовых подписей в разных стилях и 15 хештегов под нишу.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
            if (err) setErr(null);
          }}
          placeholder="Например: показываю 3 ошибки которые убивают первый день в зале"
          rows={3}
          maxLength={800}
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
            resize: "vertical",
            minHeight: 70,
          }}
          disabled={busy}
        />
        <button
          onClick={run}
          disabled={busy || topic.trim().length < 5}
          style={{
            appearance: "none",
            width: "100%",
            padding: "13px 0",
            border: "none",
            borderRadius: 999,
            background:
              busy || topic.trim().length < 5
                ? "rgba(255,255,255,0.08)"
                : "linear-gradient(135deg, #A24FD6 0%, #E84B91 50%, #F88A4A 100%)",
            color: busy || topic.trim().length < 5 ? MUTED : "#FFFFFF",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontFamily: "inherit",
            cursor: busy || topic.trim().length < 5 ? "not-allowed" : "pointer",
            boxShadow:
              busy || topic.trim().length < 5
                ? "none"
                : "0 12px 28px rgba(232,75,145,0.30), 0 0 0 1px rgba(255,255,255,0.16) inset",
          }}
        >
          {busy ? "Пишу подписи…" : "Сгенерировать"}
        </button>
      </div>

      {quota && (
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: SUB_MUTED,
            textAlign: "center",
          }}
        >
          Осталось подписей: {Math.max(0, quota.limit - quota.used)}/{quota.limit} · тариф {quota.tier.toUpperCase()}
        </div>
      )}

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

      {result && (
        <ResultBlock
          result={result}
          activeIdx={activeIdx}
          setActiveIdx={setActiveIdx}
          isFree={isFree}
          onUnlock={() => { hapticImpact("medium"); setPaywallOpen(true); }}
        />
      )}

      {paywallOpen && (
        <PaywallSheet variant="pro_feature" onClose={() => setPaywallOpen(false)} />
      )}
    </div>
  );
}

function ResultBlock({
  result,
  activeIdx,
  setActiveIdx,
  isFree,
  onUnlock,
}: {
  result: CaptionGenResultDTO;
  activeIdx: number;
  setActiveIdx: (i: number) => void;
  isFree?: boolean;
  onUnlock?: () => void;
}) {
  const active = result.variants[activeIdx];
  // Free: первый стиль открыт, остальные заблюрены под Pro (FOMO).
  const activeLocked = !!isFree && activeIdx > 0;
  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
        {result.variants.map((v, i) => {
          const lockedTab = !!isFree && i > 0;
          return (
            <button
              key={v.style}
              onClick={() => {
                hapticImpact("light");
                setActiveIdx(i);
              }}
              style={{
                appearance: "none",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "7px 12px",
                borderRadius: 999,
                border: `1px solid ${i === activeIdx ? PINK : CARD_BORDER}`,
                background:
                  i === activeIdx ? "rgba(232,75,145,0.14)" : "rgba(255,255,255,0.04)",
                color: i === activeIdx ? "#F58AC0" : MUTED,
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: i === activeIdx ? 800 : 600,
                letterSpacing: "0.02em",
                cursor: "pointer",
              }}
            >
              {lockedTab && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M7 10V8a5 5 0 0110 0v2M5 10h14v9a1 1 0 01-1 1H6a1 1 0 01-1-1v-9z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
              )}
              {v.style_label}
            </button>
          );
        })}
      </div>

      {active && (
        <ProLock
          locked={activeLocked}
          title="Этот стиль — в Pro"
          subtitle="Открой все стили подписей и хэштег-паки. Один стиль доступен бесплатно."
          cta="Открыть все стили"
          onUnlock={onUnlock}
          maxHeight={220}
        >
          <CaptionPanel variant={active} />
        </ProLock>
      )}

      {result.hashtags.length > 0 && <HashtagBlock hashtags={result.hashtags} />}
    </div>
  );
}

function CaptionPanel({ variant }: { variant: CaptionVariantDTO }) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#F58AC0",
          fontWeight: 800,
          marginBottom: 8,
        }}
      >
        {variant.style_label}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          color: INK,
        }}
      >
        {variant.text}
      </p>
      <CopyButton text={variant.text} label="Скопировать подпись" />
    </div>
  );
}

function HashtagBlock({ hashtags }: { hashtags: string[] }) {
  const tagText = hashtags.map((h) => `#${h}`).join(" ");
  return (
    <div
      style={{
        background: "rgba(122,200,255,0.06)",
        border: "1px solid rgba(122,200,255,0.22)",
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#7AC8FF",
          fontWeight: 800,
          marginBottom: 8,
        }}
      >
        # Хештеги · {hashtags.length}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {hashtags.map((h) => (
          <span
            key={h}
            style={{
              padding: "4px 9px",
              borderRadius: 999,
              background: "rgba(122,200,255,0.10)",
              border: "1px solid rgba(122,200,255,0.28)",
              fontSize: 11,
              color: "#7AC8FF",
              fontWeight: 600,
            }}
          >
            #{h}
          </span>
        ))}
      </div>
      <CopyButton text={tagText} label="Скопировать все" accent="cyan" />
    </div>
  );
}

function CopyButton({
  text,
  label,
  accent = "green",
}: {
  text: string;
  label: string;
  accent?: "green" | "cyan";
}) {
  const [done, setDone] = useState(false);
  const color = accent === "cyan" ? "#7AC8FF" : "#5BD66B";
  const bg =
    accent === "cyan" ? "rgba(122,200,255,0.16)" : "rgba(91,214,107,0.16)";
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
        marginTop: 12,
        width: "100%",
        padding: "10px 14px",
        border: "none",
        borderRadius: 12,
        background: done ? "rgba(91,214,107,0.20)" : bg,
        color: done ? "#5BD66B" : color,
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      {done ? "✓ Скопировано" : label}
    </button>
  );
}
