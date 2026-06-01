import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../lib/supabase";

export const runtime = "nodejs";

// Воркер на VPS пуллит сюда следующую pending-задачу. Авторизация через WORKER_SECRET.
// Атомарно: помечаем claimed, отдаём пейлоад.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-worker-secret");
  if (!secret || secret !== process.env.WORKER_SECRET) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const workerId = String(body.worker_id || "default").slice(0, 64);

  const sb = getSupabase();

  // Берём 1 pending, помечаем claimed.
  const { data: candidate, error: selErr } = await sb
    .from("reel_jobs")
    .select("id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selErr) return Response.json({ error: selErr.message }, { status: 500 });
  if (!candidate) return Response.json({ job: null });

  // Гонка-резистентный claim: update только если статус всё ещё pending
  const { data: claimed, error: claimErr } = await sb
    .from("reel_jobs")
    .update({
      status: "claimed",
      claimed_by: workerId,
      claimed_at: new Date().toISOString(),
      attempts: 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", candidate.id)
    .eq("status", "pending")
    .select("id,draft_id,project_id,script,overlays,attempts,mode,source_video_url,preset,transcript_words,user_selections")
    .maybeSingle();

  if (claimErr) return Response.json({ error: claimErr.message }, { status: 500 });
  if (!claimed) return Response.json({ job: null });

  // Подгружаем caption из связанного драфта (для итогового IG-поста)
  const { data: draft } = await sb
    .from("content_drafts")
    .select("body")
    .eq("id", claimed.draft_id)
    .maybeSingle();

  return Response.json({
    job: {
      id: claimed.id,
      draft_id: claimed.draft_id,
      project_id: claimed.project_id,
      mode: claimed.mode ?? "avatar",
      preset: claimed.preset ?? "expert_clean",
      source_video_url: claimed.source_video_url ?? null,
      transcript_words: claimed.transcript_words ?? null,
      user_selections: claimed.user_selections ?? null,
      script: claimed.script,
      overlays: claimed.overlays ?? [],
      caption: draft?.body ?? "",
      attempts: claimed.attempts,
    },
  });
}
