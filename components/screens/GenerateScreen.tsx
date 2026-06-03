"use client";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";

type Props = {
  onBack: () => void;
};

export default function GenerateScreen({ onBack: _onBack }: Props) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: "max(calc(env(safe-area-inset-top) + 64px), 96px) 22px " +
          "max(calc(env(safe-area-inset-bottom) + 32px), 48px)",
        textAlign: "center",
      }}
    >
      {/* Indeterminate pulse */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 999,
          background: YELLOW,
          boxShadow: `0 0 60px ${YELLOW}55`,
          animation: "lex-pulse 1.4s ease-in-out infinite",
        }}
      />
      <h1
        style={{
          marginTop: 28,
          fontSize: 26,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        Команда
        <br />
        работает
      </h1>
      <p style={{ margin: "10px 0 0", fontSize: 13, color: MUTED, maxWidth: 280 }}>
        Транскрипт, сценарий, монтаж — займёт пару минут. Можно закрыть приложение,
        пришлём пуш когда будет готово.
      </p>

      <style>{`
        @keyframes lex-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.18); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
