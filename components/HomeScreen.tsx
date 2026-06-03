"use client";

import Link from "next/link";
import { hapticImpact, hapticSelection } from "../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";

function LexMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <path
        d="M8 11 H22 C28 11 28 19 22 19 H14 C8 19 8 27 14 27 H30"
        stroke={YELLOW}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Thumb() {
  return (
    <div
      style={{
        aspectRatio: "3 / 4",
        borderRadius: 16,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.03)",
      }}
    />
  );
}

const PILLS = [
  { label: "План на неделю", href: "/projects" },
  { label: "Открыть ревью", href: "/review" },
  { label: "Лимиты и тариф", href: "/billing" },
];

export default function HomeScreen() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: "calc(-1 * (env(safe-area-inset-bottom) + 78px))",
        display: "flex",
        flexDirection: "column",
        background:
          "radial-gradient(140% 80% at 100% 100%, rgba(178,30,60,0.55) 0%, rgba(178,30,60,0) 55%)," +
          "radial-gradient(110% 70% at 0% 100%, rgba(96,18,80,0.40) 0%, rgba(96,18,80,0) 60%)," +
          "#0A0608",
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* HEADER — отступ сверху рассчитан так, чтобы не цепляться за кнопку «Закрыть» Telegram */}
      <header
        style={{
          padding: "max(calc(env(safe-area-inset-top) + 56px), 88px) 22px 0",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <LexMark size={30} />
        <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.04em" }}>
          LEX&nbsp;AI
        </span>
      </header>
      <div style={{ padding: "4px 22px 0 62px", fontSize: 13, color: MUTED }}>
        Ваш контент-цех
      </div>

      {/* CONTENT */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: "22px 22px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          overflowY: "auto",
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

        {/* PROJECT CARD */}
        <Link
          href="/projects"
          onClick={() => hapticSelection()}
          style={{
            textDecoration: "none",
            color: "inherit",
            display: "block",
            padding: 18,
            borderRadius: 28,
            background:
              "linear-gradient(180deg, rgba(22,16,20,0.92) 0%, rgba(14,10,14,0.88) 100%)",
            border: "1px solid rgba(255,255,255,0.05)",
            boxShadow:
              "0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  lineHeight: 1.15,
                  letterSpacing: "-0.01em",
                  overflowWrap: "anywhere",
                }}
              >
                Instagram-проект
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: MUTED }}>
                План на неделю готов
              </div>
            </div>
            <span
              style={{
                flexShrink: 0,
                background: YELLOW,
                color: "#0A0608",
                fontSize: 12,
                fontWeight: 700,
                padding: "7px 14px",
                borderRadius: 999,
              }}
            >
              В работе
            </span>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
            }}
          >
            <Thumb />
            <Thumb />
            <Thumb />
          </div>
        </Link>

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
          padding: "0 22px max(calc(env(safe-area-inset-bottom) + 56px), 72px)",
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
  );
}
