"use client";

import { useEffect } from "react";
import { showBackButton } from "../lib/telegram";

/**
 * Подписка на Telegram BackButton. Показывает/прячет автоматически.
 * cleanup сам сделает hide+offClick при unmount или смене enabled/onBack.
 */
export function useTgBackButton(enabled: boolean, onBack: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const off = showBackButton(onBack);
    return off;
  }, [enabled, onBack]);
}
