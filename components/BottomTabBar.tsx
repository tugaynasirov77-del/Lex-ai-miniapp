"use client";

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
  { key: "main", label: "Главный", icon: <HomeIcon />, screen: "dashboard" },
  { key: "profile", label: "Профиль", icon: <UserIcon />, screen: "billing" },
  { key: "settings", label: "Настройки", icon: <CogIcon />, screen: "settings" },
];

export default function BottomTabBar() {
  const actions = useFlowActions();
  const { state } = useFlow();

  // Маппинг текущего экрана → активная вкладка
  const active: Tab["key"] =
    state.currentScreen === "billing"
      ? "profile"
      : state.currentScreen === "settings"
      ? "settings"
      : "main";

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        padding:
          "10px 16px max(calc(env(safe-area-inset-bottom) + 10px), 18px)",
        background: "rgba(10,7,5,0.78)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        gap: 4,
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
              background: "transparent",
              border: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "6px 0",
              cursor: "pointer",
              color: isActive ? YELLOW : MUTED,
              fontFamily: "inherit",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.02em",
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
