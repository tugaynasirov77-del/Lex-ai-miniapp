"use client";

import { useEffect, useState } from "react";
import { hapticImpact, hapticNotify } from "../lib/telegram";

const YELLOW = "#F5E70A";

export default function Splash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    hapticImpact("light");
    const tv = setTimeout(() => hapticNotify("success"), 1100);
    // Timeline: 200ms delay + draw 1100ms + dot 280ms + text overlap + hold 400ms + fade out 350ms ≈ 2300ms
    const t1 = setTimeout(() => setFading(true), 1950);
    const t2 = setTimeout(() => setVisible(false), 2300);
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
      {/* MARK — новый PNG-логотип */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.jpg"
        alt=""
        style={{
          height: 76,
          width: 76,
          borderRadius: 18,
          objectFit: "cover",
          display: "block",
          filter: `drop-shadow(0 0 26px ${YELLOW}55)`,
          opacity: 0,
          animation: "lex-mark-in 700ms cubic-bezier(0.16,1,0.3,1) 200ms forwards",
        }}
      />

      {/* WORDMARK */}
      <div
        style={{
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: "0.06em",
          lineHeight: 1,
          opacity: 0,
          animation: "lex-text-in 500ms cubic-bezier(0.16,1,0.3,1) 1100ms forwards",
        }}
      >
        <span style={{ color: "#FFFFFF" }}>LEX </span>
        <span style={{ color: YELLOW }}>AI</span>
      </div>

      <style>{`
        @keyframes lex-mark-in {
          0% { opacity: 0; transform: scale(0.7); }
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
