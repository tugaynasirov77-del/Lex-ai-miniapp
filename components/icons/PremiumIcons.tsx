"use client";

/**
 * LEX AI Premium Icon System
 * ─────────────────────────
 * Soft-clay / glossy 3D иконки в едином визуальном языке.
 *
 * Структура каждой:
 *   • Squircle-фон с градиентом в цвет акцента (диагональ 135°)
 *   • Glossy highlight в верхней половине (белый, opacity 18-28%)
 *   • Тонкий бордер в цвет акцента
 *   • Внутренняя тень для объёма
 *   • Центральный glyph (белый или светлый тон)
 *
 * Размер по умолчанию 48. Иконка автоматически масштабируется (viewBox 48x48).
 *
 * Использование:
 *   <PremiumBriefcaseIcon size={42} />
 *   <PremiumIcon name="briefcase" size={42} />  // через factory
 */

import React from "react";

// ─── Палитра акцентов ───
export const ACCENTS = {
  purple: { from: "#C68BEB", mid: "#A24FD6", to: "#7A2BB8" },
  pink:   { from: "#F47CB0", mid: "#E84B91", to: "#C3206E" },
  orange: { from: "#FBB58C", mid: "#F88A4A", to: "#D2691E" },
  green:  { from: "#7AE3A8", mid: "#4FD489", to: "#2EA964" },
  blue:   { from: "#7CC2F8", mid: "#3A8DDB", to: "#1A5FAA" },
  yellow: { from: "#FFE07A", mid: "#FFC83D", to: "#D39A00" },
  red:    { from: "#F08C92", mid: "#E84B5B", to: "#B41E2E" },
  cyan:   { from: "#86E5E7", mid: "#3CB8BB", to: "#16868A" },
} as const;

export type AccentName = keyof typeof ACCENTS;

