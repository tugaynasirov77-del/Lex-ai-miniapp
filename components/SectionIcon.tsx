import type { ReactNode } from "react";

type IconKey = "analytics" | "scout" | "strategy" | "plan" | "drafts" | "community";

const PATHS: Record<IconKey, ReactNode> = {
  analytics: (
    <>
      <path d="M5 19V11M12 19V6M19 19V14" />
    </>
  ),
  scout: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4-4" />
    </>
  ),
  strategy: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  plan: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>
  ),
  drafts: (
    <>
      <path d="M4 20l4-1 11-11a2.5 2.5 0 00-3.5-3.5l-11 11-1 4z" />
      <path d="M14 6l3.5 3.5" />
    </>
  ),
  community: (
    <>
      <path d="M21 15a2 2 0 01-2 2H8l-4 4V6a2 2 0 012-2h13a2 2 0 012 2z" />
    </>
  ),
};

export default function SectionIcon({ name, size = 18 }: { name: IconKey; size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size + 4, height: size + 4 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="url(#sectionIconGrad)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        shapeRendering="geometricPrecision"
      >
        <defs>
          <linearGradient id="sectionIconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F0A020" />
            <stop offset="100%" stopColor="#D05020" />
          </linearGradient>
        </defs>
        {PATHS[name]}
      </svg>
    </span>
  );
}
