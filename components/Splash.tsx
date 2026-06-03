"use client";

import { useEffect, useState } from "react";
import { hapticImpact, hapticNotify } from "../lib/telegram";

const YELLOW = "#F5E70A";

export default function Splash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    hapticImpact("light");
    const tv = setTimeout(() => hapticNotify("success"), 800);
    // Total timeline: draw mark 700ms + text fade 300ms (overlaps) + hold 500ms + fade out 300ms ≈ 1500ms
    const t1 = setTimeout(() => setFading(true), 1200);
    const t2 = setTimeout(() => setVisible(false), 1500);
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
        gap: 14,
        opacity: fading ? 0 : 1,
        transition: "opacity 300ms cubic-bezier(0.16,1,0.3,1)",
        pointerEvents: fading ? "none" : "auto",
        overflow: "hidden",
        padding: "0 20px",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* MARK — рисуется stroke-by-stroke */}
      <svg
        viewBox="0 0 110 90"
        style={{ height: 56, width: "auto", overflow: "visible" }}
        fill="none"
        aria-hidden
      >
        <path
          d="M 14 20 H 70 C 86 20 86 45 70 45 H 40 C 24 45 24 70 40 70 H 96"
          stroke={YELLOW}
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 260,
            strokeDashoffset: 260,
            animation: "lex-mark-draw 700ms cubic-bezier(0.65,0,0.35,1) 100ms forwards",
            filter: `drop-shadow(0 0 18px ${YELLOW}66)`,
          }}
        />
        {/* Белая точка-кончик на конце змейки, появляется после отрисовки */}
        <circle
          cx="96"
          cy="70"
          r="9"
          fill="#FFFFFF"
          style={{
            opacity: 0,
            animation: "lex-dot-in 280ms cubic-bezier(0.16,1,0.3,1) 720ms forwards",
            transformOrigin: "96px 70px",
            filter: "drop-shadow(0 0 10px rgba(255,255,255,0.95))",
          }}
        />
      </svg>

      {/* WORDMARK */}
      <div
        style={{
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: "0.06em",
          lineHeight: 1,
          opacity: 0,
          animation: "lex-text-in 500ms cubic-bezier(0.16,1,0.3,1) 550ms forwards",
        }}
      >
        <span style={{ color: "#FFFFFF" }}>LEX </span>
        <span style={{ color: YELLOW }}>AI</span>
      </div>

      <style>{`
        @keyframes lex-mark-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes lex-dot-in {
          0% { opacity: 0; transform: scale(0); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes lex-text-in {
          0% { opacity: 0; transform: translateX(-12px); filter: blur(6px); }
          60% { filter: blur(0); }
          100% { opacity: 1; transform: translateX(0); filter: blur(0); }
        }
      `}</style>
    </div>
  );
}
