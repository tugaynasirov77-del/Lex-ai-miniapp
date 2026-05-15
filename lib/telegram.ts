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

export function tgFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("x-telegram-init-data", getInitData());
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return fetch(url, { ...init, headers });
}
