"use client";

import { usePathname } from "next/navigation";

function Sigil() {
  return (
    <svg width="24" height="24" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tbSigilGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F0A020" />
          <stop offset="100%" stopColor="#C04020" />
        </linearGradient>
      </defs>
      <polygon points="15,3 27,10 27,20 15,27 3,20 3,10" fill="none" stroke="rgba(220,120,40,0.18)" strokeWidth="1" />
      <polygon points="15,7 23,12 23,18 15,23 7,18 7,12" fill="rgba(220,100,30,0.07)" stroke="rgba(220,100,30,0.30)" strokeWidth="0.8" />
      <circle cx="15" cy="15" r="2.3" fill="url(#tbSigilGrad)" />
    </svg>
  );
}

export default function TopBar() {
  const path = usePathname();
  if (path === "/") return null;
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "calc(env(safe-area-inset-top) + 96px) 22px 0",
        position: "relative",
        zIndex: 2,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Sigil />
        <span style={{ fontWeight: 300, fontSize: 16, color: "#F1E3C4", letterSpacing: "0.26em" }}>
          LEX AI
        </span>
      </div>
      <div
        style={{
          width: 27,
          height: 27,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 300,
          color: "rgba(255,255,255,0.4)",
        }}
      >
        Д
      </div>
    </header>
  );
}
