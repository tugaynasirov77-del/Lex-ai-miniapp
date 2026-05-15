"use client";

import { useEffect, useState } from "react";
import { hapticImpact, hapticNotify } from "../lib/telegram";

export default function Splash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // лёгкая вибрация на старте + успех когда текст появляется
    hapticImpact("light");
    const tv = setTimeout(() => hapticNotify("success"), 700);
    const t1 = setTimeout(() => setFading(true), 2800);
    const t2 = setTimeout(() => setVisible(false), 3400);
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
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fading ? 0 : 1,
        transition: "opacity 600ms cubic-bezier(0.16,1,0.3,1)",
        pointerEvents: fading ? "none" : "auto",
        overflow: "hidden",
        padding: "0 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          maxWidth: "100%",
        }}
      >
        {/* Логотип-атом */}
        <div
          style={{
            width: 72,
            height: 72,
            position: "relative",
            flexShrink: 0,
            animation:
              "lexLogoIn 700ms cubic-bezier(0.16,1,0.3,1) both, lexLogoSpin 12s linear 700ms infinite",
          }}
        >
          {/* glow позади */}
          <div
            style={{
              position: "absolute",
              inset: -10,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(240,160,40,0.30) 0%, rgba(240,160,40,0) 65%)",
              filter: "blur(8px)",
              animation: "lexLogoGlow 2.6s ease-in-out infinite",
            }}
          />

          <svg width="72" height="72" viewBox="0 0 200 200" style={{ position: "relative" }}>
            <defs>
              <radialGradient id="lxOrb" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#FFE6B0" />
                <stop offset="55%" stopColor="#F0A020" />
                <stop offset="100%" stopColor="#9A3010" />
              </radialGradient>
              <linearGradient id="lxStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F0A020" />
                <stop offset="100%" stopColor="#C04020" />
              </linearGradient>
              <filter id="lxGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <g filter="url(#lxGlow)">
              <circle cx="100" cy="100" r="78" fill="none" stroke="url(#lxStroke)" strokeWidth="3" />
              <g stroke="url(#lxStroke)" strokeWidth="3" fill="none" strokeLinecap="round">
                <path d="M 100 100 C 70 90, 60 50, 100 22" />
                <path d="M 100 100 C 110 70, 150 60, 178 100" />
                <path d="M 100 100 C 130 110, 140 150, 100 178" />
                <path d="M 100 100 C 90 130, 50 140, 22 100" />
              </g>
              <circle cx="100" cy="22" r="13" fill="url(#lxOrb)" />
              <circle cx="178" cy="100" r="13" fill="url(#lxOrb)" />
              <circle cx="100" cy="178" r="13" fill="url(#lxOrb)" />
              <circle cx="22" cy="100" r="13" fill="url(#lxOrb)" />
              <circle cx="100" cy="100" r="16" fill="url(#lxOrb)" />
            </g>
          </svg>
        </div>

        {/* Текст LEX AI справа */}
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 200,
            fontSize: 22,
            letterSpacing: "0.28em",
            color: "#F5EDD8",
            paddingLeft: "0.28em",
            whiteSpace: "nowrap",
            animation: "lexTextIn 800ms cubic-bezier(0.16,1,0.3,1) 600ms both",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          LEX{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #F0A020 0%, #E06020 55%, #C04020 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              fontWeight: 300,
            }}
          >
            AI
          </span>
        </div>
      </div>

      <style>{`
        @keyframes lexLogoIn {
          0% { opacity: 0; transform: scale(0.55); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes lexLogoSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes lexLogoGlow {
          0%, 100% { opacity: 0.55; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes lexTextIn {
          0% { opacity: 0; transform: translateX(-12px); filter: blur(6px); }
          60% { filter: blur(0); }
          100% { opacity: 1; transform: translateX(0); filter: blur(0); }
        }
      `}</style>
    </div>
  );
}
