"use client";

import { useEffect, useRef, useState } from "react"; // useEffect остаётся — нужен в BannerCarousel
import Link from "next/link";
import { hapticImpact, hapticSelection } from "../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";

function LexLogo({ height = 40 }: { height?: number }) {
  // PNG/JPG логотип из public/logo.jpg (треугольная "A" с жёлтым контуром).
  return (
    <div
      aria-label="LEX AI"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: height * 0.34,
        height,
        lineHeight: 1,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.jpg"
        alt=""
        style={{
          height: height * 1.15,
          width: height * 1.15,
          objectFit: "cover",
          display: "block",
          borderRadius: height * 0.32,
        }}
      />
      <div
        style={{
          fontSize: height * 0.62,
          fontWeight: 700,
          letterSpacing: "0.06em",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <span style={{ color: "#FFFFFF" }}>LEX </span>
        <span style={{ color: YELLOW }}>AI</span>
      </div>
    </div>
  );
}

function ProgressUpsell({ used, total }: { used: number; total: number }) {
  const left = Math.max(0, total - used);
  const pct = Math.min(100, Math.round((used / total) * 100));
  const critical = left <= 1; // ≤1 осталось — подкручиваем мотивацию

  return (
    <Link
      href="/billing"
      onClick={() => hapticSelection()}
      style={{
        textDecoration: "none",
        color: INK,
        display: "block",
        padding: "12px 16px",
        borderRadius: 18,
        background: "rgba(255,255,255,0.035)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          fontSize: 13,
        }}
      >
        <span style={{ color: critical ? YELLOW : MUTED, fontWeight: critical ? 700 : 500 }}>
          Free: {left} из {total} Reels осталось
        </span>
        <span style={{ color: MUTED, fontSize: 12, whiteSpace: "nowrap" }}>
          Открой Pro →
        </span>
      </div>
      <div
        style={{
          marginTop: 9,
          height: 6,
          borderRadius: 999,
          background: "rgba(255,255,255,0.07)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: critical
              ? `linear-gradient(90deg, ${YELLOW}, #FFB400)`
              : `linear-gradient(90deg, ${YELLOW}, ${YELLOW})`,
            transition: "width 400ms cubic-bezier(0.16,1,0.3,1)",
            boxShadow: critical ? `0 0 12px ${YELLOW}66` : "none",
          }}
        />
      </div>
    </Link>
  );
}

type Slide = {
  badge: string;
  title: string;
  subtitle: string;
  icon: string; // эмодзи-иконка, лёгкий способ дать визуал без файлов
  accent: string; // подкрашиваем фон слайда
  image?: string; // опц. фоновая фотография слайда
};

const SLIDES: Slide[] = [
  {
    badge: "Один AI-инструмент",
    title: "LEX AI пишет за тебя",
    subtitle: "Посты, карусели и сценарии Reels — на основе анализа конкурентов",
    icon: "✨",
    accent: "rgba(178,30,60,0.30)",
    image: "/slide-team.jpg",
  },
  {
    badge: "3 варианта",
    title: "Не один пост — три",
    subtitle: "Выбираешь лучший вариант. Тапнул — ушло в канал",
    icon: "📝",
    accent: "rgba(96,18,80,0.38)",
    image: "/slide-reels.jpg",
  },
  {
    badge: "Контент-план",
    title: "7 идей на неделю",
    subtitle: "AI собирает план под твою нишу и аудиторию",
    icon: "📅",
    accent: "rgba(40,60,140,0.34)",
    image: "/slide-plan.jpg",
  },
  {
    badge: "Все форматы",
    title: "TG и Instagram",
    subtitle: "Посты, карусели, сценарии Reels — в одном окне",
    icon: "🎯",
    accent: "rgba(140,90,30,0.34)",
    image: "/slide-formats.jpg",
  },
];

function BannerCarousel() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragDX, setDragDX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);

  // Прелоад всех фоновых картинок при монтировании, чтобы при смене слайда
  // фон не подгружался с задержкой и не появлялся позже текста.
  useEffect(() => {
    SLIDES.forEach((sl) => {
      if (!sl.image) return;
      const i = new Image();
      i.src = sl.image;
    });
  }, []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, [paused]);

  const go = (next: number) => {
    setIdx((next + SLIDES.length) % SLIDES.length);
    hapticSelection();
  };

  const onDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    setDragging(true);
    setPaused(true);
  };
  const onMove = (e: React.PointerEvent) => {
    if (startX.current == null) return;
    setDragDX(e.clientX - startX.current);
  };
  const onUp = () => {
    const dx = dragDX;
    setDragging(false);
    setDragDX(0);
    setPaused(false);
    startX.current = null;
    const THRESHOLD = 50;
    if (dx > THRESHOLD) go(idx - 1);
    else if (dx < -THRESHOLD) go(idx + 1);
  };

  const s = SLIDES[idx];

  return (
    <div
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={() => {
        if (dragging) onUp();
      }}
      style={{
        touchAction: "pan-y",
        userSelect: "none",
        position: "relative",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        borderRadius: 28,
        background:
          "linear-gradient(180deg, rgba(22,16,20,0.92) 0%, rgba(14,10,14,0.88) 100%)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
        overflow: "hidden",
        maxHeight: "52vh",
      }}
    >
      {/* фоновая фотография слайда (если задана) — без fade, появляется мгновенно */}
      {s.image && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `url(${s.image}) center / cover no-repeat`,
            opacity: 0.85,
            transition: "background 280ms ease",
            pointerEvents: "none",
          }}
        />
      )}

      {/* тёмная вуаль: сильнее в нижней части, чтобы текст и точки не терялись */}
      {s.image && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(8,5,8,0.35) 0%, rgba(8,5,8,0.65) 55%, rgba(8,5,8,0.95) 100%)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* акцентный glow меняется со слайдом */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(120% 80% at 100% 0%, ${s.accent} 0%, transparent 60%)`,
          transition: "background 600ms ease",
          pointerEvents: "none",
        }}
      />

      <div
        key={idx}
        style={{
          position: "relative",
          flex: 1,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          animation: "lex-slide-in 520ms cubic-bezier(0.16,1,0.3,1) both",
          transform: dragging ? `translateX(${dragDX * 0.4}px)` : undefined,
          transition: dragging ? "none" : "transform 320ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <div>
          <span
            style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#0A0608",
              background: YELLOW,
              padding: "5px 10px",
              borderRadius: 999,
            }}
          >
            {s.badge}
          </span>
        </div>

        <div
          style={{
            marginTop: 16,
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
            color: "#FFFFFF",
          }}
        >
          {s.title}
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
          {s.subtitle}
        </div>

        {/* dots — прижаты к низу, но с воздухом снизу */}
        <div style={{ marginTop: "auto", paddingTop: 22, paddingBottom: 8, display: "flex", gap: 6, justifyContent: "center" }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIdx(i);
                hapticSelection();
              }}
              aria-label={`слайд ${i + 1}`}
              style={{
                width: i === idx ? 22 : 6,
                height: 6,
                borderRadius: 999,
                background: i === idx ? YELLOW : "rgba(255,255,255,0.25)",
                border: "none",
                padding: 0,
                cursor: "pointer",
                transition: "width 320ms ease, background 320ms ease",
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes lex-slide-in {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const PILLS = [
  { label: "План на неделю", href: "/projects" },
  { label: "Открыть ревью", href: "/review" },
  { label: "Лимиты и тариф", href: "/billing" },
];

type HomeScreenProps = {
  /** Колбэк по тапу «Начать» — управляется родителем (AppFlow). */
  onStart?: () => void;
};

export default function HomeScreen({ onStart }: HomeScreenProps = {}) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* HEADER — компактный, не съедает первый экран */}
      <header
        style={{
          padding: "max(calc(env(safe-area-inset-top) + 64px), 96px) 22px 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 4,
        }}
      >
        <LexLogo height={36} />
      </header>

      {/* CONTENT — статичный, без скролла */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: "16px 22px max(calc(env(safe-area-inset-bottom) + 110px), 130px)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          overflow: "hidden",
        }}
      >
        {/* HERO — плотный, без растягивания верха */}
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 32,
              lineHeight: 1,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
            }}
          >
            Контент
            <br />
            без&nbsp;рутины
          </h1>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 13,
              lineHeight: 1.35,
              color: MUTED,
            }}
          >
            Посты, Reels и карусели для Telegram и&nbsp;Instagram
          </p>
        </div>

        {/* BANNER CAROUSEL — заполняет всю свободную высоту до CTA */}
        <BannerCarousel />
      </div>

    </div>
  );
}
