"use client";

import { useEffect, useRef, useState } from "react";
import {
  runIgAnalysis,
  runIgPlan,
  runTgAnalysis,
  runTgPlan,
} from "../lib/api";

type Platform = "telegram" | "instagram";

export type AutoStartState = {
  /** Хук активно работает (есть запущенные вызовы). */
  active: boolean;
  analysisRunning: boolean;
  planRunning: boolean;
  analysisDone: boolean;
  planDone: boolean;
  /** Сообщение последней ошибки (analysis или plan). */
  error: string | null;
};

const INITIAL: AutoStartState = {
  active: false,
  analysisRunning: false,
  planRunning: false,
  analysisDone: false,
  planDone: false,
  error: null,
};

const flagKey = (projectId: string) => `lex.autoStart.${projectId}`;

/**
 * Ставит маркер «запустить агентов» для проекта. Читается из
 * useAutoStartAgents в ProjectScreen.
 */
export function markAutoStart(projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(flagKey(projectId), "1");
  } catch {
    /* noop */
  }
}

/**
 * После добавления конкурентов AddCompetitorsScreen ставит флаг в
 * localStorage и навигирует в /project. Этот хук в ProjectScreen
 * проверяет флаг и параллельно запускает analyze + plan через
 * соответствующие платформенные endpoint'ы.
 *
 * Идемпотентность: флаг снимается сразу при старте (даже при ошибке
 * мы не зациклимся при повторном рендере). Дополнительный startedRef
 * защищает от двойного запуска в одной mount-сессии (StrictMode).
 *
 * При завершении обоих вызовов вызывается onComplete — родитель
 * перечитывает данные проекта (план/анализ).
 */
export function useAutoStartAgents(
  projectId: string | null,
  platform: Platform | null,
  onComplete?: () => void,
  /** Передай новый счётчик, чтобы forсировать перезапуск (для retry-кнопки). */
  retryKey: number = 0,
): AutoStartState {
  const [state, setState] = useState<AutoStartState>(INITIAL);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!projectId || !platform) return;
    if (startedRef.current) return;
    if (typeof window === "undefined") return;

    let flag: string | null = null;
    try {
      flag = localStorage.getItem(flagKey(projectId));
    } catch {
      /* noop */
    }
    if (flag !== "1") return;

    startedRef.current = true;
    // Снимаем флаг сразу — даже при сетевой ошибке не зацикливаем перезапуск.
    try {
      localStorage.removeItem(flagKey(projectId));
    } catch {
      /* noop */
    }

    const analyze =
      platform === "instagram" ? runIgAnalysis : runTgAnalysis;
    const plan = platform === "instagram" ? runIgPlan : runTgPlan;

    setState({
      active: true,
      analysisRunning: true,
      planRunning: true,
      analysisDone: false,
      planDone: false,
      error: null,
    });

    const analysisP = analyze(projectId)
      .then(() => {
        setState((s) => ({ ...s, analysisRunning: false, analysisDone: true }));
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "analysis failed";
        setState((s) => ({
          ...s,
          analysisRunning: false,
          error: s.error ?? msg,
        }));
      });

    const planP = plan(projectId)
      .then(() => {
        setState((s) => ({ ...s, planRunning: false, planDone: true }));
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "plan failed";
        setState((s) => ({
          ...s,
          planRunning: false,
          error: s.error ?? msg,
        }));
      });

    Promise.allSettled([analysisP, planP]).then(() => {
      setState((s) => ({ ...s, active: false }));
      if (onComplete) onComplete();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, platform, retryKey]);

  // При retryKey change — обнуляем startedRef, чтобы useEffect отработал.
  useEffect(() => {
    if (retryKey > 0) {
      startedRef.current = false;
      setState(INITIAL);
    }
  }, [retryKey]);

  return state;
}
