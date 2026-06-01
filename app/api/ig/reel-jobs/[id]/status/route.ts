import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../../lib/supabase";

export const runtime = "nodejs";

// Воркер отчитывается о прогрессе или финальном результате.
// PATCH: обновить status / heygen_video_id / progress
// POST с {video_url}: завершить успешно — записывает video_url в content_drafts
// POST с {error}: пометить failed
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (req.headers.get("x-worker-secret") !== process.env.WORKER_SECRET) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.heygen_video_id === "string") patch.heygen_video_id = body.heygen_video_id;
  if (typeof body.srt_text === "string") patch.srt_text = body.srt_text;

  const sb = getSupabase();
  const { error } = await sb.from("reel_jobs").update(patch).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (req.headers.get("x-worker-secret") !== process.env.WORKER_SECRET) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const sb = getSupabase();

  // failure path
  if (body.error) {
    const errMsg = String(body.error).slice(0, 500);
    const { data: job } = await sb.from("reel_jobs").select("draft_id,attempts").eq("id", id).maybeSingle();
    const attempts = (job?.attempts ?? 0) + 1;
    const nextStatus = attempts >= 3 ? "failed" : "pending"; // ретрай ещё 2 раза
    await sb
      .from("reel_jobs")
      .update({
        status: nextStatus,
        error: errMsg,
        attempts,
        claimed_by: null,
        claimed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    return Response.json({ ok: true, retry: nextStatus === "pending", attempts });
  }

  // success path
  const videoUrl = String(body.video_url || "").trim();
  const coverUrl = body.cover_url ? String(body.cover_url) : null;
  if (!videoUrl) return Response.json({ error: "video_url required" }, { status: 400 });

  const { data: job } = await sb.from("reel_jobs").select("draft_id,srt_text").eq("id", id).maybeSingle();
  if (!job) return Response.json({ error: "job not found" }, { status: 404 });

  await sb
    .from("reel_jobs")
    .update({
      status: "done",
      video_url: videoUrl,
      cover_url: coverUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  await sb
    .from("content_drafts")
    .update({
      video_url: videoUrl,
      cover_url: coverUrl,
    })
    .eq("id", job.draft_id);

  return Response.json({ ok: true });
}
