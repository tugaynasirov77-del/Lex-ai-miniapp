"use client";

import { useId } from "react";

/**
 * Фирменный знак LEX — скруглённый треугольник со стилизованной «A»
 * в IG-градиенте (фиолетовый → розовый → оранжевый).
 */
export default function LexLogo({ size = 48 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  const gid = `lexlogo-${id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="20" y1="14" x2="84" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A24FD6" />
          <stop offset="0.5" stopColor="#E84B91" />
          <stop offset="1" stopColor="#F88A4A" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${gid})`} strokeWidth="11" strokeLinejoin="round" strokeLinecap="round">
        {/* внешний скруглённый треугольник */}
        <path d="M50 17 L83 83 L17 83 Z" />
        {/* внутренняя левая «нога» A */}
        <path d="M45 41 L31 73" />
        {/* внутренняя правая короткая «нога» A */}
        <path d="M58 57 L66 73" />
      </g>
    </svg>
  );
}
