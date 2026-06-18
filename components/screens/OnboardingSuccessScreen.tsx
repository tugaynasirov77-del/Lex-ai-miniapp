"use client";

import { useEffect } from "react";
import { hapticImpact, hapticNotify } from "../../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.62)";
const BG = "#0A0608";

type Props = {
  scenarioTitle?: string;
  projectName?: string;
  onContinue: () => void;
};

/**
 * Экран успеха после первого сохранённого сценария Reels (бриф, раздел 8).
 * Финальный экран Этапа 1: лого LEX AI, анимированный жёлтый чек,
 * поздравление и переход на главную.
 */
export default function OnboardingSuccessScreen({
  scenarioTitle,
  projectName,
  onContinue,
}: Props) {
  useEffect(() => {
    hapticNotify("success");
  }, []);

  // Подзаголовок-плашка только если пришли данные сценария/проекта.
  const detail =
    scenarioTitle && projectName
      ? `Сценарий «${scenarioTitle}» сохранён в проекте «${projectName}»`
      : scenarioTitle
        ? `Сценарий «${scenarioTitle}» сохранён в проекте`
        : projectName
          ? `Сценарий сохранён в проекте «${projectName}»`
          : null;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: BG,
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        textAlign: "center",
        padding:
          "max(calc(env(safe-area-inset-top) + 56px), 88px) 24px " +
          "max(calc(env(safe-area-inset-bottom) + 24px), 28px)",
      }}
    >
      {/* Центральный блок */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
        }}
      >
        <LexLogo height={44} />

        {/* Жёлтый чек с анимацией появления */}
        <div
          style={{
            width: 116,
            height: 116,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(circle at 50% 35%, #FFF382 0%, " + YELLOW + " 55%, #E5C500 100%)",
            boxShadow: `0 0 0 10px rgba(245,231,10,0.10), 0 22px 60px rgba(245,231,10,0.45)`,
            animation: "lex-success-pop 620ms cubic-bezier(0.34,1.56,0.64,1) 120ms both",
          }}
        >
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 12.5l4.2 4.3L19 7"
              stroke="#0A0608"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            alignItems: "center",
            animation: "lex-success-fade 520ms ease 280ms both",
          }}
        >
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
              margin: 0,
              fontSize: 15,
              color: MUTED,
              lineHeight: 1.55,
              maxWidth: 320,
            }}
          >
            Вы прошли путь от чужого Reels до собственного сценария. Теперь он
            сохранён в проекте и доступен в вашем плане.
          </p>

          {detail && (
            <div
              style={{
                marginTop: 4,
                padding: "10px 16px",
                borderRadius: 16,
                background: "rgba(245,231,10,0.08)",
                border: "1px solid rgba(245,231,10,0.28)",
                fontSize: 13,
                color: YELLOW,
                fontWeight: 600,
                lineHeight: 1.45,
                maxWidth: 320,
              }}
            >
              ✓ {detail}
            </div>
          )}
        </div>
      </div>

      {/* Sticky CTA */}
      <button
        onClick={() => {
          hapticImpact("medium");
          onContinue();
        }}
        style={{
          appearance: "none",
          width: "100%",
          minHeight: 56,
          border: "none",
          borderRadius: 999,
          background: `linear-gradient(135deg, #FFF382 0%, ${YELLOW} 45%, #E5C500 100%)`,
          color: "#0A0608",
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          fontFamily: "inherit",
          cursor: "pointer",
          boxShadow: `0 18px 44px ${YELLOW}40, 0 4px 14px ${YELLOW}33, 0 0 0 1px rgba(255,255,255,0.20) inset`,
        }}
      >
        Перейти на главную
      </button>

      <style>{`
        @keyframes lex-success-pop {
          0%   { opacity: 0; transform: scale(0.4); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes lex-success-fade {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/** Логотип LEX AI — повторяет стилизацию из WelcomeScreen. */
function LexLogo({ height = 44 }: { height?: number }) {
  return (
    <div
      aria-label="LEX AI"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: height * 0.3,
        height,
        lineHeight: 1,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.jpg"
        alt=""
        style={{
          height: height * 1.1,
          width: height * 1.1,
          objectFit: "cover",
          display: "block",
          borderRadius: height * 0.3,
        }}
      />
      <div
        style={{
          fontSize: height * 0.6,
          fontWeight: 700,
          letterSpacing: "0.07em",
        }}
      >
        <span style={{ color: INK }}>LEX </span>
        <span style={{ color: YELLOW }}>AI</span>
      </div>
    </div>
  );
}
