"use client";

import { useEffect, useRef, useState } from "react";
import { lexAnalyze } from "../lib/api";

type Platform = "telegram" | "instagram";

export type AutoStartState = {
  /** Хук активно работает (есть запущенные вызовы). */
  active: boolean;
  analysisRunning: boolean;
  /** Совместимость со старым UI — теперь planRunning всегда false. */
  planRunning: boolean;
  analysisDone: boolean;
  planDone: boolean;
  /** Сообщение последней ошибки. */
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

export function markAutoStart(projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(flagKey(projectId), "1");
  } catch {
    /* noop */
  }
}

/**
 * После добавления конкурентов AddCompetitorsScreen ставит флаг.
 * Этот хук запускает единственный вызов lexAnalyze — анализ ниши и
 * конкурентов, результат кешируется в БД (projects.lex_insights)
 * и используется во всех генераторах контента (post/carousel/reel).
 *
 * Заменяет старый pipeline Анна+Александр (analyze + plan) одним
 * вызовом LEX AI.
 */
export function useAutoStartAgents(
  projectId: string | null,
  platform: Platform | null,
  onComplete?: () => void,
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
    try {
      localStorage.removeItem(flagKey(projectId));
    } catch {
      /* noop */
    }

    setState({
      active: true,
      analysisRunning: true,
      planRunning: false,
      analysisDone: false,
      planDone: false,
      error: null,
    });

    (async () => {
      try {
        await lexAnalyze(projectId);
        setState((s) => ({
          ...s,
          analysisRunning: false,
          analysisDone: true,
          planDone: true,
          active: false,
        }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "analyze failed";
        setState((s) => ({
          ...s,
          analysisRunning: false,
          active: false,
          error: msg,
        }));
      }
      if (onComplete) onComplete();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, platform, retryKey]);

  useEffect(() => {
    if (retryKey > 0) {
      startedRef.current = false;
      setState(INITIAL);
    }
  }, [retryKey]);

  return state;
}
