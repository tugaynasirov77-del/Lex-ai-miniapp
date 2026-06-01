import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../../lib/verifyTelegram";

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

const MAX_BYTES = 52_428_800; // 50 МБ (Supabase Free лимит; на Pro можно 100+)
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
    return Response.json({ error: `файл должен быть от 1 байта до 50 МБ (получено ${(size / 1_048_576).toFixed(1)} МБ)` }, { status: 400 });
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

  // Проверяем тарифный кап: сколько Reels в текущем месяце
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [{ count: usedThisMonth }, { data: budget }] = await Promise.all([
    sb
      .from("content_drafts")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("content_type", "reel")
      .gte("created_at", monthStart.toISOString()),
    sb.from("project_budget").select("reels_per_month").eq("project_id", projectId).maybeSingle(),
  ]);
  const cap = budget?.reels_per_month ?? 15;
  if ((usedThisMonth ?? 0) >= cap) {
    return Response.json({ error: `лимит тарифа: ${cap} Reels/мес. Использовано: ${usedThisMonth}.` }, { status: 402 });
  }

  // Генерим signed upload через Supabase Storage REST
  const storagePath = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const bucket = "raw-uploads";
  const supaUrl = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const signResp = await fetch(`${supaUrl}/storage/v1/object/upload/sign/${bucket}/${storagePath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: 600 }),
  });
  if (!signResp.ok) {
    const t = await signResp.text();
    return Response.json({ error: `sign failed: ${t.slice(0, 200)}` }, { status: 500 });
  }
  const signData = (await signResp.json()) as { url?: string; token?: string };
  if (!signData.token || !signData.url) {
    return Response.json({ error: "sign returned empty" }, { status: 500 });
  }

  // Финальный публичный путь (private bucket — будем читать service_role'ом из воркера)
  const sourceVideoUrl = `${supaUrl}/storage/v1/object/${bucket}/${storagePath}`;

  // signData.url имеет формат "/object/upload/sign/{bucket}/{path}?token=..."
  // полный путь — supaUrl + /storage/v1 + signData.url
  return Response.json({
    upload_url: `${supaUrl}/storage/v1${signData.url}`,
    token: signData.token,
    storage_path: storagePath,
    bucket,
    source_video_url: sourceVideoUrl,
    max_bytes: MAX_BYTES,
    max_duration_sec: MAX_DURATION_SEC,
    used_this_month: usedThisMonth ?? 0,
    cap,
  });
}
