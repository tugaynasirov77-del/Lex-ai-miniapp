"use client";

import { useState } from "react";
import { hapticSelection } from "../lib/telegram";

/**
 * Кнопка-пилюля, по тапу копирующая `text` в clipboard и показывающая
 * краткий feedback. В WebView без clipboard API тихо игнорирует —
 * не ломаем UX, дают возможность ввести руками.
 */
export default function TapToCopy({
  text,
  display,
  copiedLabel = "СКОПИРОВАНО ✓",
  style,
  className,
}: {
  text: string;
  /** Что показывать на кнопке (по умолчанию — `text`). */
  display?: React.ReactNode;
  copiedLabel?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handle = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        hapticSelection();
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* clipboard может быть недоступен в WebView — тихо игнорим */
    }
  };

  return (
    <button
      type="button"
      onClick={handle}
      aria-label={`Скопировать ${text}`}
      className={className}
      style={style}
    >
      {copied ? copiedLabel : display ?? text}
    </button>
  );
}
