/**
 * Cron: чистка bucket `raw-uploads` от mp4 старше 7 дней.
 * Запускается Vercel Cron'ом ежедневно. Защита: CRON_SECRET.
 *
 * Безопасность:
 *  - чистим ТОЛЬКО bucket `raw-uploads` (приватный, сырьё клиентов)
 *  - bucket `reels` (готовые видео для публикации) НЕ ТРОГАЕМ
 *  - удаляем только файлы с created_at < now - 7d
 *  - идемпотентно: если файла уже нет — игнорируем ошибку
 */
import { getSupabase } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "raw-uploads";
const KEEP_DAYS = 7;
const MAX_BATCH = 200;

function authOk(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const x = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  return x === secret;
}

type StorageObject = {
  name: string;
  id?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: { size?: number };
};

async function listRecursive(
  sb: ReturnType<typeof getSupabase>,
  prefix = "",
  acc: Array<{ path: string; created_at?: string; size?: number }> = []
): Promise<typeof acc> {
  const { data, error } = await sb.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw new Error(`list ${prefix || "/"}: ${error.message}`);

  for (const item of (data as StorageObject[]) || []) {
    const full = prefix ? `${prefix}/${item.name}` : item.name;
    // file vs folder: у файлов metadata присутствует
    if (item.metadata && item.metadata.size !== undefined) {
      acc.push({
        path: full,
        created_at: item.created_at,
        size: item.metadata.size,
      });
    } else if (item.id !== null) {
      // folder — рекурсия
      await listRecursive(sb, full, acc);
    }
  }
  return acc;
}

export async function GET(req: Request) {
  if (!authOk(req)) return new Response("forbidden", { status: 403 });

  const sb = getSupabase();
  const cutoff = Date.now() - KEEP_DAYS * 24 * 3600 * 1000;
  const stats = {
    listed: 0,
    candidates: 0,
    deleted: 0,
    errors: 0,
    bytes_freed: 0,
    skipped_active: 0,
  };
  const errors: string[] = [];

  let all: Awaited<ReturnType<typeof listRecursive>> = [];
  try {
    all = await listRecursive(sb);
  } catch (e: any) {
    return Response.json({ error: "list failed", detail: e.message }, { status: 500 });
  }
  stats.listed = all.length;

  // Защита: не трогаем файлы, на которые ссылается активный reel_job (не done/failed)
  // Это страховка на случай, если cleanup сработает на свежий job в `pending`
  const { data: activeJobs } = await sb
    .from("reel_jobs")
    .select("source_video_url")
    .in("status", ["pending", "claimed", "rendering", "awaiting_approval"]);
  const activePaths = new Set<string>();
  for (const j of activeJobs || []) {
    const url = (j as any).source_video_url as string | null;
    if (!url) continue;
    const m = url.match(new RegExp(`/${BUCKET}/(.+?)(?:\\?|$)`));
    if (m) activePaths.add(m[1]);
  }

  const toDelete: string[] = [];
  for (const f of all) {
    const ts = f.created_at ? new Date(f.created_at).getTime() : 0;
    if (!ts || ts >= cutoff) continue;
    if (activePaths.has(f.path)) {
      stats.skipped_active++;
      continue;
    }
    toDelete.push(f.path);
    stats.bytes_freed += f.size || 0;
  }
  stats.candidates = toDelete.length;

  // Удаляем батчами
  for (let i = 0; i < toDelete.length; i += MAX_BATCH) {
    const batch = toDelete.slice(i, i + MAX_BATCH);
    const { error } = await sb.storage.from(BUCKET).remove(batch);
    if (error) {
      stats.errors++;
      errors.push(`batch ${i}: ${error.message}`);
      continue;
    }
    stats.deleted += batch.length;
  }

  console.log(
    `[cleanup-raw-uploads] listed=${stats.listed} candidates=${stats.candidates} deleted=${stats.deleted} skipped_active=${stats.skipped_active} bytes_freed=${stats.bytes_freed} errors=${stats.errors}`
  );

  return Response.json({ ok: true, stats, errors: errors.slice(0, 10) });
}
