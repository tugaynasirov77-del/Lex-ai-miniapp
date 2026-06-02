import { NextRequest } from "next/server";
import { verifyInitData } from "../../../../../lib/verifyTelegram";
import { authDraft, transitionDraft } from "../../../../../lib/reviewActions";

export const runtime = "nodejs";

// Поля, которые можно править из review-экрана. video_url намеренно не разрешён —
// ре-рендер делается через отдельный flow Reels-pipeline.
const ALLOWED_FIELDS = new Set([
  "text",         // TG post body (новое поле)
  "body",         // TG post body (legacy в существующих драфтах)
  "chosen_title", // TG post title
  "caption",      // IG Reel/Carousel caption
  "media_urls",   // Carousel slides (jsonb массив)
]);

const MAX_TEXT_LEN = 4096;

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  if (!body || typeof body !== "object") {
    return Response.json({ error: "body required" }, { status: 400 });
  }

  const draft = await authDraft(id, v.user.id);
  if (!draft) return Response.json({ error: "not found" }, { status: 404 });
  if (draft.published_message_id) return Response.json({ error: "already published" }, { status: 409 });

  const patch: Record<string, any> = {};
  const prev: Record<string, any> = {};
  for (const k of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(k)) continue;
    let val = body[k];
    if (typeof val === "string" && val.length > MAX_TEXT_LEN) val = val.slice(0, MAX_TEXT_LEN);
    if (k === "media_urls" && !Array.isArray(val)) {
      return Response.json({ error: "media_urls must be array" }, { status: 400 });
    }
    patch[k] = val;
    prev[k] = (draft as any)[k];
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "no editable fields" }, { status: 400 });
  }

  patch.edited_at = new Date().toISOString();
  // После правки сбрасываем status в pending — чтобы юзер мог явно approve
  if (draft.status === "approved") patch.status = "pending";

  const r = await transitionDraft(id, patch, {
    action: "edit",
    at: new Date().toISOString(),
    by_tg_id: v.user.id,
    prev,
    next: patch,
  });
  if (!r.ok) return Response.json({ error: r.error }, { status: 500 });
  return Response.json({ ok: true });
}
