/**
 * Типы flow-слоя LEX AI Mini App.
 *
 * Тут только публичные типы, никакого runtime-кода. Любой UI-компонент
 * импортирует отсюда, не лезет напрямую в reducer.ts.
 */
import type { Dispatch } from "react";

/** Все экраны единого pipeline после home. */
export type ScreenKey =
  | "home"
  | "dashboard"
  | "create-project"
  | "add-competitors"
  | "project"
  | "billing"
  | "choose-format"
  | "project-brief"
  | "upload"
  | "generate"
  | "reel-approve"
  | "review";

/** Какой контент юзер выбрал на choose-format. */
export type ContentFormat = "reel" | "carousel" | "post" | "weekly-plan";

/** Доменные подтипы для Brief — расширяемы, не финал. */
export type Tone = "confident" | "warm" | "humor" | "expert" | "calm";
export type Platform = "telegram" | "instagram" | "both";
export type Audience =
  | "entrepreneurs"
  | "experts"
  | "creators"
  | "youth"
  | "mature"
  | "general";
export type Goal = "warm" | "sell" | "educate" | "entertain";
export type Period = "week" | "biweek";

/** Минимальный бриф, собираемый на project-brief screen. */
export type Brief = {
  topic: string;
  tone: Tone;
  platform?: Platform;
  audience?: Audience;
  goal?: Goal;
  period?: Period;
};

/**
 * Полный state flow. Тут только данные, нужные между экранами для
 * принятия решений «куда идти» и «что показывать дальше».
 * Локальные UI-стейты (file input, edit-mode и т.п.) живут в useState
 * экранов, НЕ здесь.
 */
export type FlowState = {
  currentScreen: ScreenKey;
  /** Стек screen'ов, в которые юзер уже заходил (для BACK). Cap = 20 элементов. */
  history: ScreenKey[];
  format: ContentFormat | null;
  brief: Brief | null;
  projectId: string | null;
  /** Используется для post / carousel — id строки content_drafts. */
  draftId: string | null;
  /** Только для Reel — id строки reel_jobs. */
  reelJobId: string | null;
  /** Только для weekly-plan — id строки weekly_plans. */
  weeklyPlanId: string | null;
  /**
   * Произвольный per-screen контекст: например, transcriptWords между
   * upload→reel-approve, или draft current slide index в review.
   * Очищается по RESET_FLOW.
   */
  screenMeta: Record<string, unknown>;
};

/** Все возможные actions. Discriminated union для exhaustive switch в reducer. */
export type FlowAction =
  | { type: "NAVIGATE"; screen: ScreenKey }
  | { type: "BACK" }
  | { type: "RESET_FLOW" }
  | { type: "RESET_CONTENT" }
  | { type: "SET_FORMAT"; format: ContentFormat }
  | { type: "SET_BRIEF"; brief: Brief }
  | {
      type: "SET_IDS";
      ids: Partial<
        Pick<FlowState, "projectId" | "draftId" | "reelJobId" | "weeklyPlanId">
      >;
    }
  | { type: "SET_SCREEN_META"; key: string; value: unknown };

/** То, что лежит в React Context. */
export type FlowContextValue = {
  state: FlowState;
  dispatch: Dispatch<FlowAction>;
};
