"use client";

import { useState } from "react";
import { useFlow, useFlowActions } from "../../flow";
import {
  lexWritePost,
  lexWriteCarousel,
  lexWriteReel,
  approveDraft,
  ApiError,
  type LexPostVariant,
  type LexCarousel,
  type LexReelScript,
  type CarouselStyle,
} from "../../lib/api";
import { hapticImpact, hapticNotify } from "../../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.10)";

type Format = "post" | "carousel" | "reel";
type Phase = "form" | "loading" | "result" | "error";

const FORMAT_LABEL: Record<Format, string> = {
  post: "Пост",
  carousel: "Карусель",
  reel: "Reels",
};

const STYLE_OPTIONS: { key: CarouselStyle; label: string }[] = [
  { key: "minimal", label: "Минимализм" },
  { key: "pop", label: "Поп / яркий" },
  { key: "editorial", label: "Editorial" },
  { key: "ai_tech", label: "AI / tech" },
  { key: "business", label: "Бизнес" },
];

const DURATION_OPTIONS: { key: 15 | 30 | 60; label: string }[] = [
  { key: 15, label: "15 сек" },
  { key: 30, label: "30 сек" },
  { key: 60, label: "60 сек" },
];

type Props = { onBack: () => void };

export default function LexCreateScreen({ onBack }: Props) {
  const { state } = useFlow();
  const actions = useFlowActions();
  const projectId = state.projectId;

  const [format, setFormat] = useState<Format>("post");
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState<CarouselStyle>("minimal");
  const [duration, setDuration] = useState<15 | 30 | 60>(30);

  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [variants, setVariants] = useState<LexPostVariant[]>([]);
  const [carousel, setCarousel] = useState<LexCarousel | null>(null);
  const [reel, setReel] = useState<LexReelScript | null>(null);

  if (!projectId) {
    return (
      <Wrap>
        <h1 style={{ fontSize: 22, margin: 0 }}>Сначала выбери проект</h1>
        <button onClick={onBack} style={btnSecondary()}>Назад</button>
      </Wrap>
    );
  }

  async function submit() {
    if (!projectId || !topic.trim()) return;
    setPhase("loading");
    setError(null);
    hapticImpact("medium");
    try {
      if (format === "post") {
        const r = await lexWritePost(projectId, topic.trim());
        setDraftId(r.draftId);
        setVariants(r.variants);
      } else if (format === "carousel") {
        const r = await lexWriteCarousel(projectId, topic.trim(), style);
        setDraftId(r.draftId);
        setCarousel(r.carousel);
      } else {
        const r = await lexWriteReel(projectId, topic.trim(), duration);
        setDraftId(r.draftId);
        setReel(r.script);
      }
      setPhase("result");
      hapticNotify("success");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Что-то пошло не так";
      setError(msg);
      setPhase("error");
      hapticNotify("error");
    }
  }

  async function pickPostAndApprove(v: LexPostVariant) {
    if (!draftId) return;
    hapticImpact("medium");
    try {
      // обновляем body на выбранный вариант + апрувим в один шаг
      await fetch(`/api/drafts/${draftId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data":
            (window as any).Telegram?.WebApp?.initData || "",
        },
        body: JSON.stringify({ body: v.body, chosen_title: v.title }),
      });
      await approveDraft(draftId);
      hapticNotify("success");
      actions.navigate("project");
    } catch (e) {
      hapticNotify("error");
      setError(e instanceof Error ? e.message : "не получилось");
    }
  }

  function copy(text: string, label?: string) {
    navigator.clipboard?.writeText(text).then(
      () => hapticNotify("success"),
      () => hapticNotify("error")
    );
    if (label) {
      // лёгкая визуальная обратная связь через alert опускаем — Mini App в Telegram alert уродлив
    }
  }

  function resetToForm() {
    setPhase("form");
    setVariants([]);
    setCarousel(null);
    setReel(null);
    setDraftId(null);
    setError(null);
  }

  // ──────── RENDER ────────

  return (
    <Wrap>
      <Header onBack={onBack} title="LEX AI" subtitle="Создание контента" />

      {phase === "form" && (
        <>
          <FormatPicker value={format} onChange={setFormat} />
          <TopicInput value={topic} onChange={setTopic} format={format} />

          {format === "carousel" && (
            <StylePicker value={style} onChange={setStyle} />
          )}
          {format === "reel" && (
            <DurationPicker value={duration} onChange={setDuration} />
          )}

          <button
            onClick={submit}
            disabled={!topic.trim()}
            style={btnPrimary(!topic.trim())}
          >
            СОЗДАТЬ
          </button>
        </>
      )}

      {phase === "loading" && (
        <LoadingBlock format={format} />
      )}

      {phase === "error" && (
        <ErrorBlock message={error || ""} onRetry={resetToForm} />
      )}

      {phase === "result" && format === "post" && (
        <PostResult variants={variants} onPick={pickPostAndApprove} onNew={resetToForm} />
      )}
      {phase === "result" && format === "carousel" && carousel && (
        <CarouselResult carousel={carousel} onCopy={copy} onNew={resetToForm} />
      )}
      {phase === "result" && format === "reel" && reel && (
        <ReelResult script={reel} onCopy={copy} onNew={resetToForm} />
      )}
    </Wrap>
  );
}

// ──────── Pieces ────────

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding:
          "max(calc(env(safe-area-inset-top) + 56px), 88px) 18px " +
          "max(calc(env(safe-area-inset-bottom) + 28px), 40px)",
      }}
    >
      {children}
    </div>
  );
}

function Header({
  onBack,
  title,
  subtitle,
}: {
  onBack: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <button onClick={onBack} style={{ ...btnGhost(), padding: "4px 0", marginBottom: 8 }}>
        ← Назад
      </button>
      <h1 style={{ margin: 0, fontSize: 28, letterSpacing: "-0.02em", fontWeight: 800 }}>
        {title}
      </h1>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: MUTED }}>{subtitle}</p>
    </div>
  );
}

function FormatPicker({
  value,
  onChange,
}: {
  value: Format;
  onChange: (f: Format) => void;
}) {
  const options: Format[] = ["post", "carousel", "reel"];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {options.map((f) => {
        const active = f === value;
        return (
          <button
            key={f}
            onClick={() => onChange(f)}
            style={{
              flex: 1,
              padding: "12px 6px",
              borderRadius: 12,
              border: active
                ? `1.5px solid ${YELLOW}`
                : `1px solid ${CARD_BORDER}`,
              background: active ? `${YELLOW}14` : CARD_BG,
              color: INK,
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              cursor: "pointer",
            }}
          >
            {FORMAT_LABEL[f]}
          </button>
        );
      })}
    </div>
  );
}

function TopicInput({
  value,
  onChange,
  format,
}: {
  value: string;
  onChange: (s: string) => void;
  format: Format;
}) {
  const placeholder =
    format === "post"
      ? "Например: 5 ошибок начинающих маркетологов"
      : format === "carousel"
        ? "Например: как удержать клиента после первой покупки"
        : "Например: 3 секрета вирусного reels";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: MUTED, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        Тема
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 12,
          padding: 12,
          color: INK,
          fontSize: 14,
          fontFamily: "inherit",
          resize: "vertical",
          minHeight: 72,
        }}
      />
    </div>
  );
}

function StylePicker({
  value,
  onChange,
}: {
  value: CarouselStyle;
  onChange: (s: CarouselStyle) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: MUTED, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        Визуальный стиль
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {STYLE_OPTIONS.map((s) => {
          const active = s.key === value;
          return (
            <button
              key={s.key}
              onClick={() => onChange(s.key)}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: active
                  ? `1.5px solid ${YELLOW}`
                  : `1px solid ${CARD_BORDER}`,
                background: active ? `${YELLOW}14` : "transparent",
                color: INK,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DurationPicker({
  value,
  onChange,
}: {
  value: 15 | 30 | 60;
  onChange: (d: 15 | 30 | 60) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: MUTED, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        Длительность
      </label>
      <div style={{ display: "flex", gap: 6 }}>
        {DURATION_OPTIONS.map((d) => {
          const active = d.key === value;
          return (
            <button
              key={d.key}
              onClick={() => onChange(d.key)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 12,
                border: active
                  ? `1.5px solid ${YELLOW}`
                  : `1px solid ${CARD_BORDER}`,
                background: active ? `${YELLOW}14` : CARD_BG,
                color: INK,
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {d.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LoadingBlock({ format }: { format: Format }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 999,
          background: YELLOW,
          boxShadow: `0 0 60px ${YELLOW}55`,
          animation: "lex-pulse-soft 1.4s ease-in-out infinite",
        }}
      />
      <p style={{ margin: 0, fontSize: 14, color: MUTED }}>
        LEX AI пишет {format === "reel" ? "сценарий" : format === "carousel" ? "карусель" : "3 варианта"}…
      </p>
      <style>{`
        @keyframes lex-pulse-soft {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.18); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 40 }}>⚠️</div>
      <h2 style={{ margin: 0, fontSize: 20 }}>Не получилось</h2>
      <p style={{ margin: 0, fontSize: 13, color: MUTED, maxWidth: 280 }}>{message}</p>
      <button onClick={onRetry} style={btnPrimary(false)}>
        ПОПРОБОВАТЬ ЕЩЁ
      </button>
    </div>
  );
}

