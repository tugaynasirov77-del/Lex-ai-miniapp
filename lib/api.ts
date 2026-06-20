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
  // Quick Project Setup — расширенные поля онбординга проекта.
  niche?: string;
  audience?: string;
  content_goal?: string;
  content_style?: string;
  on_camera?: "yes" | "sometimes" | "no";
  what_sells?: string;
  content_language?: string;
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
  // Расширенные настройки проекта из Quick Project Setup (Welcome onboarding)
  niche?: string | null;
  audience?: string | null;
  content_goal?: string | null;
  content_style?: string | null;
  on_camera?: "yes" | "sometimes" | "no" | null;
  what_sells?: string | null;
  content_language?: string | null;
  created_at?: string;
  updated_at?: string;
};

// ── Новые типы для flow Reels → Сценарий → План ──

export type ContentStatus =
  | "idea"
  | "draft"
  | "scenario_ready"
  | "ready_to_shoot"
  | "shot"
  | "ready_to_publish"
  | "scheduled"
  | "published"
  | "archived"
  // Legacy (старые posts из TG-эпохи)
  | "pending"
  | "approved"
  | "rejected";

export type ContentType = "post" | "carousel" | "reel" | "idea" | "caption";

export type StoryboardScene = {
  scene: number;
  seconds: string;       // "0-3" / "3-12"
  action: string;        // что делает автор / что в кадре
  on_screen?: string;    // текст на экране
};

// Полный объект сценария Reels — 20+ полей из брифа.
// Сохраняется в content_drafts.scenario_data jsonb.
export type ReelScenarioData = {
  title: string;
  goal: string;
  hook: string;
  on_screen_text: string;
  voice_over: string;
  storyboard: StoryboardScene[];
  duration_sec: number;
  in_frame: string;
  angle: string;
  background: string;
  light: string;
  editing_hints: string;
  text_overlays: string[];
  music_hint: string;
  cta: string;
  caption: string;
  hashtags: string[];
  risks: string[];
  alt_hooks: string[];       // 2 альтернативных варианта
  alt_cta: string;           // 1 альтернативный CTA
};

export type ContentDraftDTO = {
  id: string;
  project_id: string;
  platform: "instagram" | "telegram";
  content_type: ContentType;
  status: ContentStatus;
  title?: string | null;
  body?: string | null;
  caption?: string | null;
  source_decode_id?: string | null;
  source_topic?: string | null;
  scenario_data?: ReelScenarioData | null;
  planned_for_date?: string | null;   // YYYY-MM-DD
  idea_text?: string | null;
  content_pack_id?: string | null;
  ig_post_url?: string | null;
  published_metrics?: { views?: number; likes?: number; comments?: number; saves?: number; shares?: number } | null;
  created_at?: string;
  updated_at?: string;
};

// Адаптированная тема — одна из 3 которые LEX предлагает после разбора Reels
export type AdaptedTopicDTO = {
  id?: string;           // опциональный client-side id для key/выбора
  title: string;         // название/идея Reels
  hook: string;          // пример хука
  rationale: string;     // короткое объяснение почему подходит проекту
  format: string;        // предполагаемый формат
  duration_sec: number;
};

export type AdaptResultDTO = {
  decode_id: string;
  topics: AdaptedTopicDTO[];
};

import * as clientCache from "./clientCache";

const CK_PROJECTS = "projects";
const CK_BILLING = "billing";
const CK_STREAK = "streak";

export async function listProjects(): Promise<{ projects: ProjectDTO[] }> {
  const r = await getJSON<{ projects: ProjectDTO[] }>("/api/projects");
  clientCache.set(CK_PROJECTS, r);
  return r;
}
export function peekProjects(): { projects: ProjectDTO[] } | null {
  return clientCache.peek<{ projects: ProjectDTO[] }>(CK_PROJECTS);
}

// --- billing summary (для тонкой плашки на Dashboard) ---

export type BillingSummary = {
  tier: "free" | "pro" | "business";
  current_config: { label: string; priceRub: number };
  subscription: { expires_at?: string | null } | null;
};

export async function getBillingSummary(): Promise<BillingSummary> {
  const r = await getJSON<BillingSummary>("/api/billing");
  clientCache.set(CK_BILLING, r);
  return r;
}
export function peekBilling(): BillingSummary | null {
  return clientCache.peek<BillingSummary>(CK_BILLING);
}

export type StreakDTO = { current: number; longest: number; today: boolean };
export async function getStreak(): Promise<StreakDTO> {
  const r = await getJSON<StreakDTO>("/api/streak");
  clientCache.set(CK_STREAK, r);
  return r;
}
export function peekStreak(): StreakDTO | null {
  return clientCache.peek<StreakDTO>(CK_STREAK);
}

export function bustClientCache(key?: "projects" | "billing" | "streak"): void {
  clientCache.bust(key);
}

// --- welcome onboarding ---

export async function getOnboardingStatus(): Promise<{ onboarding_completed: boolean }> {
  return getJSON<{ onboarding_completed: boolean }>("/api/user/prefs/onboarding-done");
}

