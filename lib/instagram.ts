// Instagram Graph API wrapper — скелет. Реальные вызовы добавляем поэтапно.
//
// Этапы:
//   1) Аркадий-редактор ✅
//   2) Михаил Reels-maker (HeyGen + Whisper + FFmpeg на VPS) — TODO
//   3) Виктор-публикатор IG (Graph API) — TODO
//   4) Милана Контент-директор (анализ + план) — TODO
//
// Что нужно для реальной работы (когда дойдём):
//   - INSTAGRAM_ACCESS_TOKEN (long-lived, через FB Page)
//   - INSTAGRAM_ACCOUNT_ID (IG Business account id)
//   - права: instagram_basic, instagram_content_publish,
//            pages_show_list, pages_read_engagement
//
// Docs: https://developers.facebook.com/docs/instagram-api

export type IgMediaKind = "reel" | "carousel" | "image";

export interface IgPublishResult {
  ok: boolean;
  media_id?: string;
  permalink?: string;
  error?: string;
}

export interface IgAccountInfo {
  username: string;
  account_id: string;
  followers: number;
  posts_count: number;
}

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

function token(): string | null {
  return process.env.INSTAGRAM_ACCESS_TOKEN || null;
}

function defaultAccountId(): string | null {
  return process.env.INSTAGRAM_ACCOUNT_ID || null;
}

/** Заглушка: вернёт инфо об аккаунте. Сейчас просто валидирует токен. */
export async function fetchAccountInfo(accountId?: string): Promise<IgAccountInfo | null> {
  const t = token();
  const id = accountId || defaultAccountId();
  if (!t || !id) return null;
  // TODO Этап 4: GET /{id}?fields=username,followers_count,media_count
  return null;
}

/** Заглушка: загрузка одного Reel. */
export async function publishReel(_args: {
  accountId: string;
  videoUrl: string;
  caption: string;
  coverUrl?: string;
}): Promise<IgPublishResult> {
  // TODO Этап 3:
  //   1) POST /{accountId}/media (media_type=REELS, video_url, caption, cover_url) → creation_id
  //   2) polling GET /{creation_id}?fields=status_code (FINISHED|IN_PROGRESS|ERROR)
  //   3) POST /{accountId}/media_publish (creation_id) → media_id
  return { ok: false, error: "not implemented" };
}

/** Заглушка: загрузка карусели. */
export async function publishCarousel(_args: {
  accountId: string;
  mediaUrls: string[]; // 2..10 картинок
  caption: string;
}): Promise<IgPublishResult> {
  // TODO Этап 3:
  //   1) для каждой картинки POST /{accountId}/media (is_carousel_item=true, image_url) → child_id
  //   2) POST /{accountId}/media (media_type=CAROUSEL, children=child_ids, caption) → creation_id
  //   3) POST /{accountId}/media_publish (creation_id)
  return { ok: false, error: "not implemented" };
}

/** Заглушка: одиночный пост-картинка. */
export async function publishImage(_args: {
  accountId: string;
  imageUrl: string;
  caption: string;
}): Promise<IgPublishResult> {
  return { ok: false, error: "not implemented" };
}

export function igConfigured(): boolean {
  return !!token() && !!defaultAccountId();
}

export { GRAPH_BASE };
