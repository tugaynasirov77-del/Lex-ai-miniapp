import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { getSupabase } from "../../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../../lib/verifyTelegram";
import { enforceQuota } from "../../../../../../../lib/gating";

export const runtime = "nodejs";

// Выдаёт signed upload URL для прямой загрузки клиентом mp4 в Supabase Storage.
// Это обходит лимит Vercel в 4.5 МБ на serverless body.
//
// Поток:
//   1. Mini App → POST сюда: { filename, size, duration }
//   2. Мы валидируем лимит тарифа + размер + длительность
//   3. Возвращаем { upload_url, token, storage_path, source_video_url }
//   4. Mini App делает PUT на upload_url с mp4 и заголовком x-upsert
//   5. После успеха Mini App → POST /api/projects/[id]/ig/reels с source_video_url

const MAX_BYTES = 104_857_600; // 100 МБ (VPS-proxy ужмёт через FFmpeg если > 40 МБ перед загрузкой в Supabase)
const MAX_DURATION_SEC = 90;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id: projectId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const size = Number(body.size || 0);
  const duration = Number(body.duration || 0);
  const ext = String(body.ext || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");

  if (size <= 0 || size > MAX_BYTES) {
    return Response.json({ error: `файл должен быть от 1 байта до 100 МБ (получено ${(size / 1_048_576).toFixed(1)} МБ)` }, { status: 400 });
  }
  if (duration > 0 && duration > MAX_DURATION_SEC) {
    return Response.json({ error: `видео длиннее ${MAX_DURATION_SEC} секунд` }, { status: 400 });
  }

  const sb = getSupabase();

  // Проверяем что проект существует и принадлежит юзеру
  const { data: project } = await sb
    .from("projects")
    .select("id,platform")
    .eq("id", projectId)
    .eq("tg_id", v.user.id)
    .maybeSingle();
  if (!project) return Response.json({ error: "project not found" }, { status: 404 });

  // Tier-aware гейтинг через централизованный helper
  const gate = await enforceQuota({ projectId, tgId: v.user.id, action: "reel" });
  if (!gate.pass) return gate.response;

  // Mini App льёт mp4 на VPS-proxy (Cloudflare Tunnel) — обходим iOS-блокировку
  // на прямой PUT в Supabase Storage. Proxy валидирует token и стримит в bucket.
  const storagePath = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const bucket = "raw-uploads";
  const supaUrl = process.env.SUPABASE_URL!;

  const proxyUrl = process.env.UPLOAD_PROXY_URL;
  const workerSecret = process.env.WORKER_SECRET;
  if (!proxyUrl || !workerSecret) {
    return Response.json({ error: "UPLOAD_PROXY_URL / WORKER_SECRET not set" }, { status: 500 });
  }

  // HMAC-токен: <exp>.<sig>, где sig = HMAC(WORKER_SECRET, `${storage_path}|${exp}`)
  const exp = Math.floor(Date.now() / 1000) + 600;
  const sig = crypto
    .createHmac("sha256", workerSecret)
    .update(`${storagePath}|${exp}`)
    .digest("hex");
  const uploadToken = `${exp}.${sig}`;

  const sourceVideoUrl = `${supaUrl}/storage/v1/object/${bucket}/${storagePath}`;

  return Response.json({
    proxy_url: `${proxyUrl.replace(/\/$/, "")}/upload`,
    upload_token: uploadToken,
    storage_path: storagePath,
    bucket,
    source_video_url: sourceVideoUrl,
    max_bytes: MAX_BYTES,
    max_duration_sec: MAX_DURATION_SEC,
  });
}