export async function markOnboardingDone(): Promise<{ ok: true }> {
  return postJSON<Record<string, never>, { ok: true }>(
    "/api/user/prefs/onboarding-done",
    {}
  );
}

// --- personal script (Reels сценарий) ---

export type ScriptRefineAction =
  | "shorter"
  | "sharper"
  | "calmer"
  | "expert"
  | "simpler"
  | "alternative";

export async function generateReelScript(
  projectId: string,
  topic: AdaptedTopicDTO,
  decodeId?: string,
): Promise<{ ok: true; scenario: ReelScenarioData }> {
  return postJSON(`/api/projects/${projectId}/ig/script`, {
    topic,
    decode_id: decodeId,
  });
}

export async function refineScriptBlock(
  projectId: string,
  args: { block_name: string; current_text: string; action: ScriptRefineAction },
): Promise<{ ok: true; text: string }> {
  return postJSON(`/api/projects/${projectId}/ig/script/refine`, args);
}

export type SaveScenarioDraftPayload = {
  content_type: "reel";
  status: string;
  title: string;
  source_decode_id?: string;
  source_topic?: string;
  scenario_data: ReelScenarioData;
  body?: string;
  caption?: string;
  planned_for_date?: string;
};

export async function saveScenarioDraft(
  projectId: string,
  payload: SaveScenarioDraftPayload,
): Promise<{ id: string }> {
  return postJSON(`/api/projects/${projectId}/drafts`, payload);
}

export async function setDraftPlannedDate(
  draftId: string,
  plannedForDate: string | null,
): Promise<{ ok: true }> {
  return patchJSON(`/api/drafts/${draftId}`, { planned_for_date: plannedForDate });
}

// --- content pack (одна идея → несколько форматов) ---

export type ContentPackReel = {
  title: string;
  hook: string;
  on_screen_text: string;
  voice_over: string;
  storyboard: { scene: number; seconds: string; action: string; on_screen?: string }[];
  duration_sec: number;
  cta: string;
};

export type ContentPackCarousel = {
  topic: string;
  hook: string;
  slides: { num: number; text: string }[];
  caption: string;
  hashtags: string[];
};

export type ContentPackCaption = { text: string; hashtags: string[] };

export type ContentPackDTO = {
  content_pack_id: string;
  reel: ContentPackReel;
  carousel: ContentPackCarousel;
  caption: ContentPackCaption;
};

export async function generateContentPack(
  projectId: string,
  topic: string,
): Promise<{ ok: true; content_pack_id: string; items: { id: string; content_type: string }[]; pack: { reel: ContentPackReel; carousel: ContentPackCarousel; caption: ContentPackCaption } }> {
  return postJSON(`/api/projects/${projectId}/ig/pack`, { topic });
}

export type CheckoutResp = { confirmation_url: string; payment_id: string };
export function createYooKassaCheckout(
  tier: "pro" | "business",
  period: "monthly" | "yearly" = "monthly",
): Promise<CheckoutResp> {
  return postJSON("/api/billing/yookassa-checkout", { tier, period });
}

// ───────────── Reel Decoder ─────────────

export type ReelMetadataDTO = {
  shortcode: string;
  video_url: string;
  caption: string;
  author_username: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  duration_sec: number;
};

export type ReelAnalysisDTO = {
  hook: {
    text: string;
    verbatim_quote?: string;
    type: string;
    seconds: number;
  };
  storyboard?: {
    scene: number;
    start: number;
    end: number;
    what_in_frame: string;
    what_said: string;
    effect: string;
  }[];
  structure: { start: number; end: number; label: string; text: string }[];
  format: string;
  engagement_triggers?: string[];
  takeaways?: string[];
  shoot_yourself?: string[];
  why_works: string[];
  adapt_to_brand: string;
  cta: string;
};

export type ReelDecodeDTO = {
  id?: string;
  metadata: ReelMetadataDTO;
  transcript: string;
  analysis: ReelAnalysisDTO;
};

export type ReelQuotaDTO = {
  tier: "free" | "pro" | "business";
  used: number;
  limit: number;
  period: "week" | "month";
};

export function decodeReel(
  projectId: string,
  url: string,
): Promise<{ cached: boolean; decode: ReelDecodeDTO; quota?: ReelQuotaDTO }> {
  return postJSON(`/api/projects/${projectId}/reel/decode`, { url });
}

export function listReelDecodes(
  projectId: string,
): Promise<{ items: any[]; quota: ReelQuotaDTO }> {
  return getJSON(`/api/projects/${projectId}/reel/decode`);
}

export type CaptionStyle = "viral" | "expert" | "story" | "sales" | "minimal";
export type CaptionVariantDTO = { style: CaptionStyle; style_label: string; text: string };
export type CaptionGenResultDTO = { variants: CaptionVariantDTO[]; hashtags: string[] };
export type CaptionQuotaDTO = { tier: "free" | "pro" | "business"; used: number; limit: number };

export function generateCaptions(
  projectId: string,
  topic: string,
): Promise<{ ok: true; result: CaptionGenResultDTO; quota: CaptionQuotaDTO }> {
  return postJSON(`/api/projects/${projectId}/ig/caption`, { topic });
}

