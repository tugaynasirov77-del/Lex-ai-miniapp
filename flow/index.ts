/**
 * Единая точка импорта для потребителей flow-слоя.
 * Экраны пишут `import { useFlowActions, type ContentFormat } from "@/flow"`,
 * не лезут в internal-файлы.
 */
export * from "./types";
export { INITIAL_STATE, flowReducer } from "./reducer";
export { FlowProvider, FlowContext } from "./FlowProvider";
export { useFlow } from "./useFlow";
export { useFlowActions } from "./useFlowActions";
export * as selectors from "./selectors";
