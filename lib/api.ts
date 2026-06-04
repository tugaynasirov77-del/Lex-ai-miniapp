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
  | "scheduled"
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
  scheduled_at?: string | null;
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
  title: string;
  platform?: "telegram" | "instagram";
};

export type CreateProjectResult = { project?: { id: string }; projectId?: string };

export type ProjectDTO = {
  id: string;
  title: string;
  platform: "telegram" | "instagram";
  status?: string | null;
  channel_username?: string | null;
  channel_title?: string | null;
  channel_subscribers?: number | null;
  instagram_username?: string | null;
  instagram_followers?: number | null;
  created_at?: string;
  updated_at?: string;
};

export function listProjects(): Promise<{ projects: ProjectDTO[] }> {
  return getJSON("/api/projects");
}

export function getProject(projectId: string): Promise<{ project: ProjectDTO }> {
  return getJSON(`/api/projects/${projectId}`);
}

// --- aggregated content for ProjectScreen ---

export type IgAggregateReel = {
  id: string;
  body?: string;
  video_url?: string | null;
  cover_url?: string | null;
  status?: string;
  scheduled_at?: string | null;
  created_at: string;
  ig_permalink?: string | null;
  published_at?: string | null;
  job?: { id?: string; status?: string; phase?: string | null } | null;
};

export type IgAggregateCarousel = {
  id: string;
  body?: string;
  media_urls?: any[];
  status?: string;
  scheduled_at?: string | null;
  created_at: string;
  ig_permalink?: string | null;
  published_at?: string | null;
};

export type IgAggregateCompetitor = {
  id: string;
  username: string;
  followers?: number | null;
  notes?: string | null;
};

export type IgAggregateSnapshot = {
  followers?: number | null;
  posts_count?: number | null;
  reels_count?: number | null;
  snapshot_at: string;
};

export type IgAggregateDTO = {
  project: ProjectDTO;
  reels: IgAggregateReel[];
  carousels: IgAggregateCarousel[];
  competitors: IgAggregateCompetitor[];
  snapshots: IgAggregateSnapshot[];
};

export function getProjectIg(projectId: string): Promise<IgAggregateDTO> {
  return getJSON(`/api/projects/${projectId}/ig`);
}

export type TgDraftRow = {
  id: string;
  body?: string;
  status?: string;
  scheduled_at?: string | null;
  created_at?: string;
  content_type?: string;
  published_message_id?: number | null;
};

export function getProjectDrafts(
  projectId: string,
  status?: string,
): Promise<{ drafts: TgDraftRow[] }> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return getJSON(`/api/projects/${projectId}/drafts${q}`);
}

// --- IG analyze / plan (для Scout tab) ---

export type IgAnalysisDTO = {
  id: string;
  result: {
    executive_summary?: string;
    content_themes?: string[];
    hook_patterns?: string[];
    opportunities?: string[];
    content_gaps?: string[];
  };
  created_at: string;
};

export function getProjectIgAnalysis(
  projectId: string,
): Promise<{ analysis: IgAnalysisDTO | null }> {
  return getJSON(`/api/projects/${projectId}/ig/analyze`);
}

export type IgPlanDTO = {
  id: string;
  week_start: string;
  items: Array<{
    day?: string;
    format?: string;
    topic?: string;
    hook?: string;
    priority?: string;
  }>;
  summary?: any;
  created_at: string;
};

export function getProjectIgPlan(
  projectId: string,
): Promise<{ plan: IgPlanDTO | null }> {
  return getJSON(`/api/projects/${projectId}/ig/plan`);
}

// --- IG analyze / plan actions (для Scout actions) ---

export function runIgAnalysis(
  projectId: string,
): Promise<{ ok: true; analysis?: IgAnalysisDTO; cost?: number }> {
  return postJSON(`/api/projects/${projectId}/ig/analyze`, {});
}

export function runIgPlan(
  projectId: string,
): Promise<{ ok: true; plan?: IgPlanDTO; cost?: number }> {
  return postJSON(`/api/projects/${projectId}/ig/plan`, {});
}

// --- attach IG (минимальный inline-flow в Settings) ---

export function attachInstagram(
  projectId: string,
  payload: { username: string; account_id?: string; followers?: number },
): Promise<{ project: ProjectDTO }> {
  return postJSON(`/api/projects/${projectId}/attach-instagram`, payload);
}

export function attachChannel(
  projectId: string,
  payload: { channel: string },
): Promise<{ project: ProjectDTO } & Record<string, unknown>> {
  return postJSON(`/api/projects/${projectId}/attach-channel`, payload);
}

