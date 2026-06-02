import { NextRequest } from "next/server";
import { verifyInitData } from "../../../../../lib/verifyTelegram";
import { authDraft, transitionDraft } from "../../../../../lib/reviewActions";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const draft = await authDraft(id, v.user.id);
  if (!draft) return Response.json({ error: "not found" }, { status: 404 });
  if (draft.published_message_id) return Response.json({ error: "already published" }, { status: 409 });

  const r = await transitionDraft(
    id,
    { status: "rejected", scheduled_at: null, decided_at: new Date().toISOString() },
    {
      action: "reject",
      at: new Date().toISOString(),
      by_tg_id: v.user.id,
      prev: { status: draft.status, scheduled_at: draft.scheduled_at },
      next: { status: "rejected", scheduled_at: null },
    }
  );
  if (!r.ok) return Response.json({ error: r.error }, { status: 500 });
  return Response.json({ ok: true });
}
