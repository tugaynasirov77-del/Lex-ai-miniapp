export interface TgUser {
  id: number;
  first_name?: string;
  username?: string;
}

export function getTgUser(): TgUser | null {
  if (typeof window === "undefined") return null;
  const tg = (window as any).Telegram?.WebApp;
  const u = tg?.initDataUnsafe?.user;
  if (u && typeof u.id === "number") return u as TgUser;
  return null;
}

export function getTgId(): number | null {
  return getTgUser()?.id ?? null;
}

export function getInitData(): string {
  if (typeof window === "undefined") return "";
  return (window as any).Telegram?.WebApp?.initData ?? "";
}

function tg(): any {
  if (typeof window === "undefined") return null;
  return (window as any).Telegram?.WebApp ?? null;
}

export function hapticImpact(style: "light" | "medium" | "heavy" | "rigid" | "soft" = "light") {
  try { tg()?.HapticFeedback?.impactOccurred(style); } catch {}
}

export function hapticNotify(type: "success" | "warning" | "error") {
  try { tg()?.HapticFeedback?.notificationOccurred(type); } catch {}
}

export function hapticSelection() {
  try { tg()?.HapticFeedback?.selectionChanged(); } catch {}
}

export function showBackButton(onClick: () => void): () => void {
  const w = tg();
  if (!w?.BackButton) return () => {};
  const handler = () => onClick();
  w.BackButton.onClick(handler);
  w.BackButton.show();
  return () => {
    try { w.BackButton.offClick(handler); w.BackButton.hide(); } catch {}
  };
}

/**
 * Открыть t.me/... ссылку. В Telegram WebApp используем нативный
 * `openTelegramLink` (открывается внутри клиента, без выхода в браузер).
 * Вне WebApp — fallback в `location.href`.
 */
export function openTelegramLink(url: string): void {
  const w = tg();
  if (w?.openTelegramLink) {
    try {
      w.openTelegramLink(url);
      return;
    } catch {
      /* fall through */
    }
  }
  if (typeof window !== "undefined") {
    window.location.href = url;
  }
}

export function tgFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("x-telegram-init-data", getInitData());
  // FormData сама ставит правильный content-type с boundary — не перетираем
  if (init.body && !headers.has("content-type") && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  return fetch(url, { ...init, headers });
}
