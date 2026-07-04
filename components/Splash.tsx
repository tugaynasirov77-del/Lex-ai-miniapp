"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { hapticImpact } from "../lib/telegram";

export default function Splash() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (pathname?.startsWith("/legal")) return;
    hapticImpact("light");
    const t1 = setTimeout(() => setFading(true), 2000);
    const t2 = setTimeout(() => setVisible(false), 2450);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (pathname?.startsWith("/legal")) return null;
  if (!visible) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background:
          "radial-gradient(120% 120% at 50% 40%, #18101c 0%, #0A0705 60%, #050304 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 26,
        opacity: fading ? 0 : 1,
        transition: "opacity 450ms cubic-bezier(0.16,1,0.3,1)",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      {/* mark */}
      <div
        style={{
          position: "relative",
          width: 132,
          height: 132,
          opacity: 0,
          animation:
            "lex-mark-in 700ms cubic-bezier(0.34,1.56,0.64,1) 100ms forwards",
        }}
      >
        {/* glow */}
        <div
          style={{
            position: "absolute",
            inset: -28,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(214,40,160,0.45) 0%, rgba(255,120,40,0.18) 45%, rgba(255,120,40,0) 70%)",
            filter: "blur(14px)",
            animation: "lex-glow 2.2s ease-in-out infinite",
          }}
        />
        <svg
          width={132}
          height={132}
          viewBox="0 0 200 200"
          shapeRendering="geometricPrecision"
          style={{ position: "relative", display: "block" }}
        >
          <defs>
            <linearGradient id="lexMarkGrad" x1="20%" y1="0%" x2="85%" y2="100%">
              <stop offset="0%" stopColor="#B026FF" />
              <stop offset="42%" stopColor="#E0249B" />
              <stop offset="72%" stopColor="#FF3D62" />
              <stop offset="100%" stopColor="#FF8A1E" />
            </linearGradient>
          </defs>
          <g
            stroke="url(#lexMarkGrad)"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            {/* outer rounded triangle */}
            <path
              d="M100 30 L170 154 L30 154 Z"
              strokeWidth="18"
              style={{
                strokeDasharray: 460,
                strokeDashoffset: 460,
                animation: "lex-draw 900ms ease 250ms forwards",
              }}
            />
            {/* inner left diagonal */}
            <path
              d="M64 150 L102 84"
              strokeWidth="15"
              style={{
                strokeDasharray: 90,
                strokeDashoffset: 90,
                animation: "lex-draw 600ms ease 850ms forwards",
              }}
            />
            {/* inner right bar */}
            <path
              d="M122 150 L130 108"
              strokeWidth="15"
              style={{
                strokeDasharray: 50,
                strokeDashoffset: 50,
                animation: "lex-draw 500ms ease 1050ms forwards",
              }}
            />
          </g>
        </svg>
      </div>

      {/* wordmark */}
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          opacity: 0,
          transform: "translateY(8px)",
          animation: "lex-word-in 600ms cubic-bezier(0.16,1,0.3,1) 1100ms forwards",
        }}
      >
        <span style={{ color: "#F4F1EE" }}>Lex </span>
        <span
          style={{
            background: "linear-gradient(100deg, #E0249B, #FF8A1E)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
          }}
        >
          AI
        </span>
      </div>

      {/* loader dots */}
      <div
        style={{
          display: "flex",
          gap: 7,
          opacity: 0,
          animation: "lex-word-in 500ms ease 1350ms forwards",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "linear-gradient(100deg, #E0249B, #FF8A1E)",
              animation: "lex-dot 1.1s ease-in-out infinite",
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes lex-mark-in {
          0%   { opacity: 0; transform: scale(0.7); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes lex-draw {
          100% { stroke-dashoffset: 0; }
        }
        @keyframes lex-word-in {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes lex-glow {
          0%, 100% { opacity: 0.55; transform: scale(0.94); }
          50%      { opacity: 1;    transform: scale(1.06); }
        }
        @keyframes lex-dot {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50%      { opacity: 1;   transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
