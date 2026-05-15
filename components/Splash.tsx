"use client";

import { useEffect, useState } from "react";

export default function Splash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 900);
    const t2 = setTimeout(() => setVisible(false), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#0A0705",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 22,
        opacity: fading ? 0 : 1,
        transition: "opacity 600ms cubic-bezier(0.16,1,0.3,1)",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      {/* glow позади */}
      <div
        style={{
          position: "absolute",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(240,155,35,0.22) 0%, rgba(240,155,35,0) 60%)",
          filter: "blur(20px)",
          animation: "lexGlow 2.4s ease-in-out infinite",
        }}
      />

      {/* сигил */}
      <div style={{ animation: "lexSigilIn 700ms cubic-bezier(0.16,1,0.3,1) both" }}>
        <svg width="72" height="72" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="splashSigilGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F0A020" />
              <stop offset="100%" stopColor="#C04020" />
            </linearGradient>
          </defs>
          <polygon
            points="15,3 27,10 27,20 15,27 3,20 3,10"
            fill="none"
            stroke="rgba(240,160,40,0.35)"
            strokeWidth="0.8"
            style={{ animation: "lexRingPulse 2.4s ease-in-out infinite" }}
          />
          <polygon
            points="15,7 23,12 23,18 15,23 7,18 7,12"
            fill="rgba(220,100,30,0.10)"
            stroke="rgba(220,100,30,0.55)"
            strokeWidth="0.7"
          />
          <circle cx="15" cy="15" r="2.6" fill="url(#splashSigilGrad)">
            <animate attributeName="r" values="2.6;3.2;2.6" dur="1.8s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>

      {/* wordmark */}
      <div
        style={{
          animation: "lexWordIn 800ms cubic-bezier(0.16,1,0.3,1) 200ms both",
          letterSpacing: "0.42em",
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 200,
          fontSize: 22,
          color: "#F5EDD8",
          paddingLeft: "0.42em",
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

      {/* подзаголовок */}
      <p
        style={{
          animation: "lexWordIn 800ms cubic-bezier(0.16,1,0.3,1) 350ms both",
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 300,
          fontSize: 13,
          color: "rgba(255,255,255,0.45)",
          letterSpacing: "0.16em",
          marginTop: -10,
        }}
      >
        КОМАНДА · 8 АГЕНТОВ
      </p>

      {/* линия-индикатор загрузки */}
      <div
        style={{
          position: "absolute",
          bottom: "22%",
          width: 64,
          height: 2,
          borderRadius: 1,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "40%",
            height: "100%",
            background: "linear-gradient(90deg, transparent, #F0A020, transparent)",
            animation: "lexLine 1.4s ease-in-out infinite",
          }}
        />
      </div>

      <style>{`
        @keyframes lexGlow {
          0%, 100% { opacity: 0.4; transform: scale(0.95); }
          50% { opacity: 0.9; transform: scale(1.05); }
        }
        @keyframes lexRingPulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.9; }
        }
        @keyframes lexSigilIn {
          0% { opacity: 0; transform: scale(0.6) rotate(-12deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        @keyframes lexWordIn {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes lexLine {
          0% { transform: translateX(-160%); }
          100% { transform: translateX(420%); }
        }
      `}</style>
    </div>
  );
}
