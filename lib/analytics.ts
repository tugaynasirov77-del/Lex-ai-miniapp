"use client";

import { tgFetch } from "./telegram";

/**
 * Лёгкий клиентский трекинг продуктовых событий (бриф раздел 27).
 *
 * Батчит события и шлёт раз в ~3 сек или при достижении 10 событий.
 * Best-effort: ошибки сети игнорируются, на UX не влияет.
 *
 * Использование:
 *   import { track } from "../lib/analytics";
 *   track("reels_analysis_started", { project_id });
 */

export type AnalyticsEvent =
  | "app_opened"
  | "onboarding_started"
  | "onboarding_completed"
  | "project_created"
  | "reels_link_entered"
  | "reels_analysis_started"
  | "reels_analysis_completed"
  | "reels_analysis_failed"
  | "adaptation_viewed"
  | "adaptation_topic_selected"
  | "own_idea_entered"
  | "script_generation_started"
  | "script_generated"
  | "script_saved"
  | "script_copied"
  | "script_added_to_plan"
  | "content_status_changed"
  | "content_marked_published"
  | "archive_opened"
  | "paywall_opened"
  | "single_analysis_purchased"
  | "subscription_started"
  | "user_returned_day_1"
  | "user_returned_day_7"
  | "caption_generated"
  | "carousel_generated"
  | "plan_opened"
  | "library_opened";

type QueueItem = { event: string; props?: Record<string, unknown>; ts: number };

let queue: QueueItem[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_DELAY = 3000;
const MAX_BATCH = 10;

async function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  try {
    await tgFetch("/api/analytics", {
      method: "POST",
      body: JSON.stringify({ events: batch }),
    });
  } catch {
    // глотаем — аналитика не критична
  }
}

function scheduleFlush() {
  if (queue.length >= MAX_BATCH) {
    void flush();
    return;
  }
  if (!flushTimer) {
    flushTimer = setTimeout(() => void flush(), FLUSH_DELAY);
  }
}

export function track(event: AnalyticsEvent, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  queue.push({ event, props, ts: Date.now() });
  scheduleFlush();
}

// Сброс очереди перед уходом со страницы.
if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
}
