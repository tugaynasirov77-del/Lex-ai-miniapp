import type { AgentKey } from "./agents";

export type Feedback = "up" | "down" | null;

export interface RecentTaskEntry {
  id: string;
  title: string;
  agentId: AgentKey;
  agentName: string;
  reply: string;
  createdAt: number;
  feedback?: Feedback;
}

const KEY = "lex_recent_tasks";
const MAX = 20;

export function loadRecent(): RecentTaskEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushRecent(entry: Omit<RecentTaskEntry, "id" | "createdAt">): RecentTaskEntry[] {
  if (typeof window === "undefined") return [];
  const list = loadRecent();
  const next: RecentTaskEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  const updated = [next, ...list].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}

export function setFeedback(id: string, feedback: Feedback): RecentTaskEntry[] {
  if (typeof window === "undefined") return [];
  const list = loadRecent().map((t) => (t.id === id ? { ...t, feedback } : t));
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  return list;
}

export function formatAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  const d = Math.floor(h / 24);
  return `${d} д`;
}
