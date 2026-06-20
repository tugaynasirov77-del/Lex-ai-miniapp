"use client";

import { useEffect, useRef, useState } from "react";
import {
  generateContentPack,
  type ContentPackReel,
  type ContentPackCarousel,
  type ContentPackCaption,
} from "../lib/api";
import { hapticImpact, hapticNotify } from "../lib/telegram";
import StateBlock from "./StateBlock";
import PaywallSheet from "./PaywallSheet";

const YELLOW = "#E84B91";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const CARD_BORDER = "rgba(255,255,255,0.10)";

type Props = { projectId: string };

type Pack = {
  reel: ContentPackReel;
  carousel: ContentPackCarousel;
  caption: ContentPackCaption;
};

const LOADER_STEPS = [
  "Пишу сценарий Reels…",
  "Собираю карусель…",
  "Подбираю подпись…",
];

export default function ContentPackCard({ projectId }: Props) {
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pack, setPack] = useState<Pack | null>(null);
  const [step, setStep] = useState(0);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (stepTimer.current) clearInterval(stepTimer.current);
    };
  }, []);

  async function run() {
    if (topic.trim().length < 5 || busy) return;
    setBusy(true);
    setErr(null);
    setPack(null);
    setStep(0);
    hapticImpact("medium");
    // Прокручиваем этапы лоадера, пока ждём ответ.
    stepTimer.current = setInterval(() => {
      setStep((s) => (s < LOADER_STEPS.length - 1 ? s + 1 : s));
    }, 2500);
    try {
      const r = await generateContentPack(projectId, topic.trim());
      setPack(r.pack);
      hapticNotify("success");
    } catch (e: any) {
      hapticNotify("error");
      if (e?.status === 402) {
        setPaywallOpen(true);
        if (stepTimer.current) clearInterval(stepTimer.current);
        return;
      }
      setErr(e?.message || "Не получилось собрать пакет");
    } finally {
      if (stepTimer.current) clearInterval(stepTimer.current);
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
          "radial-gradient(circle 200px at 0% 0%, rgba(232,75,145,0.16), transparent 60%)," +
          "radial-gradient(circle 220px at 100% 100%, rgba(221,42,123,0.16), transparent 60%)," +
          "linear-gradient(135deg, #16110A 0%, #0A0808 100%)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 18px 44px rgba(232,75,145,0.08)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: YELLOW,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 800,
        }}
      >
        AI · Контент-пакет
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
        Одна идея — несколько форматов
      </h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
        Опиши идею — LEX соберёт связанный набор: сценарий Reels, карусель и
        подпись. Всё сохранится в проект как один пакет.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
            if (err) setErr(null);
          }}
          placeholder="Например: 3 ошибки новичков в зале, из-за которых нет прогресса"
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
            padding: "14px 0",
            border: "none",
            borderRadius: 999,
            background: `linear-gradient(135deg, #A24FD6 0%, #E84B91 50%, #F88A4A 100%)`,
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontFamily: "inherit",
            cursor: busy || topic.trim().length < 5 ? "wait" : "pointer",
            opacity: busy || topic.trim().length < 5 ? 0.55 : 1,
            boxShadow:
              busy || topic.trim().length < 5
                ? "none"
                : `0 14px 32px rgba(232,75,145,0.40), 0 0 0 1px rgba(255,255,255,0.16) inset`,
          }}
        >
          {busy ? "Собираю пакет…" : "Собрать контент-пакет"}
        </button>
      </div>

      {/* Loader со этапами */}
      {busy && (
        <div style={{ marginTop: 14, fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
          {LOADER_STEPS.map((s, i) => (
            <div key={i} style={{ opacity: i <= step ? 1 : 0.35, color: i === step ? INK : MUTED }}>
              {i < step ? "✓" : i === step ? "•" : "·"} {s.replace(/^[^ ]+ /, "")}
            </div>
          ))}
        </div>
      )}

      {/* Ошибка */}
      {err && (
        <div style={{ marginTop: 12 }}>
          <StateBlock
            tone="error"
            compact
            emoji="⚠️"
            title="Не удалось собрать пакет"
            body={err.length < 120 ? err : "LEX не смог собрать пакет по этой идее. Попробуй ещё раз."}
            action={{ label: "Попробовать снова", onClick: run }}
          />
        </div>
      )}

      {/* Результат */}
      {pack && <PackResult pack={pack} />}

      {paywallOpen && (
        <PaywallSheet variant="limit_reached" onClose={() => setPaywallOpen(false)} />
      )}
    </div>
  );
}

