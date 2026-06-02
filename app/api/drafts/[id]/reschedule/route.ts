import { NextRequest } from "next/server";
import { verifyInitData } from "../../../../../lib/verifyTelegram";
import { authDraft, transitionDraft } from "../../../../../lib/reviewActions";

export const runtime = "nodejs";

const MAX_DAYS_AHEAD = 30;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const iso = String(body?.scheduled_at || "");
  const target = new Date(iso);
  if (!iso || isNaN(target.getTime())) {
    return Response.json({ error: "scheduled_at (ISO) required" }, { status: 400 });
  }
  const now = Date.now();
  if (target.getTime() < now - 60_000) {
    return Response.json({ error: "scheduled_at must be in the future" }, { status: 400 });
  }
  if (target.getTime() > now + MAX_DAYS_AHEAD * 24 * 3600 * 1000) {
    return Response.json({ error: `scheduled_at must be within ${MAX_DAYS_AHEAD} days` }, { status: 400 });
  }

  const draft = await authDraft(id, v.user.id);
  if (!draft) return Response.json({ error: "not found" }, { status: 404 });
  if (draft.published_message_id) return Response.json({ error: "already published" }, { status: 409 });

  const newIso = target.toISOString();
  const r = await transitionDraft(
    id,
    { status: "approved", scheduled_at: newIso, decided_at: new Date().toISOString() },
    {
      action: "reschedule",
      at: new Date().toISOString(),
      by_tg_id: v.user.id,
      prev: { scheduled_at: draft.scheduled_at },
      next: { scheduled_at: newIso },
    }
  );
  if (!r.ok) return Response.json({ error: r.error }, { status: 500 });
  return Response.json({ ok: true, scheduled_at: newIso });
}
