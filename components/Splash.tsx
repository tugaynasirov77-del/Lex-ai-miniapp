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
    const t1 = setTimeout(() => setFading(true), 2400);
    const t2 = setTimeout(() => setVisible(false), 2850);
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
        overflow: "hidden",
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
      {/* ambient aurora blobs */}
      <div
        style={{
          position: "absolute",
          top: "22%",
          left: "18%",
          width: 260,
          height: 260,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(176,38,255,0.35) 0%, rgba(176,38,255,0) 70%)",
          filter: "blur(30px)",
          animation: "lex-aurora-a 7s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "20%",
          right: "16%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,138,30,0.28) 0%, rgba(255,138,30,0) 70%)",
          filter: "blur(34px)",
          animation: "lex-aurora-b 9s ease-in-out infinite",
        }}
      />

      {/* mark + motion rings */}
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
        {/* rotating conic gradient ring */}
        <div
          style={{
            position: "absolute",
            inset: -18,
            borderRadius: "50%",
            padding: 3,
            background:
              "conic-gradient(from 0deg, rgba(176,38,255,0) 0deg, #B026FF 90deg, #E0249B 180deg, #FF8A1E 270deg, rgba(255,138,30,0) 360deg)",
            WebkitMask:
              "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
            animation: "lex-spin 3.2s linear infinite",
          }}
        />
        {/* counter-rotating dashed ring */}
        <div
          style={{
            position: "absolute",
            inset: -30,
            borderRadius: "50%",
            border: "1.5px dashed rgba(224,36,155,0.35)",
            animation: "lex-spin-rev 12s linear infinite",
          }}
        />
        {/* orbiting spark */}
        <div
          style={{
            position: "absolute",
            inset: -18,
            animation: "lex-spin 2.6s linear infinite",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: -3,
              left: "50%",
              width: 7,
              height: 7,
              marginLeft: -3.5,
              borderRadius: "50%",
              background: "#FF8A1E",
              boxShadow: "0 0 10px 2px rgba(255,138,30,0.8)",
            }}
          />
        </div>
        {/* soft glow */}
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/lex-logo.png"
          alt=""
          width={132}
          height={132}
          style={{ position: "relative", display: "block", width: 132, height: 132 }}
        />
      </div>

      {/* wordmark */}
      <div
        style={{
          position: "relative",
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
          position: "relative",
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
        @keyframes lex-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes lex-spin-rev {
          to { transform: rotate(-360deg); }
        }
        @keyframes lex-aurora-a {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.8; }
          50%      { transform: translate(30px, -24px) scale(1.15); opacity: 1; }
        }
        @keyframes lex-aurora-b {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.7; }
          50%      { transform: translate(-26px, 20px) scale(1.12); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
