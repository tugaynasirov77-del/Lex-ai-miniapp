/**
 * Тонкий клиентский API-слой. Не тащит бизнес-логику, не кэширует.
 * Каждый вызов = одна HTTP-операция с понятной типизацией.
 *
 * Используется flow-экранами (ProjectBrief, Upload, Review).
 */
import { tgFetch } from "./telegram";
import type { Brief, ContentFormat } from "../flow";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function readError(r: Response): Promise<string> {
  try {
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const d = await r.json();
      return d?.error || d?.message || `HTTP ${r.status}`;
    }
    return (await r.text()).slice(0, 300) || `HTTP ${r.status}`;
  } catch {
    return `HTTP ${r.status}`;
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function postJSON<TBody, TResp>(path: string, body: TBody): Promise<TResp> {
  const r = await tgFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (!r.ok) throw new ApiError(r.status, await readError(r));
  return (await r.json()) as TResp;
}

async function patchJSON<TBody, TResp>(path: string, body: TBody): Promise<TResp> {
  const r = await tgFetch(path, { method: "PATCH", body: JSON.stringify(body) });
  if (!r.ok) throw new ApiError(r.status, await readError(r));
  return (await r.json()) as TResp;
}

async function getJSON<TResp>(path: string): Promise<TResp> {
  const r = await tgFetch(path);
  if (!r.ok) throw new ApiError(r.status, await readError(r));
  return (await r.json()) as TResp;
}

// ---------------------------------------------------------------------------
// drafts (post / carousel)
// ---------------------------------------------------------------------------

export type DraftFormat = Extract<ContentFormat, "post" | "carousel">;

export type CreateDraftPayload = {
  format: DraftFormat;
  brief: Brief;
  /** Опционально: переиспользовать существующий проект. Если не передан — сервер создаст. */
  projectId?: string;
};

export type CreateDraftResult = {
  draftId: string;
  projectId: string;
};

export function createDraft(payload: CreateDraftPayload): Promise<CreateDraftResult> {
  return postJSON("/api/drafts", payload);
}

export type UpdateDraftPatch = Partial<{
  text: string;
  slides: Array<{ idx: number; text: string }>;
  caption: string;
  schedule_at: string | null;
}>;

export function updateDraft(draftId: string, patch: UpdateDraftPatch): Promise<{ ok: true }> {
  return patchJSON(`/api/drafts/${draftId}`, patch);
}

export type DraftDTO = {
  id: string;
  project_id: string;
  format: DraftFormat;
  status: string;
  text?: string;
  slides?: Array<{ idx: number; text: string }>;
  caption?: string;
  review_log?: unknown[];
  updated_at: string;
};

export function getDraft(draftId: string): Promise<DraftDTO> {
  return getJSON(`/api/drafts/${draftId}`);
}

// ---------------------------------------------------------------------------
// weekly plan
// ---------------------------------------------------------------------------

export type CreateWeeklyPlanPayload = {
  brief: Brief;
  projectId?: string;
};

export type CreateWeeklyPlanResult = {
  planId: string;
  projectId: string;
};

export function createWeeklyPlan(
  payload: CreateWeeklyPlanPayload,
): Promise<CreateWeeklyPlanResult> {
  return postJSON("/api/weekly-plans", payload);
}

// ---------------------------------------------------------------------------
// projects (опционально, если бэк требует явного create перед draft)
// ---------------------------------------------------------------------------

export type CreateProjectPayload = {
  format: ContentFormat;
  brief?: Brief;
};

export type CreateProjectResult = { projectId: string };

export function createProject(payload: CreateProjectPayload): Promise<CreateProjectResult> {
  return postJSON("/api/projects", payload);
}
