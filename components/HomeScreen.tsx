"use client";

import { hapticImpact, hapticSelection } from "../lib/telegram";

// Картинка уже обрезана до содержимого экрана (bezel удалён): 610×1140.
const IMG_W = 610;
const IMG_H = 1140;

const HOTSPOTS: Array<{
  id: string;
  x: number; y: number; w: number; h: number;
  onClick: () => void;
}> = [
  { id: "card",        x:  40, y: 395, w: 540, h: 360, onClick: () => hapticSelection() },
  { id: "pill-plan",   x:  40, y: 780, w: 175, h: 80,  onClick: () => hapticSelection() },
  { id: "pill-rev",    x: 220, y: 780, w: 180, h: 80,  onClick: () => hapticSelection() },
  { id: "pill-tariff", x: 395, y: 780, w: 185, h: 80,  onClick: () => hapticSelection() },
  { id: "cta",         x:  30, y: 870, w: 555, h: 115, onClick: () => hapticImpact("medium") },
  { id: "pro",         x: 480, y: 1050, w: 90, h: 70,  onClick: () => hapticSelection() },
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
        background: "#0A0608",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Контейнер совпадает с пропорциями картинки — никаких обрезаний контента. */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "100%",
          aspectRatio: `${IMG_W} / ${IMG_H}`,
          maxHeight: "100%",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/home-mockup.jpg"
          alt=""
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
        {HOTSPOTS.map((h) => (
          <button
            key={h.id}
            onClick={h.onClick}
            aria-label={h.id}
            style={{
              position: "absolute",
              left:   `${(h.x / IMG_W) * 100}%`,
              top:    `${(h.y / IMG_H) * 100}%`,
              width:  `${(h.w / IMG_W) * 100}%`,
              height: `${(h.h / IMG_H) * 100}%`,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          />
        ))}
      </div>
    </div>
  );
}
