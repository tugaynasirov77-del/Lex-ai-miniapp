import { NextRequest } from "next/server";
import { verifyInitData } from "../../../../../lib/verifyTelegram";
import { authDraft, transitionDraft } from "../../../../../lib/reviewActions";

export const runtime = "nodejs";

/**
 * POST /api/drafts/[id]/approve
 * Body (optional): { scheduled_at?: string ISO, publish_now?: boolean }
 *
 * publish_now=true → scheduled_at = сейчас (cron подхватит за 5 мин)
 * scheduled_at указан → используем его
 * иначе → +1 час от now (legacy)
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({} as any));
  const publishNow = !!body?.publish_now;
  const customScheduledAt = body?.scheduled_at ? String(body.scheduled_at) : null;

  const draft = await authDraft(id, v.user.id);
  if (!draft) return Response.json({ error: "not found" }, { status: 404 });
  if (draft.published_message_id)
    return Response.json({ error: "already published" }, { status: 409 });

  let scheduled_at: string;
  if (publishNow) {
    scheduled_at = new Date().toISOString();
  } else if (customScheduledAt) {
    const t = new Date(customScheduledAt).getTime();
    if (isNaN(t)) {
      return Response.json({ error: "invalid scheduled_at" }, { status: 400 });
    }
    if (t < Date.now() - 60_000) {
      return Response.json({ error: "scheduled_at в прошлом" }, { status: 400 });
    }
    scheduled_at = new Date(t).toISOString();
  } else {
    scheduled_at = draft.scheduled_at || new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }

  const r = await transitionDraft(
    id,
    { status: "approved", scheduled_at, decided_at: new Date().toISOString() },
    {
      action: "approve",
      at: new Date().toISOString(),
      by_tg_id: v.user.id,
      prev: { status: draft.status, scheduled_at: draft.scheduled_at },
      next: { status: "approved", scheduled_at },
    }
  );
  if (!r.ok) return Response.json({ error: r.error }, { status: 500 });
  return Response.json({ ok: true, scheduled_at });
}
