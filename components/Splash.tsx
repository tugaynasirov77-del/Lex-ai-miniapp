"use client";

import { useEffect, useState } from "react";
import { hapticImpact } from "../lib/telegram";

const YELLOW = "#F5E70A";

export default function Splash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    hapticImpact("light");
    const t1 = setTimeout(() => setFading(true), 1600);
    const t2 = setTimeout(() => setVisible(false), 2000);
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
        background: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fading ? 0 : 1,
        transition: "opacity 400ms cubic-bezier(0.16,1,0.3,1)",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.jpg"
        alt=""
        style={{
          width: 200,
          height: 200,
          display: "block",
          opacity: 0,
          transform: "scale(0.7)",
          animation:
            "lex-mark-in 700ms cubic-bezier(0.34, 1.56, 0.64, 1) 150ms forwards",
          filter: `drop-shadow(0 0 40px ${YELLOW}55)`,
        }}
      />

      <style>{`
        @keyframes lex-mark-in {
          0%   { opacity: 0; transform: scale(0.7); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
