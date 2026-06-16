/**
 * Тонкий in-memory кеш для клиентских fetch'ей.
 * Цель — мгновенный рендер на возврате на экран (peek синхронно)
 * + фоновая ревалидация при заходе.
 *
 * TTL по умолчанию — 60с. На действия (создал проект, оплатил)
 * руками вызвать bustCache(key) или bustCache() (полный сброс).
 */

type Entry<T> = { data: T; at: number };

const store = new Map<string, Entry<unknown>>();
const DEFAULT_TTL_MS = 60_000;

export function peek<T>(key: string, ttlMs: number = DEFAULT_TTL_MS): T | null {
  const e = store.get(key) as Entry<T> | undefined;
  if (!e) return null;
  if (Date.now() - e.at > ttlMs) return null;
  return e.data;
}

export function set<T>(key: string, data: T): void {
  store.set(key, { data, at: Date.now() });
}

export function bust(key?: string): void {
  if (key) store.delete(key);
  else store.clear();
}
