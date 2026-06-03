"use client";

import { useCallback, useMemo } from "react";
import { useFlow } from "./useFlow";
import type { Brief, ContentFormat, FlowState, ScreenKey } from "./types";

/**
 * Стабильный bundle action-хелперов. Возвращаемый объект имеет
 * фиксированную ссылочную идентичность между ре-рендерами, поэтому
 * безопасно передавать его в useEffect-deps или мемоизированные дети.
 *
 * Экраны должны вызывать ТОЛЬКО эти хелперы, не лезть в dispatch напрямую —
 * это убирает зависимость UI от формы FlowAction.
 */
export function useFlowActions() {
  const { dispatch } = useFlow();

  const navigate = useCallback(
    (screen: ScreenKey) => dispatch({ type: "NAVIGATE", screen }),
    [dispatch],
  );

  const back = useCallback(() => dispatch({ type: "BACK" }), [dispatch]);

  const resetFlow = useCallback(() => dispatch({ type: "RESET_FLOW" }), [dispatch]);

  const setFormat = useCallback(
    (format: ContentFormat) => dispatch({ type: "SET_FORMAT", format }),
    [dispatch],
  );

  const setBrief = useCallback(
    (brief: Brief) => dispatch({ type: "SET_BRIEF", brief }),
    [dispatch],
  );

  const setIds = useCallback(
    (
      ids: Partial<
        Pick<FlowState, "projectId" | "draftId" | "reelJobId" | "weeklyPlanId">
      >,
    ) => dispatch({ type: "SET_IDS", ids }),
    [dispatch],
  );

  const setScreenMeta = useCallback(
    (key: string, value: unknown) =>
      dispatch({ type: "SET_SCREEN_META", key, value }),
    [dispatch],
  );

  return useMemo(
    () => ({ navigate, back, resetFlow, setFormat, setBrief, setIds, setScreenMeta }),
    [navigate, back, resetFlow, setFormat, setBrief, setIds, setScreenMeta],
  );
}
