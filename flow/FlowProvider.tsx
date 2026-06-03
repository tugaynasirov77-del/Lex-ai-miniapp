"use client";

import { createContext, useMemo, useReducer } from "react";
import { INITIAL_STATE, flowReducer } from "./reducer";
import type { FlowContextValue } from "./types";

/** null = вне провайдера, useFlow() кидает понятный invariant-error. */
export const FlowContext = createContext<FlowContextValue | null>(null);

export function FlowProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(flowReducer, INITIAL_STATE);
  // dispatch стабилен, state меняется — мемоизация по state снижает ре-рендеры
  // в потребителях, которые читают только actions через useFlowActions().
  const value = useMemo<FlowContextValue>(() => ({ state, dispatch }), [state]);
  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}
