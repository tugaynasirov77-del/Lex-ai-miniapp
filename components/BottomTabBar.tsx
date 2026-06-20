"use client";

import { useEffect, useState } from "react";
import { useFlow, useFlowActions } from "../flow";
import type { ScreenKey } from "../flow/types";

const ACTIVE = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.55)";

type IconCmp = (p: { active: boolean }) => React.ReactNode;
type Tab = {
  key: "main" | "create" | "plan" | "profile";
  label: string;
  Icon: IconCmp;
  screen: ScreenKey;
};

const TABS: Tab[] = [
  { key: "main", label: "Главная", Icon: HomeIcon, screen: "home" },
  { key: "create", label: "Создать", Icon: PlusIcon, screen: "create-hub" },
  { key: "plan", label: "План", Icon: CalendarIcon, screen: "plan" },
  { key: "profile", label: "Профиль", Icon: UserIcon, screen: "dashboard" },
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
  // На онбординге (welcome/анкета) таб-бар скрыт — линейный экран без навигации.
  if (cs === "welcome" || cs === "create-project" || cs === "onboarding-wizard") return null;
  // Настройки/биллинг живут внутри Профиля → подсвечиваем «Профиль».
  const active: Tab["key"] =
    cs === "home"
      ? "main"
      : cs === "create-hub" || cs === "tools" || cs === "project"
      ? "create"
      : cs === "plan"
      ? "plan"
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
        background: "rgba(16,16,24,0.66)",
        backdropFilter: "blur(36px) saturate(180%)",
        WebkitBackdropFilter: "blur(36px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 28,
        boxShadow: "0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset",
        display: "flex",
        alignItems: "center",
        gap: 4,
        transform: keyboardOpen ? "translateY(150%)" : "translateY(0)",
        transition: "transform 180ms ease-out",
        pointerEvents: keyboardOpen ? "none" : "auto",
      }}
    >
      {TABS.map((t) => {
        const isActive = active === t.key;
        const onTap = () => { actions.navigate(t.screen); };

        return (
          <button
            key={t.key}
            onClick={onTap}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "8px 0",
              cursor: "pointer",
              color: isActive ? ACTIVE : MUTED,
              fontFamily: "inherit",
              fontSize: 10.5,
              fontWeight: isActive ? 700 : 600,
              letterSpacing: "0.02em",
              transition: "color 220ms ease",
            }}
          >
            <div
              key={isActive ? "on" : "off"}
              style={{
                width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                animation: isActive ? "lex-tab-fade 220ms ease-out" : "none",
              }}
            >
              <t.Icon active={isActive} />
            </div>
            {t.label}
          </button>
        );
      })}
      <style>{`
        @keyframes lex-tab-fade {
          0% { transform: scale(0.92); opacity: 0.55; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const FILL_TR: React.CSSProperties = { transition: "fill 240ms ease, stroke 240ms ease" };

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M3 11.5L12 4l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-8.5z"
        style={FILL_TR}
        fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  );
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <circle style={FILL_TR} cx="12" cy="8" r="4" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8"/>
      <path style={FILL_TR} d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PlusIcon({ active: _active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <circle style={FILL_TR} cx="12" cy="12" r="9" fill={_active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" />
      <path style={FILL_TR} d="M12 8.5v7M8.5 12h7" stroke={_active ? "rgba(16,16,24,0.9)" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <rect style={FILL_TR} x="3.5" y="5" width="17" height="15" rx="2.5" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" />
      <path style={FILL_TR} d="M3.5 9.5h17" stroke={active ? "rgba(16,16,24,0.9)" : "currentColor"} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
