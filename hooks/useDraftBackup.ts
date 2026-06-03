"use client";

import { useEffect, useRef } from "react";

/**
 * Дешёвый backup произвольного значения в localStorage с debounce.
 * Использование:
 *   useDraftBackup("lex.brief", brief);
 *   const restored = readDraftBackup<Brief>("lex.brief");
 */
export function useDraftBackup<T>(key: string, value: T, debounceMs = 400) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // private mode / quota exceeded — игнорим, backup необязателен
      }
    }, debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, value, debounceMs]);
}

export function readDraftBackup<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearDraftBackup(key: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}
