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

// --- billing summary (для тонкой плашки на Dashboard) ---

export type BillingSummary = {
  tier: "free" | "pro" | "business";
  current_config: { label: string; priceRub: number };
  subscription: { expires_at?: string | null } | null;
};

export function getBillingSummary(): Promise<BillingSummary> {
  return getJSON("/api/billing");
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
  error?: string | null;
  job?: {
    id?: string;
    status?: string;
    phase?: string | null;
    error?: string | null;
  } | null;
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
  error?: string | null;
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
  error?: string | null;
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

/**
 * Унифицированный план недели. Сохраняется как backward-compat alias —
 * ScoutTab всё ещё типизирует prop как IgPlanDTO, но реальный source
 * теперь lex_week_plan (через lexGetPlan).
 */
export type PlanDTO = {
  id?: string;
  week_start?: string;
  items: Array<{
    day?: string;
    format?: string;
    topic?: string;
    hook?: string;
    priority?: string;
    type?: string;
  }>;
  summary?: any;
  created_at?: string;
};

export type IgPlanDTO = PlanDTO;

// --- competitors (onboarding step 3a) ---

export function addTgCompetitor(
  projectId: string,
  payload: { username: string },
): Promise<unknown> {
  return postJSON(`/api/projects/${projectId}/competitors`, payload);
}

export function addIgCompetitor(
  projectId: string,
  payload: { handle: string; notes?: string },
): Promise<unknown> {
  return postJSON(`/api/projects/${projectId}/ig/competitors`, payload);
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

// ---------------------------------------------------------------------------
// review actions (approve / reject) — minimal contract, post/carousel/plan
// ---------------------------------------------------------------------------

export type ApproveDraftResult = {
  ok: true;
  scheduled_at?: string;
  already?: boolean;
};

export function approveDraft(
  draftId: string,
  opts?: { publish_now?: boolean; scheduled_at?: string },
): Promise<ApproveDraftResult> {
  return postJSON(`/api/drafts/${draftId}/approve`, opts || {});
}

export async function deleteDraft(draftId: string): Promise<{ ok: true }> {
  const r = await fetch(`/api/drafts/${draftId}`, {
    method: "DELETE",
    headers: {
      "x-telegram-init-data":
        typeof window !== "undefined"
          ? (window as any).Telegram?.WebApp?.initData || ""
          : "",
    },
  });
  if (!r.ok) throw new ApiError(r.status, await readError(r));
  return { ok: true };
}

export function rejectDraft(
  draftId: string,
  reason?: string,
): Promise<{ ok: true; already?: boolean }> {
  return postJSON(`/api/drafts/${draftId}/reject`, { reason });
}

// ─────────────────────────────────────────────────────────────────────────
// LEX AI (новый единый инструмент)
// ─────────────────────────────────────────────────────────────────────────

export type LexInsights = {
  niche_summary: string;
  audience_pains: string[];
  working_hooks: string[];
  content_themes: string[];
  tone_notes: string;
  pitfalls: string[];
  updated_at: string;
};

export type LexPostVariant = {
  hook: string;
  body: string;
  title: string;
};

export type LexCarousel = {
  topic: string;
  hook: string;
  image_prompt: string;
  slides: { num: number; text: string }[];
  caption: string;
  hashtags: string[];
};

export type LexReelScript = {
  topic: string;
  hook: string;
  scenes: { seconds: string; action: string; on_screen?: string }[];
  music_hint: string;
  caption: string;
  hashtags: string[];
  duration_sec: number;
};

export type CarouselStyle =
  | "minimal"
  | "pop"
  | "editorial"
  | "ai_tech"
  | "business";

export function lexAnalyze(
  projectId: string,
): Promise<{ ok: true; insights: LexInsights; cost: number }> {
  return postJSON(`/api/projects/${projectId}/lex/analyze`, {});
}

export function lexWritePost(
  projectId: string,
  topic: string,
): Promise<{
  ok: true;
  draftId: string;
  variants: LexPostVariant[];
  cost: number;
}> {
  return postJSON(`/api/projects/${projectId}/lex/post`, { topic });
}

export function lexWriteCarousel(
  projectId: string,
  topic: string,
  style: CarouselStyle = "minimal",
): Promise<{
  ok: true;
  draftId: string;
  carousel: LexCarousel;
  cost: number;
}> {
  return postJSON(`/api/projects/${projectId}/lex/carousel`, { topic, style });
}

export function lexWriteReel(
  projectId: string,
  topic: string,
  duration: 15 | 30 | 60 = 30,
): Promise<{
  ok: true;
  draftId: string;
  script: LexReelScript;
  cost: number;
}> {
  return postJSON(`/api/projects/${projectId}/lex/reel`, { topic, duration });
}

export type LexPlanIdea = {
  day: string;
  format: "post" | "carousel" | "reel";
  topic: string;
  hook: string;
};

export type LexWeekPlan = {
  ideas: LexPlanIdea[];
  generated_at: string;
};

export function lexGetPlan(projectId: string): Promise<{ plan: LexWeekPlan | null }> {
  return getJSON(`/api/projects/${projectId}/lex/plan`);
}

export function lexWritePlan(
  projectId: string,
): Promise<{ ok: true; plan: LexWeekPlan; cost: number }> {
  return postJSON(`/api/projects/${projectId}/lex/plan`, {});
}
