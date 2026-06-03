"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { hapticImpact, hapticSelection } from "../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";

function LexLogo({ height = 40 }: { height?: number }) {
  // Inline-SVG логотип в стиле референса — жёлтый знак + "LEX AI" (LEX белый, AI жёлтый).
  // Никаких файлов и mix-blend-mode, прозрачный задний фон по определению.
  return (
    <div
      aria-label="LEX AI"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: height * 0.32,
        height,
        lineHeight: 1,
      }}
    >
      <svg
        viewBox="0 0 110 90"
        style={{ height: "100%", width: "auto", overflow: "visible" }}
        fill="none"
        aria-hidden
      >
        {/* Зигзаг-знак: верхняя длинная пилюля → вниз справа → короткая средняя → вниз слева → нижняя длинная */}
        <path
          d="M 14 20 H 70 C 86 20 86 45 70 45 H 40 C 24 45 24 70 40 70 H 96"
          stroke={YELLOW}
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
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

type Slide = {
  badge: string;
  title: string;
  subtitle: string;
  icon: string; // эмодзи-иконка, лёгкий способ дать визуал без файлов
  accent: string; // подкрашиваем фон слайда
};

const SLIDES: Slide[] = [
  {
    badge: "Команда AI",
    title: "7 агентов работают за вас",
    subtitle: "Алина пишет, Михаил монтирует, Виктор публикует",
    icon: "🤝",
    accent: "rgba(178,30,60,0.35)",
  },
  {
    badge: "Авто-монтаж",
    title: "Reels из вашего видео",
    subtitle: "Загрузите — транскрипт, субтитры и публикация автоматом",
    icon: "🎬",
    accent: "rgba(96,18,80,0.45)",
  },
  {
    badge: "Контент-план",
    title: "План на неделю за минуту",
    subtitle: "AI собирает 7 идей под ваш канал и аудиторию",
    icon: "📅",
    accent: "rgba(40,60,140,0.40)",
  },
  {
    badge: "Три формата",
    title: "Посты, Reels и карусели",
    subtitle: "Telegram и Instagram — из одного окна",
    icon: "✨",
    accent: "rgba(140,90,30,0.40)",
  },
];

function BannerCarousel() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), 4500);
    return () => clearInterval(t);
  }, [paused]);

  const s = SLIDES[idx];

  return (
    <div
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
      style={{
        position: "relative",
        borderRadius: 28,
        background:
          "linear-gradient(180deg, rgba(22,16,20,0.92) 0%, rgba(14,10,14,0.88) 100%)",
        border: "1px solid rgba(255,255,255,0.05)",
        boxShadow:
          "0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
        overflow: "hidden",
        minHeight: 200,
      }}
    >
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
          padding: 20,
          animation: "lex-slide-in 520ms cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <span
            style={{
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
          <span style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>{s.icon}</span>
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

        {/* dots */}
        <div style={{ marginTop: 18, display: "flex", gap: 6, justifyContent: "center" }}>
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

export default function HomeScreen() {
  // Документ не скроллится — скроллится только foreground поверх статичного фона.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.cssText;
    const prevBody = body.style.cssText;
    html.style.height = "100%";
    body.style.height = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "contain";
    return () => {
      html.style.cssText = prevHtml;
      body.style.cssText = prevBody;
    };
  }, []);

  const BG = (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background:
          "radial-gradient(140% 80% at 100% 100%, rgba(178,30,60,0.55) 0%, rgba(178,30,60,0) 55%)," +
          "radial-gradient(110% 70% at 0% 100%, rgba(96,18,80,0.40) 0%, rgba(96,18,80,0) 60%)," +
          "#0A0608",
      }}
    />
  );

  return (
    <>
      {BG}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: "calc(-1 * (env(safe-area-inset-bottom) + 78px))",
          display: "flex",
          flexDirection: "column",
          color: INK,
          fontFamily: "'Inter', system-ui, sans-serif",
          overflowY: "auto",
          // iOS rubber-band на этом контейнере (фон не двигается, т.к. он fixed).
          WebkitOverflowScrolling: "touch",
          zIndex: 1,
        }}
      >
      {/* HEADER — отступ сверху рассчитан так, чтобы не цепляться за кнопку «Закрыть» Telegram */}
      <header
        style={{
          padding: "max(calc(env(safe-area-inset-top) + 56px), 88px) 22px 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 6,
        }}
      >
        <LexLogo height={42} />
        <span style={{ fontSize: 13, color: MUTED }}>Ваш контент-цех</span>
      </header>

      {/* CONTENT — статичный, без скролла */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: "22px 22px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          overflow: "hidden",
        }}
      >
        {/* HERO */}
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              lineHeight: 1.02,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
            }}
          >
            Создавайте контент
            <br />
            без рутины
          </h1>
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 14,
              lineHeight: 1.4,
              color: MUTED,
            }}
          >
            Посты, Reels и карусели для Telegram и&nbsp;Instagram
          </p>
        </div>

        {/* BANNER CAROUSEL — анимированная витрина возможностей приложения */}
        <BannerCarousel />

        {/* PILL ROW — все три должны уместиться по ширине iPhone Mini App */}
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "space-between",
          }}
        >
          {PILLS.map((p) => (
            <Link
              key={p.label}
              href={p.href}
              onClick={() => hapticSelection()}
              style={{
                flex: 1,
                textDecoration: "none",
                color: INK,
                padding: "11px 8px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.045)",
                border: "1px solid rgba(255,255,255,0.10)",
                fontSize: 12,
                fontWeight: 500,
                whiteSpace: "nowrap",
                textAlign: "center",
              }}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {/* BOTTOM CTA — отступ снизу учитывает safe-area iPhone */}
      <div
        style={{
          padding: "0 22px max(calc(env(safe-area-inset-bottom) + 88px), 104px)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <button
          onClick={() => hapticImpact("medium")}
          style={{
            width: "100%",
            padding: "20px 0",
            border: "none",
            borderRadius: 999,
            background: YELLOW,
            color: "#0A0608",
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            boxShadow:
              "0 20px 50px rgba(245,231,10,0.25), 0 0 0 1px rgba(255,255,255,0.10) inset",
            cursor: "pointer",
          }}
        >
          Создать контент
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            fontSize: 13,
            color: MUTED,
          }}
        >
          <span style={{ whiteSpace: "nowrap" }}>
            Осталось{" "}
            <span style={{ color: YELLOW, fontWeight: 700 }}>12 Reels</span>
          </span>
          <Link
            href="/billing"
            onClick={() => hapticSelection()}
            style={{
              textDecoration: "none",
              background: YELLOW,
              color: "#0A0608",
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 13px",
              borderRadius: 999,
            }}
          >
            Pro
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}
