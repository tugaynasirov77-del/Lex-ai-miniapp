"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppBg from "./AppBg";
import HomeScreen from "./HomeScreen";
import WelcomeScreen from "./WelcomeScreen";
import DashboardScreen from "./screens/DashboardScreen";
import ProjectScreen from "./screens/ProjectScreen";
import CreateProjectScreen from "./screens/CreateProjectScreen";
import AddCompetitorsScreen from "./screens/AddCompetitorsScreen";
import BillingScreen from "./screens/BillingScreen";
import LexCreateScreen from "./screens/LexCreateScreen";
import SettingsScreen from "./screens/SettingsScreen";
import PersonalScriptScreen from "./screens/PersonalScriptScreen";
import OnboardingSuccessScreen from "./screens/OnboardingSuccessScreen";
import PlanScreen from "./screens/PlanScreen";
import CreateHubScreen from "./screens/CreateHubScreen";
import BottomTabBar from "./BottomTabBar";
import { useFlow, useFlowActions } from "../flow";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { useResumeFlow } from "../hooks/useResumeFlow";
import { useWelcomeGate, ONBOARDING_LS_KEY } from "../hooks/useWelcomeGate";
import { markOnboardingDone, peekProjects } from "../lib/api";
import { hapticImpact } from "../lib/telegram";
import type { AdaptedTopicDTO } from "../lib/api";

const FIRST_SCRIPT_LS_KEY = "lex_first_script_done";

const ENTER = { opacity: 0 };
const SHOW = { opacity: 1 };
const EXIT = { opacity: 0 };
const TRANS = {
  duration: 0.14,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
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
  // На welcome back-кнопку не показываем — это линейный онбординг.
  useTgBackButton(currentScreen !== "home" && currentScreen !== "welcome", goBack);

  // Восстановление flow из localStorage + автосохранение на изменениях state.
  useResumeFlow();

  // Решает, показать ли welcome-онбординг новому юзеру.
  useWelcomeGate();

  // Завершение онбординга: ставим флаги (локально + сервер) и уводим в создание
  // проекта. completeOnboarding вызывается из WelcomeScreen.
  const completeOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDING_LS_KEY, "1");
    } catch {
      /* noop */
    }
    markOnboardingDone().catch(() => {
      /* best-effort — localStorage уже закрыл показ */
    });
  };

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
          {currentScreen === "welcome" && (
            <WelcomeScreen
              onComplete={completeOnboarding}
              onStart={() => actions.navigate("create-project")}
              onSkipToCreate={() => actions.navigate("create-project")}
            />
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
          {currentScreen === "lex-create" && <LexCreateScreen onBack={goBack} />}
          {currentScreen === "settings" && <SettingsScreen onBack={goBack} />}
          {currentScreen === "personal-script" && (() => {
            const topic = state.screenMeta.scriptTopic as AdaptedTopicDTO | undefined;
            const decodeId = state.screenMeta.scriptDecodeId as string | undefined;
            const projectId = state.projectId;
            if (!topic || !projectId) {
              // Defensive: если данные потеряны — назад в проект
              actions.navigate("project");
              return null;
            }
            return (
              <PersonalScriptScreen
                projectId={projectId}
                decodeId={decodeId}
                topic={topic}
                onBack={goBack}
                onSaved={(draftId) => {
                  // Первый сохранённый сценарий → success-экран,
                  // последующие → обратно в проект
                  let firstDone = false;
                  try {
                    firstDone = localStorage.getItem(FIRST_SCRIPT_LS_KEY) === "1";
                  } catch {}
                  if (!firstDone) {
                    try { localStorage.setItem(FIRST_SCRIPT_LS_KEY, "1"); } catch {}
                    actions.setScreenMeta("savedDraftId", draftId);
                    actions.setScreenMeta("savedScriptTitle", topic.title);
                    actions.navigate("onboarding-success");
                  } else {
                    actions.navigate("project");
                  }
                }}
                onAddedToPlan={(draftId, _date) => {
                  let firstDone = false;
                  try {
                    firstDone = localStorage.getItem(FIRST_SCRIPT_LS_KEY) === "1";
                  } catch {}
                  if (!firstDone) {
                    try { localStorage.setItem(FIRST_SCRIPT_LS_KEY, "1"); } catch {}
                    actions.setScreenMeta("savedDraftId", draftId);
                    actions.setScreenMeta("savedScriptTitle", topic.title);
                    actions.navigate("onboarding-success");
                  } else {
                    actions.navigate("project");
                  }
                }}
              />
            );
          })()}
          {currentScreen === "onboarding-success" && (
            <OnboardingSuccessScreen
              scenarioTitle={state.screenMeta.savedScriptTitle as string | undefined}
              projectName={
                peekProjects()?.projects.find((p) => p.id === state.projectId)?.title
              }
              onContinue={() => {
                actions.navigate(state.projectId ? "project" : "home");
              }}
            />
          )}
          {currentScreen === "plan" && <PlanScreen onBack={goBack} />}
          {currentScreen === "create-hub" && <CreateHubScreen />}
          {/* Legacy screens (choose-format/project-brief/upload/generate/reel-approve/review)
              удалены — UI теперь идёт через единый LexCreateScreen. Если в localStorage
              старый currentScreen, useResumeFlow сбросит на home. */}
        </motion.div>
      </AnimatePresence>

      {/* Нижний таб-бар — всегда видим */}
      <BottomTabBar />
    </div>
  );
}
