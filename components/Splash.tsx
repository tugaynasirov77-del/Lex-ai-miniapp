"use client";

import { useEffect, useState } from "react";
import { hapticImpact, hapticNotify } from "../lib/telegram";
import AtomLogo from "./AtomLogo";

export default function Splash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
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
          gap: 18,
          maxWidth: "100%",
          animation: "lexLogoIn 700ms cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        <div
          style={{
            animation: "lexLogoSpinSplash 12s linear 700ms infinite",
          }}
        >
          <AtomLogo size={108} uid="splash" glow />
        </div>

        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 200,
            fontSize: 32,
            letterSpacing: "0.32em",
            color: "#F5EDD8",
            paddingLeft: "0.32em",
            whiteSpace: "nowrap",
            animation: "lexTextIn 800ms cubic-bezier(0.16,1,0.3,1) 600ms both",
            minWidth: 0,
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

      <style>{`
        @keyframes lexLogoIn {
          0% { opacity: 0; transform: scale(0.55); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes lexLogoSpinSplash {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes lexLogoGlow {
          0%, 100% { opacity: 0.55; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes lexTextIn {
          0% { opacity: 0; transform: translateX(-14px); filter: blur(8px); }
          60% { filter: blur(0); }
          100% { opacity: 1; transform: translateX(0); filter: blur(0); }
        }
      `}</style>
    </div>
  );
}
