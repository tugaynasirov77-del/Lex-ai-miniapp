"use client";

import { useRef, useState } from "react";
import { hapticImpact, hapticSelection } from "../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const BG = "#0A0608";

type Props = {
  /** «Разобрать первый Reels» / «Начать работу» — ведёт на создание проекта. */
  onStart: () => void;
  /** «Создать сценарий без референса» — тоже в создание проекта, но мягкий путь. */
  onSkipToCreate: () => void;
  /** Пометить онбординг пройденным (localStorage + сервер). Вызывается перед уходом. */
  onComplete: () => void;
};

function LexLogo({ height = 64 }: { height?: number }) {
  return (
    <div
      aria-label="LEX AI"
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.jpg"
        alt=""
        style={{
          height,
          width: height,
          objectFit: "cover",
          display: "block",
          borderRadius: height * 0.3,
        }}
      />
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "0.08em",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <span style={{ color: INK }}>LEX </span>
        <span style={{ color: YELLOW }}>AI</span>
      </div>
    </div>
  );
}

type Step =
  | { kind: "hero" }
  | { kind: "slides" }
  | { kind: "final" };

const SLIDES: { icon: string; text: string }[] = [
  {
    icon: "🔍",
    text:
      "LEX разбирает структуру, хук, визуал и психологические триггеры вирусного Reels",
  },
  {
    icon: "🎯",
    text: "LEX адаптирует идею под тему, аудиторию и стиль пользователя",
  },
  {
    icon: "🎬",
    text:
      "LEX создаёт готовый сценарий и помогает добавить его в контент-план",
  },
];

export default function WelcomeScreen({
  onStart,
  onSkipToCreate,
  onComplete,
}: Props) {
  // Линейный мини-flow: hero → 3 слайда → final.
  const [phase, setPhase] = useState<Step["kind"]>("hero");
  const [slide, setSlide] = useState(0);
  const startX = useRef<number | null>(null);

  const finish = (cb: () => void) => {
    onComplete();
    cb();
  };

  // --- свайп между слайдами ---
  const onDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
  };
  const onUp = (e: React.PointerEvent) => {
    if (startX.current == null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    const THRESHOLD = 50;
    if (dx < -THRESHOLD) nextSlide();
    else if (dx > THRESHOLD) prevSlide();
  };

  const nextSlide = () => {
    hapticSelection();
    if (slide < SLIDES.length - 1) setSlide((s) => s + 1);
    else setPhase("final");
  };
  const prevSlide = () => {
    if (slide > 0) {
      hapticSelection();
      setSlide((s) => s - 1);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: BG,
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding:
          "max(calc(env(safe-area-inset-top) + 56px), 76px) 24px max(calc(env(safe-area-inset-bottom) + 24px), 28px)",
      }}
    >
      {phase === "hero" && (
        <Hero
          onPrimary={() => {
            hapticImpact("medium");
            setPhase("slides");
          }}
          onSecondary={() => {
            hapticSelection();
            finish(onSkipToCreate);
          }}
        />
      )}

      {phase === "slides" && (
        <div
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={() => (startX.current = null)}
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            touchAction: "pan-y",
            userSelect: "none",
          }}
        >
          <SlideView slide={SLIDES[slide]} index={slide} />

          {/* dots */}
          <div
            style={{
              display: "flex",
              gap: 6,
              justifyContent: "center",
              margin: "8px 0 22px",
            }}
          >
            {SLIDES.map((_, i) => (
              <span
                key={i}
                style={{
                  width: i === slide ? 22 : 6,
                  height: 6,
                  borderRadius: 999,
                  background: i === slide ? YELLOW : "rgba(255,255,255,0.25)",
                  transition: "width 320ms ease, background 320ms ease",
                }}
              />
            ))}
          </div>

          <PrimaryButton
            label={slide < SLIDES.length - 1 ? "Дальше" : "Почти готово"}
            onClick={nextSlide}
          />
        </div>
      )}

      {phase === "final" && (
        <Final
          onStart={() => {
            hapticImpact("medium");
            finish(onStart);
          }}
        />
      )}
    </div>
  );
}

function Hero({
  onPrimary,
  onSecondary,
}: {
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          gap: 22,
        }}
      >
        <LexLogo height={72} />
        <h1
          style={{
            margin: 0,
            fontSize: 27,
            lineHeight: 1.15,
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          Преврати любой Reels в готовый сценарий для своего блога
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.5,
            color: MUTED,
            maxWidth: 320,
          }}
        >
          Вставь ссылку — LEX найдёт рабочую механику ролика, адаптирует её под
          твою нишу и подготовит сценарий для съёмки.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <PrimaryButton label="Разобрать первый Reels" onClick={onPrimary} />
        <button
          onClick={onSecondary}
          style={{
            appearance: "none",
            background: "transparent",
            border: "none",
            color: MUTED,
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            padding: "6px 0",
          }}
        >
          Создать сценарий без референса
        </button>
      </div>
    </div>
  );
}

function SlideView({
  slide,
  index,
}: {
  slide: { icon: string; text: string };
  index: number;
}) {
  return (
    <div
      key={index}
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        gap: 26,
        animation: "lex-welcome-in 420ms cubic-bezier(0.16,1,0.3,1) both",
      }}
    >
      <div
        style={{
          width: 116,
          height: 116,
          borderRadius: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 52,
          background: "rgba(245,231,10,0.08)",
          border: `1px solid ${YELLOW}33`,
          boxShadow: `0 0 60px ${YELLOW}22`,
        }}
      >
        {slide.icon}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 19,
          lineHeight: 1.4,
          fontWeight: 700,
          maxWidth: 300,
        }}
      >
        {slide.text}
      </p>
      <style>{`
        @keyframes lex-welcome-in {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function Final({ onStart }: { onStart: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          gap: 22,
        }}
      >
        <LexLogo height={64} />
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            lineHeight: 1.15,
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          Создадим твой первый проект
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.5,
            color: MUTED,
            maxWidth: 300,
          }}
        >
          Подключи Instagram-аккаунт — и LEX начнёт собирать для тебя разборы и
          сценарии.
        </p>
      </div>
      <PrimaryButton label="Начать работу" onClick={onStart} />
    </div>
  );
}

function PrimaryButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: "none",
        width: "100%",
        minHeight: 56,
        border: "none",
        borderRadius: 999,
        background: `linear-gradient(135deg, #FFF382 0%, ${YELLOW} 45%, #E5C500 100%)`,
        color: "#0A0608",
        fontFamily: "inherit",
        fontSize: 15,
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        cursor: "pointer",
        boxShadow: `0 18px 44px ${YELLOW}40, 0 4px 14px ${YELLOW}33, 0 0 0 1px rgba(255,255,255,0.20) inset`,
      }}
    >
      {label}
    </button>
  );
}
