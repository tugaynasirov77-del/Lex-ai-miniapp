"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, getReelJob, type ReelJobDTO, type ReelJobStatus } from "../lib/api";

export type ReelJobPollingResult = {
  data: ReelJobDTO | null;
  error: Error | null;
  isPolling: boolean;
  isTerminal: boolean;
  isDone: boolean;
  isFailed: boolean;
  isAwaitingApproval: boolean;
};

const POLL_INITIAL = 2000;
const POLL_MAX = 5000;
const POLL_HIDDEN = 15000;
const POLL_ERROR = 4000;

/** Условия остановки polling для reel_jobs. awaiting_approval — тоже стоп,
 *  юзеру нужно тапать слова, после approve запустится phase-2 отдельным flow. */
const STOP_STATUSES: ReelJobStatus[] = ["done", "failed", "awaiting_approval"];

function isStopStatus(s: ReelJobStatus | undefined): boolean {
  return !!s && STOP_STATUSES.includes(s);
}

/**
 * Polling reel_jobs.
 *
 * - backoff: 2s → 3s → 4s → 5s, reset до 2s после возврата видимости.
 * - pause при document.hidden (POLL_HIDDEN).
 * - 404 — terminal failed.
 * - stop на done / failed / awaiting_approval.
 */
export function useReelJobPolling(jobId: string | null): ReelJobPollingResult {
  const [data, setData] = useState<ReelJobDTO | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isTerminal, setIsTerminal] = useState(false);

  const dataRef = useRef<ReelJobDTO | null>(null);
  dataRef.current = data;

  useEffect(() => {
    if (!jobId) {
      setIsPolling(false);
      return;
    }

    let aborted = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    setIsPolling(true);
    setIsTerminal(false);
    setError(null);
    setData(null);

    const tick = (delay: number) => {
      if (aborted) return;
      timer = setTimeout(async () => {
        if (aborted) return;
        if (typeof document !== "undefined" && document.hidden) {
          tick(POLL_HIDDEN);
          return;
        }
        try {
          const d = await getReelJob(jobId);
          if (aborted) return;
          setData(d);
          setError(null);
          if (isStopStatus(d.status)) {
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
      if (!document.hidden && !isStopStatus(cur?.status)) {
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
  }, [jobId]);

  const status = data?.status;
  return {
    data,
    error,
    isPolling,
    isTerminal,
    isDone: status === "done",
    isFailed: status === "failed",
    isAwaitingApproval: status === "awaiting_approval",
  };
}
