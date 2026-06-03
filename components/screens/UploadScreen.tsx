"use client";

import { hapticImpact } from "../../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";

type Props = {
  onUploaded: () => void;
  onBack: () => void;
};

export default function UploadScreen({ onUploaded, onBack: _onBack }: Props) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        padding: "max(calc(env(safe-area-inset-top) + 64px), 96px) 22px " +
          "max(calc(env(safe-area-inset-bottom) + 32px), 48px)",
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: MUTED, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
          Шаг 2 из 3
        </div>
        <h1
          style={{
            margin: "10px 0 0",
            fontSize: 30,
            lineHeight: 1.02,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
          }}
        >
          Загрузите
          <br />
          материал
        </h1>
        <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.4, color: MUTED }}>
          Видео до 90 секунд — остальное сделает команда
        </p>
      </div>

      {/* Dropzone-плейсхолдер */}
      <div
        style={{
          marginTop: 24,
          flex: 1,
          minHeight: 220,
          borderRadius: 24,
          border: "1.5px dashed rgba(255,255,255,0.18)",
          background: "rgba(255,255,255,0.02)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, color: INK }}>+</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Выберите видео</div>
        <div style={{ fontSize: 12, color: MUTED }}>
          MP4 / MOV, до 120 МБ
        </div>
      </div>

      <button
        onClick={() => {
          hapticImpact("medium");
          // TODO: реальный пайплайн загрузки → onUploaded() по завершении
          onUploaded();
        }}
        style={{
          marginTop: 18,
          width: "100%",
          minHeight: 56,
          padding: "18px 0",
          border: "none",
          borderRadius: 999,
          background: YELLOW,
          color: "#0A0608",
          fontSize: 17,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          boxShadow:
            "0 22px 52px rgba(245,231,10,0.30), 0 0 0 1px rgba(255,255,255,0.12) inset",
          cursor: "pointer",
        }}
      >
        Загрузить
      </button>
    </div>
  );
}
