"use client";

import { useEffect, useRef } from "react";
import { useFlow, useFlowActions } from "../flow";
import { getOnboardingStatus, listProjects } from "../lib/api";

export const ONBOARDING_LS_KEY = "lex_onboarding_completed";

function isCompletedLocally(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(ONBOARDING_LS_KEY) === "1";
  } catch {
    return true;
  }
}

/**
 * Решает, показывать ли welcome-онбординг.
 *
 * Welcome видят ТОЛЬКО новые юзеры: нет localStorage-флага, серверный флаг
 * onboarding_completed=false И нет ни одного проекта. Существующие 341 юзер
 * (у которых серверного флага ещё нет) отсеиваются по наличию проектов.
 *
 * Запускается один раз на mount AppFlow. Чтобы не перебить resume-навигацию
 * (useResumeFlow уводит вернувшегося юзера на dashboard/project), редирект
 * на welcome делаем только если юзер всё ещё на home.
 */
export function useWelcomeGate() {
  const { state } = useFlow();
  const actions = useFlowActions();
  const ran = useRef(false);
  const screenRef = useRef(state.currentScreen);
  screenRef.current = state.currentScreen;

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (isCompletedLocally()) return;

    let alive = true;
    (async () => {
      const [status, projects] = await Promise.all([
        getOnboardingStatus().catch(() => ({ onboarding_completed: false })),
        listProjects().catch(() => ({ projects: [] })),
      ]);
      if (!alive) return;

      const alreadyOnboarded =
        status.onboarding_completed || projects.projects.length > 0;

      if (alreadyOnboarded) {
        try {
          localStorage.setItem(ONBOARDING_LS_KEY, "1");
        } catch {
          /* noop */
        }
        return;
      }

      // Новый юзер. Редиректим только если он не ушёл с home сам/через resume.
      if (screenRef.current === "home") {
        actions.navigate("welcome");
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