function PackResult({ pack }: { pack: Pack }) {
  const reelText = [
    `${pack.reel.title}`,
    `HOOK: ${pack.reel.hook}`,
    "",
    "ОЗВУЧКА:",
    pack.reel.voice_over,
    "",
    "РАСКАДРОВКА:",
    ...pack.reel.storyboard.map((s) => `[${s.seconds}] ${s.action}`),
    "",
    `CTA: ${pack.reel.cta}`,
  ].join("\n");

  const carouselText = [
    `${pack.carousel.topic}`,
    "",
    ...pack.carousel.slides.map((s) => `Слайд ${s.num}: ${s.text}`),
    "",
    `Подпись: ${pack.carousel.caption}`,
    pack.carousel.hashtags.join(" "),
  ].join("\n");

  const captionText = [pack.caption.text, pack.caption.hashtags.join(" ")]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: "#5BD66B",
          fontWeight: 700,
        }}
      >
        ✓ Сохранено в проект — 3 материала в одном пакете
      </div>

      <PackSection
        type="reel"
        label="Reels — сценарий"
        accent="rgba(221,42,123,0.28)"
        preview={`${pack.reel.hook}\n\n${pack.reel.voice_over}`}
        copyText={reelText}
      />
      <PackSection
        type="carousel"
        label={`Карусель — ${pack.carousel.slides.length} слайдов`}
        accent="rgba(40,160,235,0.28)"
        preview={pack.carousel.slides.map((s) => `${s.num}. ${s.text}`).join("\n")}
        copyText={carouselText}
      />
      <PackSection
        type="caption"
        label="Подпись и хештеги"
        accent="rgba(91,214,107,0.28)"
        preview={captionText}
        copyText={captionText}
      />
    </div>
  );
}

function PackSection({
  type,
  label,
  accent,
  preview,
  copyText,
}: {
  type: string;
  label: string;
  accent: string;
  preview: string;
  copyText: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${accent}`,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ display: "inline-flex", color: INK }}><PackTypeIcon type={type} size={16} /></span>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: INK }}>
          {label}
        </span>
      </div>
      <p
        style={{
          margin: "0 0 10px",
          fontSize: 13,
          color: "rgba(255,255,255,0.85)",
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 5,
          WebkitBoxOrient: "vertical",
        }}
      >
        {preview || "—"}
      </p>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(copyText).then(
            () => {
              hapticNotify("success");
              setDone(true);
              setTimeout(() => setDone(false), 1800);
            },
            () => hapticNotify("error"),
          );
        }}
        style={{
          appearance: "none",
          width: "100%",
          padding: "9px 14px",
          border: "none",
          borderRadius: 10,
          background: done ? "rgba(91,214,107,0.18)" : "rgba(232,75,145,0.14)",
          color: done ? "#5BD66B" : YELLOW,
          fontFamily: "inherit",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        {done ? "✓ Скопировано" : "Скопировать"}
      </button>
    </div>
  );
}


type _IconProps = { size?: number; color?: string };
function PackTypeIcon({ type, size = 16, color = "currentColor" }: _IconProps & { type: string }) {
  if (type === "reel")
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="4.5" stroke={color} strokeWidth="1.7" /><path d="M3.5 8.5h17" stroke={color} strokeWidth="1.5" /><path d="M10.5 11.8l3.8 2.4-3.8 2.4v-4.8z" fill={color} /></svg>);
  if (type === "carousel")
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="7" y="5" width="12" height="14" rx="2.5" stroke={color} strokeWidth="1.7" /><path d="M4 8v9a2 2 0 002 2h8" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></svg>);
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M5 19l1-4L16 5l3 3L9 18l-4 1z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" /><path d="M14 7l3 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" /></svg>);
}
