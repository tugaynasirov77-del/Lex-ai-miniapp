"use client";

/**
 * Статичный фон приложения. Живёт ВНЕ AnimatePresence,
 * не перерисовывается при смене экранов. База #0B0B11 совпадает с фоном
 * экранов — на кросс-фейде переходов ничего не «мелькает». Лёгкий
 * IG-glow (pink/purple) для глубины.
 */
export default function AppBg() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background:
          "radial-gradient(120% 70% at 100% 100%, rgba(232,75,145,0.10) 0%, rgba(232,75,145,0) 55%)," +
          "radial-gradient(110% 70% at 0% 100%, rgba(162,79,214,0.10) 0%, rgba(162,79,214,0) 60%)," +
          "#0B0B11",
      }}
    />
  );
}
