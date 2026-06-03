/**
 * Маленькие чистые селекторы по FlowState.
 * Их же используют экраны и AppFlow для логики «куда идти / что показывать».
 */
import type { ContentFormat, FlowState } from "./types";

/** Нужен ли upload-шаг для выбранного формата. Сейчас только Reel. */
export function needsUploadStep(format: ContentFormat | null): boolean {
  return format === "reel";
}

/** Можно ли inline-редактировать драфт в review. */
export function canEditDraft(state: FlowState): boolean {
  if (!state.draftId && !state.weeklyPlanId) return false;
  // Reel-caption тоже editable, но drafte нет — id живёт в reelJobId
  return (
    state.format === "post" ||
    state.format === "carousel" ||
    state.format === "weekly-plan" ||
    state.format === "reel"
  );
}

/** Один id «активного контента» под текущий format — удобно для роутинга. */
export function getActiveContentId(state: FlowState): string | null {
  if (state.format === "reel") return state.reelJobId;
  if (state.format === "weekly-plan") return state.weeklyPlanId;
  return state.draftId;
}

/** Юзер уже не на home — значит flow идёт. */
export function isMidFlow(state: FlowState): boolean {
  return state.currentScreen !== "home";
}

/** Возвращает screen, на котором юзер должен оказаться при resume сессии. */
export function getResumeScreen(state: FlowState): FlowState["currentScreen"] {
  if (state.reelJobId) return "generate";
  if (state.draftId || state.weeklyPlanId) return "review";
  return "home";
}
