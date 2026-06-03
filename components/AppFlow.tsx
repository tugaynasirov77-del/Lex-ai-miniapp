"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppBg from "./AppBg";
import HomeScreen from "./HomeScreen";
import ChooseFormatScreen from "./screens/ChooseFormatScreen";
import UploadScreen from "./screens/UploadScreen";
import GenerateScreen from "./screens/GenerateScreen";
import { useFlow, useFlowActions, type ContentFormat } from "../flow";
import { hapticImpact, showBackButton } from "../lib/telegram";

const ENTER = { opacity: 0, y: 10 };
const SHOW = { opacity: 1, y: 0 };
const EXIT = { opacity: 0, y: -8 };
const TRANS = {
  duration: 0.24,
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
};

/**
 * Тонкий orchestrator: НЕТ локального state, источник правды — FlowProvider.
 * Здесь живут только AnimatePresence, TG BackButton подписка, body-overflow lock
 * и render-switch по state.currentScreen.
 */
export default function AppFlow() {
  const { state } = useFlow();
  const actions = useFlowActions();
  const { currentScreen } = state;

  // Хелпер с хаптиком для primary-навигации.
  const goNext = (screen: Parameters<typeof actions.navigate>[0]) => {
    hapticImpact("light");
    actions.navigate(screen);
  };

  const goBack = () => {
    hapticImpact("light");
    actions.back();
  };

  // Telegram BackButton: показываем на любом не-home экране, прячем на home.
  useEffect(() => {
    if (currentScreen === "home") return;
    const off = showBackButton(goBack);
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScreen]);

  // Полностью блокируем скролл документа на flow-странице,
  // оставляем мягкий rubber-band только внутри foreground.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.cssText;
    const prevBody = body.style.cssText;
    html.style.height = "100%";
    body.style.height = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "contain";
    return () => {
      html.style.cssText = prevHtml;
      body.style.cssText = prevBody;
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: "calc(-1 * (env(safe-area-inset-bottom) + 78px))",
        overflow: "hidden",
      }}
    >
      <AppBg />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentScreen}
          initial={ENTER}
          animate={SHOW}
          exit={EXIT}
          transition={TRANS}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {currentScreen === "home" && (
            <HomeScreen onStart={() => goNext("choose-format")} />
          )}
          {currentScreen === "choose-format" && (
            <ChooseFormatScreen
              onPick={(format?: ContentFormat) => {
                // ChooseFormatScreen пока вызывает onPick() без аргумента —
                // как только переведём его на новый API, format будет проброшен в state.
                if (format) actions.setFormat(format);
                // Для Reel дальше upload, для остальных — project-brief.
                // Пока project-brief не реализован: всё ведём в upload (старое поведение).
                goNext("upload");
              }}
              onBack={goBack}
            />
          )}
          {currentScreen === "upload" && (
            <UploadScreen
              onUploaded={() => {
                // TODO: пробросить реальный reelJobId через actions.setIds.
                goNext("generate");
              }}
              onBack={goBack}
            />
          )}
          {currentScreen === "generate" && <GenerateScreen onBack={goBack} />}

          {/* project-brief и review ещё не реализованы как screens — render-fallback в виде null.
              Навигация на эти ключи валидна (ScreenKey), но визуально ничего не отрендерится. */}
          {(currentScreen === "project-brief" || currentScreen === "review") && null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
