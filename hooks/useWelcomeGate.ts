"use client";

import { useEffect, useRef } from "react";
import { useFlow, useFlowActions } from "../flow";
import { listProjects } from "../lib/api";

export const ONBOARDING_LS_KEY = "lex_onboarding_completed";

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

    let alive = true;
    (async () => {
      // Онбординг считается пройденным ТОЛЬКО если у юзера есть проект.
      // Локальный флаг — лишь оптимизация (не делаем сетевой вызов, если уже
      // знаем, что проект был). Сам факт «работать можно» = наличие проекта,
      // иначе анкету придётся показывать посреди работы (см. runDecode на Home).
      const projects = await listProjects().catch(() => ({ projects: [] }));
      if (!alive) return;

      const hasProject = projects.projects.length > 0;

      if (hasProject) {
        try {
          localStorage.setItem(ONBOARDING_LS_KEY, "1");
        } catch {
          /* noop */
        }
        return;
      }

      // Проекта нет → ведём в welcome (демо ценности + CTA на анкету).
      // Редиректим только если юзер всё ещё на home (не перебиваем resume).
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
