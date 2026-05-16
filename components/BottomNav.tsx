"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { hapticSelection } from "../lib/telegram";

function HomeIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={active ? "url(#bnNavGrad)" : "currentColor"}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id="bnNavGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F0A020" />
          <stop offset="100%" stopColor="#D05020" />
        </linearGradient>
      </defs>
      <path d="M3 9.5L12 3L21 9.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}
function UsersIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={active ? "#F0A020" : "currentColor"}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
      <path d="M16 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.87" />
    </svg>
  );
}
function FoldersIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={active ? "#F0A020" : "currentColor"}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}
function ClockIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={active ? "#F0A020" : "currentColor"}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}
function ChartIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={active ? "#F0A020" : "currentColor"}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19V11M12 19V6M19 19V14" />
    </svg>
  );
}

const TABS = [
  { href: "/",          label: "главная",  Icon: HomeIcon    },
  { href: "/team",      label: "команда",  Icon: UsersIcon   },
  { href: "/projects",  label: "проекты",  Icon: FoldersIcon },
  { href: "/history",   label: "история",  Icon: ClockIcon   },
  { href: "/analytics", label: "статы",    Icon: ChartIcon   },
];

export default function BottomNav() {
  const path = usePathname();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

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

  return (
    <nav
      style={{
        position: "fixed",
        left: "50%",
        transform: keyboardOpen ? "translate(-50%, 100%)" : "translateX(-50%)",
        bottom: 0,
        width: "100%",
        maxWidth: 390,
        display: "flex",
        justifyContent: "space-around",
        padding: "13px 0 max(20px, env(safe-area-inset-bottom))",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        zIndex: 50,
        background: "rgba(10,7,5,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        transition: "transform 180ms ease-out",
        pointerEvents: keyboardOpen ? "none" : "auto",
      }}
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => hapticSelection()}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "0 4px",
              color: "rgba(255,255,255,0.3)",
              textDecoration: "none",
              position: "relative",
            }}
            aria-label={label}
          >
            <Icon active={active} />
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 300,
                fontSize: 10,
                letterSpacing: "0.04em",
                color: "rgba(255,255,255,0.5)",
                ...(active
                  ? {
                      background: "linear-gradient(135deg, #F0A020, #D05020)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }
                  : {}),
              }}
            >
              {label}
            </span>
            {active && (
              <div
                style={{
                  width: 14,
                  height: 2,
                  borderRadius: 1,
                  background: "linear-gradient(90deg, #F0A020, #D05020)",
                }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