// ─── База — squircle с градиентом + glossy ───
function IconBase({
  size = 48,
  accent,
  uid,
  children,
}: {
  size?: number;
  accent: AccentName;
  uid: string;
  children: React.ReactNode;
}) {
  const c = ACCENTS[accent];
  const bgId = `lex-${uid}-bg`;
  const glossId = `lex-${uid}-gloss`;
  const innerId = `lex-${uid}-inner`;

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={bgId} x1="6" y1="2" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={c.from} />
          <stop offset="0.55" stopColor={c.mid} />
          <stop offset="1" stopColor={c.to} />
        </linearGradient>
        <linearGradient id={glossId} x1="24" y1="2" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={innerId} cx="24" cy="42" r="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#000000" stopOpacity="0.25" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Тень под иконкой */}
      <rect x="3" y="6" width="42" height="42" rx="13" fill={c.to} opacity="0.22" />

      {/* Основная плашка-squircle */}
      <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${bgId})`} />

      {/* Glossy highlight сверху */}
      <path
        d="M2 15A13 13 0 0115 2h18A13 13 0 0146 15v3c0 4-4 6-8 6H10c-4 0-8-2-8-6v-3z"
        fill={`url(#${glossId})`}
      />

      {/* Внутренняя тень снизу для объёма */}
      <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${innerId})`} />

      {/* Бордер */}
      <rect x="2.5" y="2.5" width="43" height="43" rx="12.5" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="1" />

      {/* Центральный glyph */}
      {children}
    </svg>
  );
}

// Универсальные хелперы для glyph'ов
const W = "#FFFFFF";
const Wsoft = "rgba(255,255,255,0.85)";
const Wghost = "rgba(255,255,255,0.55)";

// ─── НИШИ (шаг 1) ───

export function PremiumBriefcaseIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="purple" uid="brief">
      <g transform="translate(12,14)">
        <rect x="0" y="3" width="24" height="17" rx="3.2" fill={W} />
        <path d="M9 3V1.6c0-.9.7-1.6 1.6-1.6h2.8c.9 0 1.6.7 1.6 1.6V3" stroke={W} strokeWidth="2.2" strokeLinecap="round" />
        <rect x="0" y="3" width="24" height="17" rx="3.2" fill="url(#brief-fade)" />
        <rect x="9" y="9.5" width="6" height="4" rx="1" fill="#A24FD6" />
        <path d="M0 10h24" stroke="#A24FD6" strokeWidth="1" opacity="0.35" />
      </g>
      <defs>
        <linearGradient id="brief-fade" x1="12" y1="3" x2="12" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E8D0F5" />
        </linearGradient>
      </defs>
    </IconBase>
  );
}

export function PremiumMegaphoneIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="pink" uid="meg">
      <g transform="translate(11,12)">
        <path d="M2 11V13a2 2 0 002 2h2l14 7V2L6 9H4a2 2 0 00-2 2z" fill={W} />
        <path d="M20 7a5 5 0 010 9" stroke={W} strokeWidth="2" strokeLinecap="round" />
        <path d="M23 4a9 9 0 010 16" stroke={Wghost} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="12" r="1.2" fill="#E84B91" />
      </g>
    </IconBase>
  );
}

export function PremiumDumbbellIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="green" uid="dumb">
      <g transform="translate(9,18)">
        <rect x="0" y="2" width="4.5" height="9" rx="1.4" fill={W} />
        <rect x="25.5" y="2" width="4.5" height="9" rx="1.4" fill={W} />
        <rect x="4.5" y="4" width="4" height="5" rx="1" fill={W} />
        <rect x="21.5" y="4" width="4" height="5" rx="1" fill={W} />
        <rect x="8.5" y="5.5" width="13" height="2.5" rx="1" fill={W} />
        <rect x="0" y="2" width="4.5" height="9" rx="1.4" fill="url(#dumb-shine)" />
        <rect x="25.5" y="2" width="4.5" height="9" rx="1.4" fill="url(#dumb-shine)" />
      </g>
      <defs>
        <linearGradient id="dumb-shine" x1="0" y1="0" x2="0" y2="11" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#CBEED9" />
        </linearGradient>
      </defs>
    </IconBase>
  );
}

export function PremiumBrainIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="purple" uid="brain">
      <g transform="translate(11,11)">
        <path
          d="M9 2a5 5 0 00-5 5v.5A4 4 0 002 11c0 1.5.8 2.8 2 3.5A4.5 4.5 0 008 19a5 5 0 005 2V2c-1.2 0-2.9 0-4 0z"
          fill={W}
        />
        <path
          d="M17 2a5 5 0 015 5v.5a4 4 0 012 3.5c0 1.5-.8 2.8-2 3.5A4.5 4.5 0 0118 19a5 5 0 01-5 2V2c1.2 0 2.9 0 4 0z"
          fill={Wsoft}
        />
        <path d="M13 2v19" stroke="#A24FD6" strokeWidth="1.5" opacity="0.4" />
        <circle cx="7" cy="8" r="1" fill="#A24FD6" opacity="0.6" />
        <circle cx="19" cy="8" r="1" fill="#A24FD6" opacity="0.6" />
        <circle cx="6.5" cy="13" r="0.8" fill="#A24FD6" opacity="0.5" />
        <circle cx="19.5" cy="13" r="0.8" fill="#A24FD6" opacity="0.5" />
      </g>
    </IconBase>
  );
}

export function PremiumPalmIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="cyan" uid="palm">
      <g transform="translate(12,10)">
        <path d="M12 8v18" stroke={W} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M12 8C9 4 5 4 2 6c1.2-.3 3 0 4.5 1M12 8c3-4 7-4 10-2-1.2-.3-3 0-4.5 1" stroke={W} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 8C8 6 4 8 3 12c.8-1.4 2-2 4-2M12 8c4-2 8 0 9 4-.8-1.4-2-2-4-2" stroke={W} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="7" r="2" fill={W} />
        <circle cx="12" cy="7" r="1" fill="#3CB8BB" />
      </g>
    </IconBase>
  );
}

export function PremiumDotsIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="blue" uid="dots">
      <g transform="translate(10,20)">
        <circle cx="4" cy="4" r="2.6" fill={W} />
        <circle cx="14" cy="4" r="2.6" fill={W} />
        <circle cx="24" cy="4" r="2.6" fill={W} />
      </g>
    </IconBase>
  );
}

// ─── АУДИТОРИЯ (шаг 2) ───

export function PremiumUsersIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="pink" uid="users">
      <g transform="translate(8,12)">
        <circle cx="11" cy="6" r="4.5" fill={W} />
        <path d="M2 22c0-4.5 4-7.5 9-7.5s9 3 9 7.5" fill={W} />
        <circle cx="22" cy="5" r="3.5" fill={Wsoft} />
        <path d="M22 18c4 0 6.5-2 7-5-1 0-2.5 0-4 1" fill={Wsoft} />
      </g>
    </IconBase>
  );
}

export function PremiumGradCapIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="purple" uid="cap">
      <g transform="translate(8,14)">
        <path d="M16 1 L1 7 L16 13 L31 7 Z" fill={W} />
        <path d="M5 10v6c0 2.5 5 4 11 4s11-1.5 11-4v-6" stroke={W} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M5 10v6c0 2.5 5 4 11 4s11-1.5 11-4v-6L16 14z" fill={Wsoft} />
        <path d="M31 7v8" stroke={W} strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="31" cy="17" r="1.5" fill="#FFC83D" />
      </g>
    </IconBase>
  );
}

export function PremiumRocketIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="orange" uid="rocket">
      <g transform="translate(10,10)">
        <path d="M16 1c5 1 8 4 9 9-1.5 2.5-3.5 4.5-6 6.5l-3.5 3.5-6-6 3.5-3.5C15 8 16 4.5 16 1z" fill={W} />
        <circle cx="17" cy="9" r="2" fill="#F88A4A" />
        <path d="M11 17l-3.5 3.5a2.5 2.5 0 11-3.5-3.5L7.5 14" fill={Wsoft} />
        <path d="M9 23c-1.5 1-3.5 1.3-5 .8.7-1.7 1-3.5 2-5" stroke={W} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="22" cy="6" r="1" fill="#FFE07A" />
        <circle cx="6" cy="22" r="1" fill="#FFE07A" />
      </g>
    </IconBase>
  );
}

export function PremiumReelIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="pink" uid="reel">
      <g transform="translate(10,9)">
        <rect x="0" y="5" width="28" height="22" rx="6" fill={W} />
        <path d="M0 10h28" stroke="#E84B91" strokeWidth="1.5" opacity="0.4" />
        <path d="M6 5l3 5M14 5l3 5M22 5l3 5" stroke="#E84B91" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
        <circle cx="14" cy="18.5" r="5" fill="#FCEAF2" />
        <path d="M12.5 16l4 2.5-4 2.5z" fill="#E84B91" />
      </g>
    </IconBase>
  );
}

export function PremiumManIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="blue" uid="man">
      <g transform="translate(11,10)">
        <circle cx="13" cy="9" r="6" fill={W} />
        <path d="M2 27c0-5.5 5-9 11-9s11 3.5 11 9" fill={W} />
        <path d="M7 5c1-2 4-3 6-3s5 1 6 3" stroke={W} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="10" cy="9" r="1" fill="#1A5FAA" />
        <circle cx="16" cy="9" r="1" fill="#1A5FAA" />
        <path d="M11 13c1 .8 3 .8 4 0" stroke="#1A5FAA" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </IconBase>
  );
}

export function PremiumWomanIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="pink" uid="woman">
      <g transform="translate(11,9)">
        <path d="M13 0c-5 0-8 2-8 6 0 0-1 1-2 3" stroke={W} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M13 0c5 0 8 2 8 6 0 0 1 1 2 3" stroke={W} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="13" cy="10" r="6" fill={W} />
        <path d="M2 28c0-5.5 5-9 11-9s11 3.5 11 9" fill={W} />
        <circle cx="10" cy="10" r="1" fill="#C3206E" />
        <circle cx="16" cy="10" r="1" fill="#C3206E" />
        <path d="M11 14c1 .8 3 .8 4 0" stroke="#C3206E" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="6" cy="13" r="1.2" fill="#FFC83D" />
        <circle cx="20" cy="13" r="1.2" fill="#FFC83D" />
      </g>
    </IconBase>
  );
}

// ─── СТИЛЬ ПОДАЧИ (шаг 3) ───

export function PremiumFlameIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="orange" uid="flame">
      <g transform="translate(12,8)">
        <path
          d="M12 0c.5 4 3 6 5 8.5 2 2.4 3 5 3 8a8 8 0 11-16 0c0-3 1.5-5.4 3-7 .5 1.5 1.5 2.5 3 3C8 9 10 5 12 0z"
          fill={W}
        />
        <path
          d="M12 12c1.2 1.3 1.6 3 1 4.5-.6 1.4-2 2.2-3.5 2 0 2 1.5 3.5 4 3.5s4-1.6 4-3.8c0-2-1.5-3.7-2.5-5-.5.8-1.3 1.2-2 1-.5-.2-.8-.6-1-2z"
          fill="#F88A4A"
        />
      </g>
    </IconBase>
  );
}

export function PremiumWandIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="pink" uid="wand">
      <g transform="translate(10,10)">
        <rect x="3" y="18" width="3.5" height="14" rx="1.5" transform="rotate(-45 4.75 25)" fill={W} />
        <path d="M20 0l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" fill={W} />
        <path d="M24 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" fill={Wsoft} />
        <path d="M6 6l.6 2 2 .6-2 .6L6 11l-.6-1.8-2-.6 2-.6L6 6z" fill={Wghost} />
        <circle cx="20" cy="5" r="1.5" fill="#FFFFFF" opacity="0.8" />
      </g>
    </IconBase>
  );
}

export function PremiumSmileIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="yellow" uid="smile">
      <g transform="translate(9,9)">
        <circle cx="15" cy="15" r="14" fill={W} />
        <circle cx="10" cy="12" r="1.8" fill="#D39A00" />
        <circle cx="20" cy="12" r="1.8" fill="#D39A00" />
        <path d="M8 18c1.5 2.5 4 4 7 4s5.5-1.5 7-4" stroke="#D39A00" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="10" cy="11" r="0.6" fill="#FFFFFF" opacity="0.9" />
        <circle cx="20" cy="11" r="0.6" fill="#FFFFFF" opacity="0.9" />
      </g>
    </IconBase>
  );
}

export function PremiumDiamondIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="cyan" uid="diam">
      <g transform="translate(8,10)">
        <path d="M8 0h16l8 9-16 19L0 9z" fill={W} />
        <path d="M0 9h32M10 0l6 12L10 0zM22 0l-6 12L22 0z" stroke="#3CB8BB" strokeWidth="1.5" strokeLinejoin="round" opacity="0.55" />
        <path d="M16 12l-6-12 6 4 6-4z" fill="#86E5E7" opacity="0.6" />
        <path d="M12 4l2 1.5M22 4l-2 1.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
      </g>
    </IconBase>
  );
}

export function PremiumMasksIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="purple" uid="masks">
      <g transform="translate(7,12)">
        <path d="M0 5C1 1 5 0 9 1c4 .8 5.5 4.5 4.5 9-1 4.5-4 7-7 6-3-1-6-4-6-7.5C.5 7 0 6 0 5z" fill={W} />
        <circle cx="4.5" cy="7" r="1.2" fill="#7A2BB8" />
        <circle cx="9" cy="7.5" r="1.2" fill="#7A2BB8" />
        <path d="M5 11c1 .6 2.5.7 3.5.2" stroke="#7A2BB8" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M34 8c-1-4-5-5-9-4-4 .8-5.5 4.5-4.5 9 1 4.5 4 7 7 6 3-1 6-4 6-7.5.5-1.5 1-2.5.5-3.5z" fill={Wsoft} />
        <circle cx="29.5" cy="10" r="1.2" fill="#7A2BB8" />
        <circle cx="25" cy="10.5" r="1.2" fill="#7A2BB8" />
        <path d="M25 14c1 .6 2.5.7 3.5.2" stroke="#7A2BB8" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    </IconBase>
  );
}

// ─── ЦЕЛЬ (шаг 4) ───

export function PremiumBarChartIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="green" uid="chart">
      <g transform="translate(9,10)">
        <path d="M0 30h30" stroke={W} strokeWidth="2.4" strokeLinecap="round" />
        <rect x="3" y="18" width="5" height="11" rx="1.5" fill={W} opacity="0.85" />
        <rect x="11" y="11" width="5" height="18" rx="1.5" fill={W} />
        <rect x="19" y="4" width="5" height="25" rx="1.5" fill={Wsoft} />
        <path d="M3 15l5-5 5 2 8-7" stroke={W} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 5h4v4" stroke={W} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </IconBase>
  );
}

export function PremiumBagIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="orange" uid="bag">
      <g transform="translate(11,9)">
        <path d="M3 8h20l-1.5 18a3 3 0 01-3 2.7H7.5a3 3 0 01-3-2.7L3 8z" fill={W} />
        <path d="M8 8V6a5 5 0 0110 0v2" stroke={W} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M8 14c.5 1.5 2 2.5 5 2.5s4.5-1 5-2.5" stroke="#D2691E" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
      </g>
    </IconBase>
  );
}

export function PremiumStarIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="yellow" uid="star">
      <g transform="translate(7,9)">
        <path d="M17 0l5 11 12 2-9 8 2 12-10-5.5L7 33l2-12-9-8 12-2z" fill={W} />
        <path d="M17 5l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#FFC83D" opacity="0.8" />
      </g>
    </IconBase>
  );
}

// ─── ОБЩИЕ ───

export function PremiumTargetIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="purple" uid="target">
      <g transform="translate(8,8)">
        <circle cx="16" cy="16" r="15" fill={W} />
        <circle cx="16" cy="16" r="10" fill="#A24FD6" opacity="0.85" />
        <circle cx="16" cy="16" r="6" fill="#FFFFFF" />
        <circle cx="16" cy="16" r="2.5" fill="#A24FD6" />
      </g>
    </IconBase>
  );
}

export function PremiumChatIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="cyan" uid="chat">
      <g transform="translate(9,12)">
        <path d="M3 0h24a3 3 0 013 3v14a3 3 0 01-3 3H11l-7 6v-6H3a3 3 0 01-3-3V3a3 3 0 013-3z" fill={W} />
        <circle cx="9" cy="10" r="1.6" fill="#3CB8BB" />
        <circle cx="15" cy="10" r="1.6" fill="#3CB8BB" />
        <circle cx="21" cy="10" r="1.6" fill="#3CB8BB" />
      </g>
    </IconBase>
  );
}

export function PremiumSparkleIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="pink" uid="spark">
      <g transform="translate(10,10)">
        <path d="M14 0l2.5 8L24 10l-7.5 2L14 20l-2.5-8L4 10l7.5-2z" fill={W} />
        <path d="M22 18l1 2.5 2.5 1-2.5 1L22 25l-1-2.5-2.5-1 2.5-1z" fill={Wsoft} />
        <path d="M4 18l.8 2 2 .8-2 .8L4 24l-.8-2-2-.8 2-.8z" fill={Wghost} />
      </g>
    </IconBase>
  );
}

export function PremiumBoltIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="yellow" uid="bolt">
      <g transform="translate(14,8)">
        <path d="M11 0L1 17c-.4.7 0 1.5.8 1.5h6l-1.3 12c-.1.9 1 1.5 1.6.8L19 12c.4-.7 0-1.5-.8-1.5h-6l1-9.5c.1-.9-1-1.5-1.6-.5z" fill={W} />
      </g>
    </IconBase>
  );
}

export function PremiumCrownIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="yellow" uid="crown">
      <g transform="translate(7,12)">
        <path d="M2 20l2-15 7 7 4-10 4 10 7-7 2 15H2z" fill={W} />
        <path d="M2 23h30" stroke={W} strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="4" cy="5" r="1.5" fill="#FFFFFF" />
        <circle cx="29" cy="5" r="1.5" fill="#FFFFFF" />
        <circle cx="16" cy="0" r="1.5" fill="#FFFFFF" />
        <circle cx="17" cy="14" r="1.5" fill="#D39A00" />
      </g>
    </IconBase>
  );
}

export function PremiumBellIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="orange" uid="bell">
      <g transform="translate(12,9)">
        <path d="M3 12V8a9 9 0 0118 0v4l2.5 5H.5L3 12z" fill={W} />
        <path d="M8.5 22a3.5 3.5 0 007 0" fill={W} />
      </g>
    </IconBase>
  );
}

export function PremiumGlobeIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="blue" uid="globe">
      <g transform="translate(9,9)">
        <circle cx="15" cy="15" r="14" fill={W} />
        <path d="M1 15h28M15 1c4 4 6 9 6 14s-2 10-6 14c-4-4-6-9-6-14s2-10 6-14z" stroke="#1A5FAA" strokeWidth="1.8" />
        <circle cx="15" cy="15" r="14" fill="url(#globe-fade)" opacity="0.6" />
      </g>
      <defs>
        <linearGradient id="globe-fade" x1="0" y1="0" x2="0" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#7CC2F8" />
        </linearGradient>
      </defs>
    </IconBase>
  );
}

export function PremiumTrashIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="red" uid="trash">
      <g transform="translate(11,9)">
        <rect x="2" y="6" width="22" height="22" rx="3" fill={W} />
        <rect x="0" y="4" width="26" height="3.5" rx="1.5" fill={W} />
        <rect x="8" y="0" width="10" height="4.5" rx="1.5" fill={W} />
        <path d="M8 12v12M13 12v12M18 12v12" stroke="#B41E2E" strokeWidth="2" strokeLinecap="round" />
      </g>
    </IconBase>
  );
}

export function PremiumRestartIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="purple" uid="restart">
      <g transform="translate(10,10)">
        <path d="M3 14a11 11 0 1020-6" stroke={W} strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M20 0v8h-8" stroke={W} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </IconBase>
  );
}

export function PremiumGearIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="blue" uid="gear">
      <g transform="translate(8,8)">
        <path d="M16 2l1.5 3.5L21 4l-1.5 3.5L23 9l-3.5 1.5L21 14l-3.5-1.5L16 16l-1.5-3.5L11 14l1.5-3.5L9 9l3.5-1.5L11 4l3.5 1.5z" fill={W} />
        <circle cx="16" cy="16" r="14" fill={W} />
        <circle cx="16" cy="16" r="6" fill="#3A8DDB" />
        <circle cx="16" cy="16" r="3" fill="#FFFFFF" />
      </g>
    </IconBase>
  );
}

export function PremiumLinkIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="pink" uid="link">
      <g transform="translate(11,11)">
        <path d="M13 5l-1.5-1.5a5 5 0 00-7 7L6 12" stroke={W} strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M13 21l1.5 1.5a5 5 0 007-7L20 14" stroke={W} strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M9 17l8-8" stroke={W} strokeWidth="3" strokeLinecap="round" />
      </g>
    </IconBase>
  );
}

export function PremiumClockIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="green" uid="clock">
      <g transform="translate(8,8)">
        <circle cx="16" cy="16" r="15" fill={W} />
        <circle cx="16" cy="16" r="11" fill="#FFFFFF" stroke="#2EA964" strokeWidth="2" />
        <path d="M16 8v8l5 3" stroke="#2EA964" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </IconBase>
  );
}

export function PremiumVideoIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="purple" uid="video">
      <g transform="translate(8,12)">
        <rect x="0" y="0" width="22" height="22" rx="4" fill={W} />
        <path d="M9 6l9 5-9 5z" fill="#A24FD6" />
        <rect x="24" y="4" width="8" height="14" rx="2" fill={W} />
      </g>
    </IconBase>
  );
}

export function PremiumTrendIcon({ size = 48 }: { size?: number }) {
  return (
    <IconBase size={size} accent="green" uid="trend">
      <g transform="translate(9,12)">
        <path d="M2 22l8-8 5 5 11-13" stroke={W} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M19 6h7v7" stroke={W} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="2" cy="22" r="2" fill={W} />
        <circle cx="10" cy="14" r="2" fill={W} />
        <circle cx="15" cy="19" r="2" fill={W} />
      </g>
    </IconBase>
  );
}

// ─── FACTORY (по имени) ───

export const PREMIUM_ICONS = {
  briefcase: PremiumBriefcaseIcon,
  megaphone: PremiumMegaphoneIcon,
  dumbbell: PremiumDumbbellIcon,
  brain: PremiumBrainIcon,
  palm: PremiumPalmIcon,
  dots: PremiumDotsIcon,
  users: PremiumUsersIcon,
  gradcap: PremiumGradCapIcon,
  rocket: PremiumRocketIcon,
  reel: PremiumReelIcon,
  man: PremiumManIcon,
  woman: PremiumWomanIcon,
  flame: PremiumFlameIcon,
  wand: PremiumWandIcon,
  smile: PremiumSmileIcon,
  diamond: PremiumDiamondIcon,
  masks: PremiumMasksIcon,
  barchart: PremiumBarChartIcon,
  bag: PremiumBagIcon,
  star: PremiumStarIcon,
  target: PremiumTargetIcon,
  chat: PremiumChatIcon,
  sparkle: PremiumSparkleIcon,
  bolt: PremiumBoltIcon,
  crown: PremiumCrownIcon,
  bell: PremiumBellIcon,
  globe: PremiumGlobeIcon,
  trash: PremiumTrashIcon,
  restart: PremiumRestartIcon,
  gear: PremiumGearIcon,
  link: PremiumLinkIcon,
  clock: PremiumClockIcon,
  video: PremiumVideoIcon,
  trend: PremiumTrendIcon,
} as const;

export type PremiumIconName = keyof typeof PREMIUM_ICONS;

export function PremiumIcon({ name, size = 48 }: { name: PremiumIconName; size?: number }) {
  const Cmp = PREMIUM_ICONS[name];
  return <Cmp size={size} />;
}
