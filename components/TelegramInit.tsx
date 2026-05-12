"use client";
import { useEffect } from "react";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        requestFullscreen?: () => void;
        disableVerticalSwipes?: () => void;
        enableClosingConfirmation?: () => void;
      };
    };
  }
}

export default function TelegramInit() {
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    try { tg.ready(); } catch {}
    try { tg.expand(); } catch {}
    try { tg.requestFullscreen?.(); } catch {}
    try { tg.disableVerticalSwipes?.(); } catch {}
    try { tg.enableClosingConfirmation?.(); } catch {}
  }, []);
  return null;
}
