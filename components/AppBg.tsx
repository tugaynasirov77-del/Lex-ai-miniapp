"use client";

/**
 * Статичный фон приложения. Живёт ВНЕ AnimatePresence,
 * не перерисовывается при смене экранов — burgundy/purple glow
 * остаётся фиксированным, плывут только foreground-экраны.
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
          "radial-gradient(140% 80% at 100% 100%, rgba(178,30,60,0.45) 0%, rgba(178,30,60,0) 55%)," +
          "radial-gradient(110% 70% at 0% 100%, rgba(96,18,80,0.32) 0%, rgba(96,18,80,0) 60%)," +
          "#0A0608",
      }}
    />
  );
}
