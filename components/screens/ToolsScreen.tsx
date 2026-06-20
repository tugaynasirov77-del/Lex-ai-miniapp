"use client";

import { useState } from "react";
import { useFlow, useFlowActions } from "../../flow";
import { hapticImpact, hapticSelection } from "../../lib/telegram";
import ReelDecoderCard from "../ReelDecoderCard";
import ReelScriptGeneratorCard from "../ReelScriptGeneratorCard";
import CarouselGeneratorCard from "../CarouselGeneratorCard";
import CaptionGeneratorCard from "../CaptionGeneratorCard";
import ContentPackCard from "../ContentPackCard";
import StateBlock from "../StateBlock";
import type { ToolId } from "./CreateHubScreen";

const YELLOW = "#E84B91";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";

type Props = { onBack: () => void };

const TABS: { id: ToolId; label: string; icon: string }[] = [
  { id: "decoder", label: "Разобрать", icon: "🔍" },
  { id: "script", label: "Сценарий", icon: "✨" },
  { id: "carousel", label: "Карусель", icon: "🖼" },
  { id: "caption", label: "Подпись", icon: "✏️" },
  { id: "pack", label: "Пакет", icon: "📦" },
];

/**
 * Экран инструментов: один таб = один генератор. Дефолтный таб приходит
 * из CreateHubScreen через screenMeta.toolTab (или fallback на 'decoder').
 */
export default function ToolsScreen({ onBack: _onBack }: Props) {
  const { state } = useFlow();
  const actions = useFlowActions();
  const projectId = state.projectId;

  const initial =
    (state.screenMeta?.toolTab as ToolId | undefined) || "decoder";
  const [tab, setTab] = useState<ToolId>(initial);

  if (!projectId) {
    return (
      <Wrap>
        <Title />
        <StateBlock
          emoji="🎬"
          title="Сначала создадим проект"
          body="Подключи Instagram-аккаунт — и инструменты заработают."
          action={{
            label: "Создать проект",
            onClick: () => actions.navigate("create-project"),
          }}
        />
      </Wrap>
    );
  }

  const onScript = (args: { decodeId: string; topic: any }) => {
    // Если из Decoder выбрали адаптированную тему — открываем PersonalScriptScreen.
    hapticImpact("medium");
    actions.setScreenMeta("scriptTopic", args.topic);
    actions.setScreenMeta("scriptDecodeId", args.decodeId);
    actions.navigate("personal-script");
  };

  return (
    <Wrap>
      <Title />

      {/* Сегментированный таб-бар, скроллится горизонтально на узких экранах */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginTop: 14,
          padding: 4,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid rgba(255,255,255,0.08)`,
          borderRadius: 999,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                hapticSelection();
                setTab(t.id);
              }}
              style={{
                appearance: "none",
                flex: "1 0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 12px",
                borderRadius: 999,
                border: "none",
                background: on
                  ? `linear-gradient(135deg, #A24FD6 0%, #E84B91 50%, #F88A4A 100%)`
                  : "transparent",
                color: on ? "#FFFFFF" : MUTED,
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: on ? 800 : 600,
                letterSpacing: on ? "0.02em" : "0.01em",
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: on
                  ? `0 6px 18px ${YELLOW}40, 0 0 0 1px rgba(255,255,255,0.15) inset`
                  : "none",
              }}
            >
              <span style={{ fontSize: 13 }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        {tab === "decoder" && (
          <ReelDecoderCard projectId={projectId} onCreateScript={onScript} />
        )}
        {tab === "script" && <ReelScriptGeneratorCard projectId={projectId} />}
        {tab === "carousel" && <CarouselGeneratorCard projectId={projectId} />}
        {tab === "caption" && <CaptionGeneratorCard projectId={projectId} />}
        {tab === "pack" && <ContentPackCard projectId={projectId} />}
      </div>
    </Wrap>
  );
}

function Title() {
  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>
        Инструменты
      </h1>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: MUTED }}>
        Выбери инструмент — и собирай контент
      </p>
    </div>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding:
          "max(calc(env(safe-area-inset-top) + 56px), 88px) 18px " +
          "max(calc(env(safe-area-inset-bottom) + 96px), 110px)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {children}
    </div>
  );
}
