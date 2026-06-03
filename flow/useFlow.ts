"use client";

import { useContext } from "react";
import { FlowContext } from "./FlowProvider";
import type { FlowContextValue } from "./types";

/**
 * Низкоуровневый доступ к {state, dispatch}. Большинство экранов
 * должны пользоваться useFlowActions() — он отдаёт стабильные
 * хелперы и не требует знать тип FlowAction.
 */
export function useFlow(): FlowContextValue {
  const ctx = useContext(FlowContext);
  if (!ctx) {
    throw new Error("useFlow() must be used inside <FlowProvider>");
  }
  return ctx;
}
