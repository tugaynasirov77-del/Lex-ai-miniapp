"use client";

import { hapticImpact, hapticSelection } from "../lib/telegram";

// Координаты кликабельных зон в координатах исходной картинки (720×1280).
const IMG_W = 720;
const IMG_H = 1280;
// Кроп bezel (картинка показывает рамку телефона — убираем её зумом).
const ZOOM = 1.15;

const HOTSPOTS: Array<{
  id: string;
  x: number; y: number; w: number; h: number;
  onClick: () => void;
}> = [
  { id: "card",        x:  60, y: 530,  w: 600, h: 280, onClick: () => hapticSelection() },
  { id: "pill-plan",   x:  60, y: 850,  w: 230, h: 90,  onClick: () => hapticSelection() },
  { id: "pill-rev",    x: 290, y: 850,  w: 230, h: 90,  onClick: () => hapticSelection() },
  { id: "pill-tariff", x: 520, y: 850,  w: 230, h: 90,  onClick: () => hapticSelection() },
  { id: "cta",         x:  50, y: 970,  w: 620, h: 130, onClick: () => hapticImpact("medium") },
  { id: "pro",         x: 580, y: 1110, w: 100, h: 70,  onClick: () => hapticSelection() },
];

export default function HomeScreen() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: "calc(-1 * (env(safe-area-inset-bottom) + 78px))",
        overflow: "hidden",
        background: "#0A0608",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/home-mockup.jpg"
        alt=""
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: `${ZOOM * 100}%`,
          height: `${ZOOM * 100}%`,
          transform: "translate(-50%, -50%)",
          objectFit: "cover",
          objectPosition: "center",
          pointerEvents: "none",
          userSelect: "none",
        }}
      />

      {/* Кликабельные зоны поверх фото */}
      <div style={{ position: "absolute", inset: 0 }}>
        {HOTSPOTS.map((h) => {
          // Пересчёт координат с учётом ZOOM (изображение увеличено и центрировано).
          const left   = 50 + ((h.x + h.w / 2) / IMG_W - 0.5) * 100 * ZOOM - (h.w / IMG_W) * 50 * ZOOM;
          const top    = 50 + ((h.y + h.h / 2) / IMG_H - 0.5) * 100 * ZOOM - (h.h / IMG_H) * 50 * ZOOM;
          const width  = (h.w / IMG_W) * 100 * ZOOM;
          const height = (h.h / IMG_H) * 100 * ZOOM;
          return (
            <button
              key={h.id}
              onClick={h.onClick}
              aria-label={h.id}
              style={{
                position: "absolute",
                left:   `${left}%`,
                top:    `${top}%`,
                width:  `${width}%`,
                height: `${height}%`,
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
