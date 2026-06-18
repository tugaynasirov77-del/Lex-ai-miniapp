"use client";

import { useEffect } from "react";
import { hapticNotify } from "../../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.62)";

type Props = {
  scenarioTitle?: string;
  projectName?: string;
  onContinue: () => void;
};

/**
 * Экран успеха после первого сохранённого сценария Reels.
 * Минимальная версия — друг сделает редизайн в feature/onboarding-success.
 */
export default function OnboardingSuccessScreen({
  scenarioTitle,
  projectName,
  onContinue,
}: Props) {
  useEffect(() => {
    hapticNotify("success");
  }, []);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding:
          "max(calc(env(safe-area-inset-top) + 56px), 88px) 22px " +
          "max(calc(env(safe-area-inset-bottom) + 110px), 130px)",
        color: INK,
        textAlign: "center",
        position: "relative",
      }}
    >
      <div
        style={{
          fontSize: 64,
          lineHeight: 1,
          marginBottom: 18,
        }}
      >
        ✨
      </div>

      <h1
        style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
        }}
      >
        Ваш первый контент готов
      </h1>

      <p
        style={{
          margin: "14px 0 0",
          fontSize: 15,
          color: MUTED,
          lineHeight: 1.55,
          maxWidth: 320,
        }}
      >
        Вы прошли путь от чужого Reels до собственного сценария. Теперь он сохранён
        в проекте и доступен в вашем плане.
      </p>

      {scenarioTitle && (
        <div
          style={{
            marginTop: 18,
            padding: "10px 14px",
            borderRadius: 999,
            background: "rgba(245,231,10,0.10)",
            border: "1px solid rgba(245,231,10,0.30)",
            fontSize: 13,
            color: YELLOW,
            fontWeight: 600,
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          📝 «{scenarioTitle}»{projectName ? ` · ${projectName}` : ""}
        </div>
      )}

      <button
        onClick={onContinue}
        style={{
          appearance: "none",
          position: "absolute",
          left: 22,
          right: 22,
          bottom: "max(calc(env(safe-area-inset-bottom) + 96px), 116px)",
          padding: "16px 0",
          border: "none",
          borderRadius: 999,
          background: `linear-gradient(135deg, #FFF382 0%, ${YELLOW} 50%, #E5C500 100%)`,
          color: "#0A0608",
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          fontFamily: "inherit",
          cursor: "pointer",
          boxShadow: `0 16px 36px rgba(245,231,10,0.45), 0 0 0 1px rgba(255,255,255,0.18) inset`,
        }}
      >
        Перейти на главную
      </button>
    </div>
  );
}
