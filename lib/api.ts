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

/** Статусы content_drafts. Backend источник истины. */
export type DraftStatus =
  | "generating"
  | "reviewing"
  | "ready"
  | "published"
  | "failed";

export type DraftDTO = {
  id: string;
  project_id: string;
  format: DraftFormat;
  status: DraftStatus;
  /** Опц. под-фаза агента (если backend репортит). */
  phase?: "writing" | "review" | "finalize" | null;
  text?: string;
  slides?: Array<{ idx: number; text: string }>;
  caption?: string;
  review_log?: unknown[];
  error?: string | null;
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

export type WeeklyPlanStatus = "generating" | "reviewing" | "ready" | "failed";

export type WeeklyPlanDTO = {
  id: string;
  project_id: string;
  status: WeeklyPlanStatus;
  phase?: "research" | "writing" | "review" | null;
  ideas?: Array<{ idx: number; format: string; topic: string; hook: string }>;
  error?: string | null;
  updated_at: string;
};

export function getWeeklyPlan(planId: string): Promise<WeeklyPlanDTO> {
  return getJSON(`/api/weekly-plans/${planId}`);
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

// ---------------------------------------------------------------------------
// reel jobs
// ---------------------------------------------------------------------------

export type ReelJobStatus =
  | "pending"
  | "claimed"
  | "rendering"
  | "awaiting_approval"
  | "done"
  | "failed";

export type ReelJobPhase =
  | "download"
  | "validate"
  | "transcribe"
  | "render"
  | "upload"
  | null;

export type ReelJobDTO = {
  id: string;
  project_id: string;
  draft_id: string | null;
  status: ReelJobStatus;
  phase: ReelJobPhase;
  transcript_words?: Array<{ idx: number; w: string; start_ms: number; end_ms: number }>;
  video_url?: string | null;
  cover_url?: string | null;
  attempts?: number;
  error?: string | null;
  updated_at: string;
};

export function getReelJob(jobId: string): Promise<ReelJobDTO> {
  return getJSON(`/api/ig/reel-jobs/${jobId}`);
}
