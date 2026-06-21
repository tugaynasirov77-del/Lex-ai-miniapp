"use client";

import { useEffect, useState } from "react";
import { getBillingSummary, peekBilling } from "../lib/api";

const INK = "#F4F4F8";
const MUTED = "#9A9AAB";
const IG_GRADIENT = "linear-gradient(135deg, #A24FD6 0%, #E84B91 50%, #F88A4A 100%)";

/**
 * Хук: является ли текущий юзер Free (для гейтинга премиум-частей).
 * Мгновенно из кэша (peekBilling), затем подтверждает с сервера.
 */
export function useIsFree(): boolean {
  const [tier, setTier] = useState<string>(() => peekBilling()?.tier || "free");
  useEffect(() => {
    let alive = true;
    getBillingSummary().then((b) => alive && setTier(b.tier)).catch(() => {});
    return () => { alive = false; };
  }, []);
  return tier !== "pro" && tier !== "business";
}

/**
 * Премиум-обёртка: для Free показывает контент заблюренным с Pro-оверлеем
 * (FOMO — видно края, рука тянется открыть). Для Pro — контент как есть.
 */
export default function ProLock({
  locked,
  title = "Доступно в Pro",
  subtitle,
  cta = "Открыть в Pro",
  onUnlock,
  maxHeight = 280,
  children,
}: {
  locked: boolean;
  title?: string;
  subtitle?: string;
  cta?: string;
  onUnlock?: () => void;
  maxHeight?: number;
  children: React.ReactNode;
}) {
  if (!locked) return <>{children}</>;
  return (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", border: "1px solid #262630" }}>
      <div
        aria-hidden
        style={{ filter: "blur(6px)", pointerEvents: "none", userSelect: "none", opacity: 0.6, maxHeight, overflow: "hidden" }}
      >
        {children}
      </div>
      <div
        style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 10, padding: 20,
          background: "linear-gradient(180deg, rgba(11,11,17,0.35) 0%, rgba(11,11,17,0.84) 70%)",
        }}
      >
        <div style={{ width: 44, height: 44, borderRadius: 14, background: IG_GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 28px rgba(232,75,145,0.4)" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M7 10V8a5 5 0 0110 0v2M5 10h14v9a1 1 0 01-1 1H6a1 1 0 01-1-1v-9z" stroke="#FFFFFF" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: INK, textAlign: "center", letterSpacing: "-0.01em" }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12.5, color: MUTED, textAlign: "center", lineHeight: 1.45, maxWidth: 300 }}>{subtitle}</div>
        )}
        <button
          onClick={() => onUnlock?.()}
          style={{ appearance: "none", marginTop: 4, padding: "11px 22px", border: "none", borderRadius: 999, background: IG_GRADIENT, color: "#FFFFFF", fontFamily: "inherit", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 12px 28px rgba(232,75,145,0.4)" }}
        >
          {cta}
        </button>
      </div>
    </div>
  );
}