// ───────────── Идеи для Reels на сегодня (под нишу проекта) ─────────────

export type DailyIdeaDTO = {
  title: string;
  category: string;
  tag: string;
  hook: string;
};

export function getDailyIdeas(
  projectId: string,
): Promise<{ ok: true; ideas: DailyIdeaDTO[]; cached: boolean }> {
  return getJSON(`/api/projects/${projectId}/ideas`);
}

// ───────────── Адаптация разбора под проект (3 темы) ─────────────

export function adaptDecodeToTopics(
  projectId: string,
  decodeId: string,
): Promise<{ ok: true; decode_id: string; topics: AdaptedTopicDTO[] }> {
  return postJSON(`/api/projects/${projectId}/ig/adapt`, {
    mode: "topics",
    decode_id: decodeId,
  });
}

export function refineMyTopic(
  projectId: string,
  decodeId: string,
  userIdea: string,
): Promise<{ ok: true; topic: AdaptedTopicDTO }> {
  return postJSON(`/api/projects/${projectId}/ig/adapt`, {
    mode: "refine",
    decode_id: decodeId,
    user_idea: userIdea,
  });
}

// §14: усиление сырой идеи без референсного разбора («Сценарий с нуля»).
export function refineIdeaStandalone(
  projectId: string,
  userIdea: string,
): Promise<{ ok: true; topic: AdaptedTopicDTO }> {
  return postJSON(`/api/projects/${projectId}/ig/refine-idea`, {
    user_idea: userIdea,
  });
}

// ───────────── Контент-план (Этап 2) ─────────────

export type PlanItemDTO = {
  id: string;
  title: string;
  content_type: ContentType;
  status: ContentStatus;
  planned_for_date: string;
};

export type PlanDayDTO = {
  date: string;       // YYYY-MM-DD
  weekday: string;    // Пн/Вт/...
  items: PlanItemDTO[];
};

export type PlanSummaryDTO = {
  total: number;
  planned: number;
  ready: number;
  published: number;
  progress_pct: number;
};

export type WeekPlanDTO = {
  project: { id: string; title: string };
  week_start: string;
  week_end: string;
  summary: PlanSummaryDTO;
  days: PlanDayDTO[];
};

export function getWeekPlan(
  projectId: string,
  weekStart?: string,
): Promise<WeekPlanDTO> {
  const q = weekStart ? `?week_start=${encodeURIComponent(weekStart)}` : "";
  return getJSON(`/api/projects/${projectId}/plan${q}`);
}

// Все материалы проекта (Library) — status='all' + опциональный фильтр по типу.
export function listProjectDrafts(
  projectId: string,
  opts?: { status?: string; type?: ContentType },
): Promise<{ drafts: ContentDraftDTO[] }> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.type) params.set("type", opts.type);
  const qs = params.toString();
  return getJSON(`/api/projects/${projectId}/drafts${qs ? `?${qs}` : ""}`);
}

// PATCH материала — смена статуса / даты плана / scenario_data.
export function updateDraft(
  draftId: string,
  patch: {
    status?: ContentStatus;
    planned_for_date?: string | null;
    scenario_data?: ReelScenarioData;
    title?: string;
    ig_post_url?: string;
    published_metrics?: { views?: number; likes?: number; comments?: number; saves?: number; shares?: number };
  },
): Promise<{ ok: true } | { id: string }> {
  return patchJSON(`/api/drafts/${draftId}`, patch);
}

export type RefineDirection = "shorter" | "sharper" | "emotional" | "specific";
export type RefinedPost = { hook: string; body: string; title: string };
export function refinePost(
  projectId: string,
  payload: { currentPost: string; direction: RefineDirection },
): Promise<{ post: RefinedPost }> {
  return postJSON(`/api/projects/${projectId}/lex/refine`, payload);
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

// ─── Brand Setup (IG) ────────────────────────────────────────────────────

export type BrandKit = {
  channel_title?: string;
  niche?: string;
  short_description?: string;
  voice?: string;
  audience?: string;
  goals?: string[];
  inspirations?: string[];
};

export type BrandSetupPayload = {
  niche: string;
  description: string;
  audience: string;
  tone: string;
  inspirations?: string[];
  reference_posts?: string[];
};

export function getBrandKit(projectId: string): Promise<{ brand_kit: BrandKit | null }> {
  return getJSON(`/api/projects/${projectId}/brand-setup`);
}

export function saveBrandSetup(
  projectId: string,
  payload: BrandSetupPayload,
): Promise<{ ok: true; brand_kit: BrandKit; insights?: any; cost?: number }> {
  return postJSON(`/api/projects/${projectId}/brand-setup`, payload);
}

export async function markPublishedExternally(
  draftId: string,
  flag: boolean,
): Promise<{ ok: true }> {
  const r = await fetch(`/api/drafts/${draftId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-init-data":
        typeof window !== "undefined"
          ? (window as any).Telegram?.WebApp?.initData || ""
          : "",
    },
    body: JSON.stringify({ published_externally: flag }),
  });
  if (!r.ok) throw new ApiError(r.status, await readError(r));
  return { ok: true };
}
