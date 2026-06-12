"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppBg from "./AppBg";
import HomeScreen from "./HomeScreen";
import ChooseFormatScreen from "./screens/ChooseFormatScreen";
import ProjectBriefScreen from "./screens/ProjectBriefScreen";
import UploadScreen from "./screens/UploadScreen";
import GenerateScreen from "./screens/GenerateScreen";
import ReviewScreen from "./screens/ReviewScreen";
import ReelApproveScreen from "./screens/ReelApproveScreen";
import DashboardScreen from "./screens/DashboardScreen";
import ProjectScreen from "./screens/ProjectScreen";
import CreateProjectScreen from "./screens/CreateProjectScreen";
import AddCompetitorsScreen from "./screens/AddCompetitorsScreen";
import BillingScreen from "./screens/BillingScreen";
import { useFlow, useFlowActions, type ContentFormat } from "../flow";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { useResumeFlow } from "../hooks/useResumeFlow";
import { hapticImpact } from "../lib/telegram";

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

  // Telegram BackButton — централизованно через хук.
  useTgBackButton(currentScreen !== "home", goBack);

  // Восстановление flow из localStorage + автосохранение на изменениях state.
  useResumeFlow();

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
        bottom: 0,
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
            <HomeScreen onStart={() => goNext("dashboard")} />
          )}
          {currentScreen === "dashboard" && (
            <DashboardScreen onBack={goBack} />
          )}
          {currentScreen === "create-project" && (
            <CreateProjectScreen onBack={goBack} />
          )}
          {currentScreen === "add-competitors" && (
            <AddCompetitorsScreen onBack={goBack} />
          )}
          {currentScreen === "project" && <ProjectScreen onBack={goBack} />}
          {currentScreen === "billing" && <BillingScreen onBack={goBack} />}
          {currentScreen === "choose-format" && (
            <ChooseFormatScreen
              onPick={(format?: ContentFormat) => {
                if (format) actions.setFormat(format);
                // Reel идёт в upload (нужно загрузить видео).
                // Остальные форматы идут в project-brief.
                if (format === "reel") goNext("upload");
                else goNext("project-brief");
              }}
              onBack={goBack}
            />
          )}
          {currentScreen === "project-brief" && (
            <ProjectBriefScreen
              onSubmit={() => goNext("generate")}
              onBack={goBack}
            />
          )}
          {currentScreen === "upload" && (
            <UploadScreen
              onUploaded={() => goNext("generate")}
              onBack={goBack}
            />
          )}
          {currentScreen === "generate" && <GenerateScreen onBack={goBack} />}

          {currentScreen === "reel-approve" && (
            <ReelApproveScreen onBack={goBack} />
          )}
          {currentScreen === "review" && <ReviewScreen onBack={goBack} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