export function updateProject(
  projectId: string,
  patch: { title?: string; publish_time?: string; publish_timezone?: string },
): Promise<{ ok: true; project: ProjectDTO }> {
  return patchJSON(`/api/projects/${projectId}`, patch);
}

export async function deleteProject(projectId: string): Promise<{ ok: true }> {
  const r = await tgFetch(`/api/projects/${projectId}`, { method: "DELETE" });
  if (!r.ok) throw new ApiError(r.status, await readError(r));
  return (await r.json()) as { ok: true };
}

export async function createProject(payload: CreateProjectPayload): Promise<{ projectId: string }> {
  const r = await postJSON<CreateProjectPayload, CreateProjectResult>("/api/projects", payload);
  const id = r.projectId || r.project?.id;
  if (!id) throw new ApiError(500, "projectId missing in response");
  return { projectId: id };
}

// ---------------------------------------------------------------------------
// reel upload (signed URL + proxy + create job)
// ---------------------------------------------------------------------------

export type SignUploadPayload = { size: number; duration: number; ext: string };
export type SignUploadResult = {
  proxy_url: string;
  upload_token: string;
  storage_path: string;
  bucket: string;
  source_video_url: string;
  max_bytes: number;
  max_duration_sec: number;
};

export function signReelUpload(
  projectId: string,
  payload: SignUploadPayload,
): Promise<SignUploadResult> {
  return postJSON(`/api/projects/${projectId}/ig/reels/upload-url`, payload);
}

export type CreateReelJobPayload = {
  source_video_url: string;
  source_video_size: number;
  source_video_duration: number;
  preset?: string;
};

export type CreateReelJobResult = {
  draft_id: string;
  reel_job_id: string;
  queued: boolean;
};

export function createReelJob(
  projectId: string,
  payload: CreateReelJobPayload,
): Promise<CreateReelJobResult> {
  return postJSON(`/api/projects/${projectId}/ig/reels`, payload);
}

export type ReelAnimation = "slide_up" | "pop" | "fade";

export type ApproveReelPayload = {
  key_indices: number[];
  animation: ReelAnimation;
};

export function approveReel(
  projectId: string,
  draftId: string,
  payload: ApproveReelPayload,
): Promise<{ ok: true; job_id: string }> {
  return postJSON(`/api/projects/${projectId}/ig/reels/${draftId}/approve`, payload);
}

// ---------------------------------------------------------------------------
// publish reel (IG Graph API через Виктор-публикатор)
// ---------------------------------------------------------------------------

export type PublishReelResult =
  | { ok: true; media_id: string; permalink?: string | null }
  | { ok: false; stub: true; message: string }
  | { ok: false; error: string };

/**
 * POST /api/projects/[id]/ig/publish с {draft_id}.
 *
 * Эндпоинт возвращает 501 с `stub:true` если INSTAGRAM_ACCESS_TOKEN не настроен —
 * это ожидаемое состояние MVP, обрабатываем graceful, без throw.
 *
 * Любые другие non-2xx — ApiError.
 */
export async function publishReel(
  projectId: string,
  draftId: string,
): Promise<PublishReelResult> {
  const r = await tgFetch(`/api/projects/${projectId}/ig/publish`, {
    method: "POST",
    body: JSON.stringify({ draft_id: draftId }),
  });
  const data = await r.json().catch(() => ({}) as any);
  if (r.status === 501 && data?.stub) {
    return { ok: false, stub: true, message: data.message || "Publish не настроен" };
  }
  if (!r.ok) {
    throw new ApiError(r.status, data?.error || `HTTP ${r.status}`);
  }
  return data as PublishReelResult;
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

// ---------------------------------------------------------------------------
// review actions (approve / reject) — minimal contract, post/carousel/plan
// ---------------------------------------------------------------------------

export type ApproveDraftResult = {
  ok: true;
  scheduled_at?: string;
  already?: boolean;
};

export function approveDraft(draftId: string): Promise<ApproveDraftResult> {
  return postJSON(`/api/drafts/${draftId}/approve`, {});
}

export function rejectDraft(
  draftId: string,
  reason?: string,
): Promise<{ ok: true; already?: boolean }> {
  return postJSON(`/api/drafts/${draftId}/reject`, { reason });
}

export function approveWeeklyPlan(
  planId: string,
): Promise<{ ok: true; already?: boolean }> {
  return postJSON(`/api/weekly-plans/${planId}/approve`, {});
}

export function rejectWeeklyPlan(
  planId: string,
  reason?: string,
): Promise<{ ok: true; already?: boolean }> {
  return postJSON(`/api/weekly-plans/${planId}/reject`, { reason });
}
