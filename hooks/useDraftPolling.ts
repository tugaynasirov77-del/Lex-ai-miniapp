"use client";

import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  getDraft,
  getWeeklyPlan,
  type DraftDTO,
  type WeeklyPlanDTO,
} from "../lib/api";

type Kind = "draft" | "weekly-plan";

export type DraftPollData = DraftDTO | WeeklyPlanDTO;

export type DraftPollingResult = {
  data: DraftPollData | null;
  error: Error | null;
  isPolling: boolean;
  isTerminal: boolean;
  /** Удобный флаг — терминальный success (ready). */
  isReady: boolean;
  /** Терминальный fail. */
  isFailed: boolean;
};

const POLL_INITIAL = 2000;
const POLL_MAX = 5000;
const POLL_HIDDEN = 15000;
const POLL_ERROR = 4000;

const TERMINAL_OK = new Set(["ready", "scheduled", "published"]);
const TERMINAL_FAIL = new Set(["failed"]);

function isTerminalStatus(s: string | undefined): boolean {
  if (!s) return false;
  return TERMINAL_OK.has(s) || TERMINAL_FAIL.has(s);
}

/**
 * Polling статуса draft (post / carousel) или weekly-plan.
 *
 * - backoff: 2s → 3s → 4s → 5s (cap), reset до 2s после visibilitychange.
 * - pause при document.hidden: следующий пинг через POLL_HIDDEN.
 * - abort всех таймеров при unmount / смене id.
 * - 404 трактуется как terminal-fail (объект удалён).
 *
 * Stop-условия — terminal status (ready/published/failed) или 404.
 */
export function useDraftPolling(kind: Kind, id: string | null): DraftPollingResult {
  const [data, setData] = useState<DraftPollData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isTerminal, setIsTerminal] = useState(false);

  const dataRef = useRef<DraftPollData | null>(null);
  dataRef.current = data;

  useEffect(() => {
    if (!id) {
      setIsPolling(false);
      return;
    }

    let aborted = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    setIsPolling(true);
    setIsTerminal(false);
    setError(null);
    setData(null);

    const fetcher: (id: string) => Promise<DraftPollData> =
      kind === "draft" ? getDraft : getWeeklyPlan;

    const tick = (delay: number) => {
      if (aborted) return;
      timer = setTimeout(async () => {
        if (aborted) return;
        if (typeof document !== "undefined" && document.hidden) {
          tick(POLL_HIDDEN);
          return;
        }
        try {
          const d = await fetcher(id);
          if (aborted) return;
          setData(d);
          setError(null);
          if (isTerminalStatus(d.status)) {
            setIsTerminal(true);
            setIsPolling(false);
            return;
          }
          tick(Math.min(delay + 1000, POLL_MAX));
        } catch (e) {
          if (aborted) return;
          setError(e instanceof Error ? e : new Error(String(e)));
          if (e instanceof ApiError && e.status === 404) {
            setIsTerminal(true);
            setIsPolling(false);
            return;
          }
          tick(POLL_ERROR);
        }
      }, delay);
    };

    const onVisibility = () => {
      if (aborted) return;
      const cur = dataRef.current;
      if (!document.hidden && !isTerminalStatus(cur?.status)) {
        if (timer) clearTimeout(timer);
        tick(0);
      }
    };

    tick(POLL_INITIAL);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      aborted = true;
      setIsPolling(false);
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [kind, id]);

  const status = data?.status;
  return {
    data,
    error,
    isPolling,
    isTerminal,
    isReady: !!status && TERMINAL_OK.has(status),
    isFailed: !!status && TERMINAL_FAIL.has(status),
  };
}
