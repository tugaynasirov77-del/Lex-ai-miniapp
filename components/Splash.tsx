"use client";

import { useEffect, useState } from "react";

export default function Splash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 3000);
    const t2 = setTimeout(() => setVisible(false), 3600);
    return () => {
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
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          height: 160,
        }}
      >
        {/* Робот + кольцо */}
        <div
          style={{
            position: "relative",
            width: 160,
            height: 160,
            flexShrink: 0,
            zIndex: 2,
            animation: "lexBotIn 700ms cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          {/* мягкое свечение позади */}
          <div
            style={{
              position: "absolute",
              inset: -20,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(240,155,35,0.22) 0%, rgba(240,155,35,0) 65%)",
              filter: "blur(8px)",
              animation: "lexBotGlow 2.6s ease-in-out infinite",
            }}
          />

          {/* вращающееся кольцо-дуга */}
          <svg
            width="160"
            height="160"
            viewBox="0 0 160 160"
            style={{
              position: "absolute",
              inset: 0,
              animation:
                "lexRingSpin 1.2s cubic-bezier(0.4,0,0.2,1) 350ms both",
            }}
          >
            <defs>
              <linearGradient id="splRing" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F0A020" stopOpacity="0" />
                <stop offset="40%" stopColor="#F0A020" stopOpacity="1" />
                <stop offset="100%" stopColor="#C04020" stopOpacity="1" />
              </linearGradient>
            </defs>
            <circle
              cx="80"
              cy="80"
              r="62"
              fill="none"
              stroke="url(#splRing)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeDasharray="390"
              strokeDashoffset="390"
              style={{
                animation:
                  "lexRingDraw 1.2s cubic-bezier(0.4,0,0.2,1) 350ms forwards",
                filter: "drop-shadow(0 0 6px rgba(240,160,40,0.55))",
              }}
            />
          </svg>

          {/* сам робот — сфера */}
          <svg
            width="100"
            height="100"
            viewBox="0 0 100 100"
            style={{
              position: "absolute",
              left: 30,
              top: 30,
            }}
          >
            <defs>
              <radialGradient id="splBotBody" cx="50%" cy="35%" r="60%">
                <stop offset="0%" stopColor="#2a1f15" />
                <stop offset="55%" stopColor="#15100B" />
                <stop offset="100%" stopColor="#080503" />
              </radialGradient>
              <radialGradient id="splEye" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="#FFD680" />
                <stop offset="55%" stopColor="#F0A020" />
                <stop offset="100%" stopColor="#C04020" />
              </radialGradient>
              <filter id="splEyeGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.2" />
              </filter>
            </defs>

            {/* тело сферы */}
            <circle cx="50" cy="50" r="44" fill="url(#splBotBody)" />
            {/* блик сверху */}
            <ellipse
              cx="50"
              cy="28"
              rx="20"
              ry="6"
              fill="rgba(255,180,80,0.10)"
            />
            {/* контурная подсветка */}
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="rgba(240,160,40,0.25)"
              strokeWidth="0.6"
            />

            {/* глаза */}
            <g style={{ animation: "lexEyesBlink 4s ease-in-out infinite 1.6s" }}>
              <rect x="32" y="44" width="10" height="14" rx="5" fill="url(#splEye)" filter="url(#splEyeGlow)" />
              <rect x="58" y="44" width="10" height="14" rx="5" fill="url(#splEye)" filter="url(#splEyeGlow)" />
              {/* пин-блики */}
              <ellipse cx="37" cy="48" rx="1.2" ry="2" fill="rgba(255,255,255,0.85)" />
              <ellipse cx="63" cy="48" rx="1.2" ry="2" fill="rgba(255,255,255,0.85)" />
            </g>
          </svg>
        </div>

        {/* Текст LEX AI — выезжает из-за робота */}
        <div
          style={{
            position: "relative",
            marginLeft: 18,
            overflow: "hidden",
            paddingRight: 4,
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 200,
              fontSize: 38,
              letterSpacing: "0.38em",
              color: "#F5EDD8",
              paddingLeft: "0.38em",
              whiteSpace: "nowrap",
              animation:
                "lexTextSlide 900ms cubic-bezier(0.16,1,0.3,1) 1700ms both",
              transformOrigin: "left center",
            }}
          >
            LEX{" "}
            <span
              style={{
                background:
                  "linear-gradient(135deg, #F0A020 0%, #E06020 55%, #C04020 100%)",
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
      </div>

      <style>{`
        @keyframes lexBotIn {
          0% { opacity: 0; transform: scale(0.6); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes lexBotGlow {
          0%, 100% { opacity: 0.5; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes lexRingSpin {
          0% { transform: rotate(-90deg); }
          100% { transform: rotate(270deg); }
        }
        @keyframes lexRingDraw {
          0% { stroke-dashoffset: 390; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes lexTextSlide {
          0% {
            opacity: 0;
            transform: translateX(-40px);
            filter: blur(8px);
          }
          60% {
            opacity: 1;
            filter: blur(0);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
            filter: blur(0);
          }
        }
        @keyframes lexEyesBlink {
          0%, 92%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }
      `}</style>
    </div>
  );
}
