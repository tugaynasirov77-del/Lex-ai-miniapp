"use client";

import { usePathname } from "next/navigation";
import AtomLogo from "./AtomLogo";

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
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <AtomLogo size={26} uid="tb" />
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
