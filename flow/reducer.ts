/**
 * Чистый reducer flow-слоя. Никаких side-effects, никаких fetch.
 * Тестируется в изоляции без React.
 */
import type { FlowAction, FlowState, ScreenKey } from "./types";

/** Лимит длины истории, чтобы стек не разрастался при долгом юзкейсе. */
const HISTORY_LIMIT = 20;

export const INITIAL_STATE: FlowState = {
  currentScreen: "home",
  history: [],
  format: null,
  brief: null,
  projectId: null,
  draftId: null,
  reelJobId: null,
  weeklyPlanId: null,
  screenMeta: {},
};

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "NAVIGATE": {
      // Двойной NAVIGATE на тот же экран не плодит мусор в истории.
      if (action.screen === state.currentScreen) return state;
      const pushed = [...state.history, state.currentScreen];
      const history =
        pushed.length > HISTORY_LIMIT ? pushed.slice(-HISTORY_LIMIT) : pushed;
      return { ...state, currentScreen: action.screen, history };
    }

    case "BACK": {
      // Если истории нет — игнор. На home back обрабатывает Telegram сам.
      if (state.history.length === 0) return state;
      const history = state.history.slice();
      const prev = history.pop() as ScreenKey;
      return { ...state, currentScreen: prev, history };
    }

    case "RESET_FLOW": {
      // Полный сброс. Используется после финального publish/reject.
      return INITIAL_STATE;
    }

    case "RESET_CONTENT": {
      // Сбрасываем только контентную сессию (format/brief/ids/meta),
      // но СОХРАНЯЕМ projectId — юзер остаётся в контексте проекта.
      return {
        ...state,
        format: null,
        brief: null,
        draftId: null,
        reelJobId: null,
        weeklyPlanId: null,
        screenMeta: {},
      };
    }

    case "SET_FORMAT": {
      return { ...state, format: action.format };
    }

    case "SET_BRIEF": {
      return { ...state, brief: action.brief };
    }

    case "SET_IDS": {
      // Частичный апдейт ids. undefined-ключи не затирают существующее.
      const filtered: typeof action.ids = {};
      for (const k of Object.keys(action.ids) as (keyof typeof action.ids)[]) {
        const v = action.ids[k];
        if (v !== undefined) filtered[k] = v;
      }
      return { ...state, ...filtered };
    }

    case "SET_SCREEN_META": {
      return {
        ...state,
        screenMeta: { ...state.screenMeta, [action.key]: action.value },
      };
    }

    default: {
      // Exhaustive check — TS подсветит если добавим новый action и забудем case.
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}
