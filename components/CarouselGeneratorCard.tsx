"use client";

import { useState } from "react";
import { lexWriteCarousel, type CarouselStyle, type LexCarousel } from "../lib/api";
import { hapticImpact, hapticNotify } from "../lib/telegram";
import PaywallSheet from "./PaywallSheet";
import ProLock, { useIsFree } from "./ProLock";

const FREE_SLIDES = 3;

const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const SUB_MUTED = "rgba(255,255,255,0.42)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const PINK = "#DD2A7B";

type Props = { projectId: string };

const STYLES: { key: CarouselStyle; label: string }[] = [
  { key: "minimal", label: "Минимал" },
  { key: "pop", label: "Поп" },
  { key: "editorial", label: "Редакторский" },
  { key: "ai_tech", label: "AI/Tech" },
  { key: "business", label: "Бизнес" },
];

export default function CarouselGeneratorCard({ projectId }: Props) {
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState<CarouselStyle>("minimal");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [carousel, setCarousel] = useState<LexCarousel | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const isFree = useIsFree();

  async function run() {
    if (topic.trim().length < 5 || busy) return;
    setBusy(true);
    setErr(null);
    setCarousel(null);
    hapticImpact("medium");
    try {
      const r = await lexWriteCarousel(projectId, topic.trim(), style);
      setCarousel(r.carousel);
      setSlideIdx(0);
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
          "radial-gradient(circle 200px at 100% 0%, rgba(245,133,41,0.20), transparent 60%)," +
          "radial-gradient(circle 220px at 0% 100%, rgba(129,52,175,0.20), transparent 60%)," +
          "linear-gradient(135deg, #160B14 0%, #0A0608 100%)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 18px 44px rgba(221,42,123,0.14)",
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
        AI · Карусели
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
        Карусель из 6 слайдов за минуту
      </h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
        Опиши тему — получи готовую структуру слайдов, текст и подпись для публикации.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
            if (err) setErr(null);
          }}
          placeholder="Например: 5 ошибок начинающих в SMM"
          rows={2}
          maxLength={400}
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
            minHeight: 60,
          }}
          disabled={busy}
        />

        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {STYLES.map((s) => (
            <button
              key={s.key}
              onClick={() => {
                hapticImpact("light");
                setStyle(s.key);
              }}
              disabled={busy}
              style={{
                appearance: "none",
                flexShrink: 0,
                padding: "7px 12px",
                borderRadius: 999,
                border: `1px solid ${style === s.key ? PINK : CARD_BORDER}`,
                background:
                  style === s.key ? "rgba(221,42,123,0.16)" : "rgba(255,255,255,0.04)",
                color: style === s.key ? "#F58AC0" : MUTED,
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: style === s.key ? 800 : 600,
                letterSpacing: "0.02em",
                cursor: busy ? "wait" : "pointer",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

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
                : "linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)",
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
                : "0 12px 28px rgba(221,42,123,0.36), 0 0 0 1px rgba(255,255,255,0.16) inset",
          }}
        >
          {busy ? "Собираю карусель…" : "Собрать карусель"}
        </button>
      </div>

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

      {carousel && (
        <CarouselResult
          carousel={carousel}
          slideIdx={slideIdx}
          setSlideIdx={setSlideIdx}
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

function CarouselResult({
  carousel,
  slideIdx,
  setSlideIdx,
  isFree,
  onUnlock,
}: {
  carousel: LexCarousel;
  slideIdx: number;
  setSlideIdx: (i: number) => void;
  isFree?: boolean;
  onUnlock?: () => void;
}) {
  const slide = carousel.slides[slideIdx];
  const slideLocked = !!isFree && slideIdx >= FREE_SLIDES;
  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Hook */}
      <div
        style={{
          padding: 14,
          borderRadius: 14,
          background: "rgba(221,42,123,0.10)",
          border: "1px solid rgba(221,42,123,0.30)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#F58AC0",
            fontWeight: 800,
            marginBottom: 6,
          }}
        >
          Hook
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
          {carousel.hook}
        </div>
      </div>

      {/* Slide tabs */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
        {carousel.slides.map((s, i) => {
          const lockedTab = !!isFree && i >= FREE_SLIDES;
          return (
            <button
              key={s.num}
              onClick={() => {
                hapticImpact("light");
                setSlideIdx(i);
              }}
              style={{
                appearance: "none",
                flexShrink: 0,
                minWidth: 36,
                height: 36,
                padding: lockedTab ? "0 9px" : 0,
                borderRadius: 999,
                border: `1px solid ${i === slideIdx ? PINK : CARD_BORDER}`,
                background:
                  i === slideIdx ? "rgba(221,42,123,0.16)" : "rgba(255,255,255,0.04)",
                color: i === slideIdx ? "#F58AC0" : MUTED,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
              }}
            >
              {lockedTab && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M7 10V8a5 5 0 0110 0v2M5 10h14v9a1 1 0 01-1 1H6a1 1 0 01-1-1v-9z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
              )}
              {s.num}
            </button>
          );
        })}
      </div>

      {/* Slide content (для Free слайды 4+ заблюрены под Pro) */}
      {slide && (
        <ProLock
          locked={slideLocked}
          title={`Слайды ${FREE_SLIDES + 1}–${carousel.slides.length} — в Pro`}
          subtitle={`Первые ${FREE_SLIDES} слайда бесплатно. Полная карусель и дизайн-подсказки — в Pro.`}
          cta="Открыть всю карусель"
          onUnlock={onUnlock}
          maxHeight={180}
        >
          <div
            style={{
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 14,
              padding: 18,
              minHeight: 140,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                lineHeight: 1.4,
                textAlign: "center",
                whiteSpace: "pre-wrap",
                color: INK,
              }}
            >
              {slide.text}
            </p>
          </div>
        </ProLock>
      )}

      {/* Caption */}
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
            color: MUTED,
            fontWeight: 800,
            marginBottom: 8,
          }}
        >
          Подпись к посту
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            color: INK,
          }}
        >
          {carousel.caption}
        </p>
        <CopyButton text={carousel.caption} label="Скопировать подпись" />
      </div>

      {/* Hashtags */}
      {carousel.hashtags && carousel.hashtags.length > 0 && (
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
            # Хештеги · {carousel.hashtags.length}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {carousel.hashtags.map((h) => (
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
                #{h.replace(/^#+/, "")}
              </span>
            ))}
          </div>
          <CopyButton
            text={carousel.hashtags.map((h) => `#${h.replace(/^#+/, "")}`).join(" ")}
            label="Скопировать хештеги"
            accent="cyan"
          />
        </div>
      )}

      {/* Экспорт: Free копирует только открытые слайды */}
      <CopyButton
        text={(isFree ? carousel.slides.slice(0, FREE_SLIDES) : carousel.slides)
          .map((s) => `Слайд ${s.num}:\n${s.text}`)
          .join("\n\n")}
        label={isFree ? `Скопировать ${FREE_SLIDES} слайда` : "Скопировать все слайды"}
        accent="pink"
      />
    </div>
  );
}

function CopyButton({
  text,
  label,
  accent = "pink",
}: {
  text: string;
  label: string;
  accent?: "pink" | "cyan";
}) {
  const [done, setDone] = useState(false);
  const color = accent === "cyan" ? "#7AC8FF" : "#F58AC0";
  const bg = accent === "cyan" ? "rgba(122,200,255,0.16)" : "rgba(221,42,123,0.16)";
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
// SUB_MUTED used implicitly via existing token; suppress unused warn
void SUB_MUTED;
