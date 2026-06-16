"use client";

import { useEffect, useState } from "react";
import { hapticImpact, hapticNotify } from "../lib/telegram";

const YELLOW = "#F5E70A";

// Timeline:
//   0ms       — старт, лёгкий хаптик
//   200ms     — логотип scale+fade in (700ms)
//   900ms     — пауза
//   1100ms    — текст fade+slide in справа (550ms), hapticNotify success
//   1650ms    — оба видны
//   2400ms    — fade out (400ms)
//   2800ms    — скрыть
export default function Splash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    hapticImpact("light");
    const tv = setTimeout(() => hapticNotify("success"), 1100);
    const t1 = setTimeout(() => setFading(true), 2400);
    const t2 = setTimeout(() => setVisible(false), 2800);
    return () => {
      clearTimeout(tv);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background:
          "radial-gradient(140% 80% at 100% 100%, rgba(178,30,60,0.45) 0%, rgba(178,30,60,0) 55%)," +
          "radial-gradient(110% 70% at 0% 100%, rgba(96,18,80,0.35) 0%, rgba(96,18,80,0) 60%)," +
          "#08050A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        opacity: fading ? 0 : 1,
        transition: "opacity 400ms cubic-bezier(0.16,1,0.3,1)",
        pointerEvents: fading ? "none" : "auto",
        overflow: "hidden",
        padding: "0 20px",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* MARK — появляется первым */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.jpg"
        alt=""
        style={{
          height: 80,
          width: 80,
          borderRadius: 20,
          objectFit: "cover",
          display: "block",
          filter: `drop-shadow(0 0 30px ${YELLOW}55)`,
          opacity: 0,
          transform: "scale(0.6)",
          animation:
            "lex-mark-in 700ms cubic-bezier(0.34, 1.56, 0.64, 1) 200ms forwards",
        }}
      />

      {/* WORDMARK — появляется после логотипа */}
      <div
        style={{
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: "0.06em",
          lineHeight: 1,
          opacity: 0,
          transform: "translateX(-16px)",
          animation:
            "lex-text-in 550ms cubic-bezier(0.16,1,0.3,1) 1100ms forwards",
        }}
      >
        <span style={{ color: "#FFFFFF" }}>LEX </span>
        <span style={{ color: YELLOW }}>AI</span>
      </div>

      <style>{`
        @keyframes lex-mark-in {
          0%   { opacity: 0; transform: scale(0.55) rotate(-8deg); filter: blur(6px) drop-shadow(0 0 30px ${YELLOW}55); }
          60%  { opacity: 1; filter: blur(0) drop-shadow(0 0 36px ${YELLOW}88); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); filter: blur(0) drop-shadow(0 0 26px ${YELLOW}55); }
        }
        @keyframes lex-text-in {
          0%   { opacity: 0; transform: translateX(-16px); filter: blur(6px); }
          60%  { filter: blur(0); }
          100% { opacity: 1; transform: translateX(0); filter: blur(0); }
        }
      `}</style>
    </div>
  );
}