function PostResult({
  variants,
  onPick,
  onNew,
}: {
  variants: LexPostVariant[];
  onPick: (v: LexPostVariant) => void;
  onNew: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
        Тапни нужный вариант — опубликуем в канал через час.
      </p>
      {variants.map((v, i) => (
        <button
          key={i}
          onClick={() => onPick(v)}
          style={{
            textAlign: "left",
            padding: 14,
            borderRadius: 14,
            border: `1px solid ${CARD_BORDER}`,
            background: CARD_BG,
            color: INK,
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 6, letterSpacing: "0.06em" }}>
            ВАРИАНТ {i + 1}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{v.body}</div>
        </button>
      ))}
      <button onClick={onNew} style={btnSecondary()}>
        ← НОВАЯ ТЕМА
      </button>
    </div>
  );
}

function CarouselResult({
  carousel,
  onCopy,
  onNew,
}: {
  carousel: LexCarousel;
  onCopy: (text: string, label?: string) => void;
  onNew: () => void;
}) {
  const slidesText = carousel.slides
    .map((s) => `Слайд ${s.num}: ${s.text}`)
    .join("\n\n");
  const captionFull = `${carousel.caption}\n\n${carousel.hashtags.join(" ")}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <CopyBlock
        label="🎯 Тема + Hook"
        text={`${carousel.topic}\n\n${carousel.hook}`}
        onCopy={onCopy}
      />
      <CopyBlock
        label="🎨 Промпт для картинок (Midjourney/Sora/DALL-E)"
        text={carousel.image_prompt}
        onCopy={onCopy}
        mono
      />
      <CopyBlock label="📝 Тексты слайдов" text={slidesText} onCopy={onCopy} />
      <CopyBlock label="📲 Caption + хэштеги" text={captionFull} onCopy={onCopy} />
      <button onClick={onNew} style={btnSecondary()}>
        ← НОВАЯ ТЕМА
      </button>
    </div>
  );
}

function ReelResult({
  script,
  onCopy,
  onNew,
}: {
  script: LexReelScript;
  onCopy: (text: string, label?: string) => void;
  onNew: () => void;
}) {
  const scenesText = script.scenes
    .map(
      (s) =>
        `[${s.seconds}] ${s.action}${s.on_screen ? `\n   в кадре: ${s.on_screen}` : ""}`
    )
    .join("\n\n");
  const fullScript = `🎬 ${script.topic}\n\nHOOK: ${script.hook}\n\nРАСКАДРОВКА:\n${scenesText}\n\n🎵 ${script.music_hint}`;
  const captionFull = `${script.caption}\n\n${script.hashtags.join(" ")}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <CopyBlock label="🎬 Полный сценарий + раскадровка" text={fullScript} onCopy={onCopy} />
      <CopyBlock label="🎯 Только HOOK" text={script.hook} onCopy={onCopy} />
      <CopyBlock label="🎵 Подсказка по музыке" text={script.music_hint} onCopy={onCopy} />
      <CopyBlock label="📲 Caption + хэштеги" text={captionFull} onCopy={onCopy} />
      <button onClick={onNew} style={btnSecondary()}>
        ← НОВАЯ ТЕМА
      </button>
    </div>
  );
}

