"use client";

import { useEffect, useState } from "react";
import { useFlow, useFlowActions } from "../flow";
import { hapticSelection } from "../lib/telegram";
import type { ScreenKey } from "../flow/types";

const YELLOW = "#F5E70A";
const MUTED = "rgba(255,255,255,0.55)";

type Tab = {
  key: "main" | "profile" | "settings";
  label: string;
  icon: React.ReactNode;
  screen: ScreenKey;
};

const TABS: Tab[] = [
  { key: "main", label: "Главный", icon: <HomeIcon />, screen: "home" },
  { key: "profile", label: "Профиль", icon: <UserIcon />, screen: "dashboard" },
  { key: "settings", label: "Настройки", icon: <CogIcon />, screen: "settings" },
];

export default function BottomTabBar() {
  const actions = useFlowActions();
  const { state } = useFlow();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Скрываем таб-бар когда iOS-клавиатура открыта (visualViewport схлопывается)
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const onResize = () => {
      const delta = window.innerHeight - vv.height;
      setKeyboardOpen(delta > 120);
    };
    vv.addEventListener("resize", onResize);
    onResize();
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  // Маппинг текущего экрана → активная вкладка
  const cs = state.currentScreen;
  // На welcome-онбординге таб-бар скрыт — это линейный экран без навигации.
  if (cs === "welcome") return null;
  const projectFromSettings = state.screenMeta?.projectInitialTab === "settings";
  const active: Tab["key"] =
    cs === "home"
      ? "main"
      : cs === "settings" || cs === "billing"
      ? "settings"
      : cs === "project" && projectFromSettings
      ? "settings"
      : "profile";

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: "max(calc(env(safe-area-inset-bottom) + 10px), 16px)",
        zIndex: 50,
        padding: "8px 6px",
        background: "rgba(20,16,14,0.62)",
        backdropFilter: "blur(36px) saturate(180%)",
        WebkitBackdropFilter: "blur(36px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 28,
        boxShadow: "0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset",
        display: "flex",
        gap: 4,
        transform: keyboardOpen ? "translateY(150%)" : "translateY(0)",
        transition: "transform 180ms ease-out",
        pointerEvents: keyboardOpen ? "none" : "auto",
      }}
    >
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => {
              hapticSelection();
              actions.navigate(t.screen);
            }}
            style={{
              flex: 1,
              background: isActive ? "rgba(245,231,10,0.10)" : "transparent",
              border: "none",
              borderRadius: 22,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "8px 0",
              cursor: "pointer",
              color: isActive ? YELLOW : MUTED,
              fontFamily: "inherit",
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.02em",
              transition: "background 200ms, color 200ms",
            }}
          >
            <div style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {t.icon}
            </div>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 11.5L12 4l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-8.5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}

function CogIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3h0a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8v0a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  );
}
