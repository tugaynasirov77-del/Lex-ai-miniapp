"use client";

import { useEffect, useRef } from "react";
import { useFlow, useFlowActions, type FlowState } from "../flow";

const KEY = "lex.flow.v1";

type Persisted = Partial<
  Pick<
    FlowState,
    | "currentScreen"
    | "format"
    | "brief"
    | "projectId"
    | "draftId"
    | "reelJobId"
    | "weeklyPlanId"
  >
>;

function isClean(s: FlowState): boolean {
  return (
    s.currentScreen === "home" &&
    s.format === null &&
    s.brief === null &&
    s.projectId === null &&
    s.draftId === null &&
    s.reelJobId === null &&
    s.weeklyPlanId === null
  );
}

/**
 * При mount: подгружает FlowState из localStorage и диспатчит во flow.
 * При изменении: сохраняет с debounce.
 * При RESET_FLOW (state стал INITIAL_STATE): чистит localStorage.
 */
export function useResumeFlow() {
  const { state } = useFlow();
  const actions = useFlowActions();
  const loadedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- LOAD once on mount ---
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as Persisted;

      if (p.format) actions.setFormat(p.format);
      if (p.brief) actions.setBrief(p.brief);

      const ids: Parameters<typeof actions.setIds>[0] = {};
      if (p.projectId) ids.projectId = p.projectId;
      if (p.draftId) ids.draftId = p.draftId;
      if (p.reelJobId) ids.reelJobId = p.reelJobId;
      if (p.weeklyPlanId) ids.weeklyPlanId = p.weeklyPlanId;
      if (Object.keys(ids).length) actions.setIds(ids);

      // Навигация в самом конце — экран сразу видит весь подгруженный state.
      if (p.currentScreen && p.currentScreen !== "home") {
        actions.navigate(p.currentScreen);
      }
    } catch {
      // Битый JSON — игнор, оставляем INITIAL_STATE.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- SAVE on state change (debounced) ---
  useEffect(() => {
    if (!loadedRef.current) return;
    if (typeof window === "undefined") return;

    if (saveTimer.current) clearTimeout(saveTimer.current);

    // Полный сброс (RESET_FLOW или просто home без данных) — чистим хранилище.
    if (isClean(state)) {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* noop */
      }
      return;
    }

    saveTimer.current = setTimeout(() => {
      const payload: Persisted = {
        currentScreen: state.currentScreen,
        format: state.format,
        brief: state.brief,
        projectId: state.projectId,
        draftId: state.draftId,
        reelJobId: state.reelJobId,
        weeklyPlanId: state.weeklyPlanId,
      };
      try {
        localStorage.setItem(KEY, JSON.stringify(payload));
      } catch {
        /* noop */
      }
    }, 300);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state]);
}

export function clearFlowPersistence() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