function CopyBlock({
  label,
  text,
  onCopy,
  mono,
}: {
  label: string;
  text: string;
  onCopy: (text: string, label?: string) => void;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: MUTED,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <button
          onClick={() => {
            onCopy(text, label);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          style={{
            background: copied ? YELLOW : "transparent",
            color: copied ? "#0A0608" : YELLOW,
            border: `1px solid ${YELLOW}`,
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            padding: "5px 10px",
            cursor: "pointer",
          }}
        >
          {copied ? "СКОПИРОВАНО ✓" : "КОПИРОВАТЬ"}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          fontSize: mono ? 11 : 13,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: mono ? "Menlo, monospace" : "inherit",
          color: "rgba(255,255,255,0.9)",
        }}
      >
        {text}
      </pre>
    </div>
  );
}

// ──────── Button styles ────────

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    minHeight: 52,
    padding: "16px 24px",
    border: "none",
    borderRadius: 999,
    background: disabled ? "rgba(255,255,255,0.12)" : YELLOW,
    color: disabled ? MUTED : "#0A0608",
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : `0 18px 40px ${YELLOW}33`,
    marginTop: 6,
  };
}

function btnSecondary(): React.CSSProperties {
  return {
    minHeight: 44,
    padding: "12px 18px",
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: 999,
    background: "transparent",
    color: INK,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.04em",
    cursor: "pointer",
    marginTop: 6,
  };
}

function btnGhost(): React.CSSProperties {
  return {
    background: "transparent",
    color: MUTED,
    border: "none",
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
  };
}
