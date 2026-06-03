import { NextRequest } from "next/server";
import { getSupabase } from "../../../../lib/supabase";
import { verifyInitData } from "../../../../lib/verifyTelegram";

export const runtime = "nodejs";

/**
 * GET /api/drafts/[id]
 * Polling endpoint. Возвращает DraftDTO-shape для post / carousel.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const sb = getSupabase();

  const { data: draft } = await sb
    .from("content_drafts")
    .select(
      "id,project_id,content_type,status,body,slides_data,decided_at,published_message_id,created_at,projects!inner(tg_id)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!draft) return Response.json({ error: "not found" }, { status: 404 });
  if ((draft as any).projects.tg_id !== v.user.id) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const contentType = (draft as any).content_type;
  if (contentType !== "post" && contentType !== "carousel") {
    return Response.json({ error: "wrong content_type" }, { status: 400 });
  }

  // Маппинг status → DraftStatus (generating|reviewing|ready|published|failed).
  // content_drafts.status в существующей схеме: pending|ready|approved|rejected|published.
  // Для flow polling: pending→generating, ready→ready, approved→ready (юзер уже approve'нул),
  // published→published, rejected→failed.
  const rawStatus = String((draft as any).status || "");
  const dtoStatus =
    rawStatus === "pending"
      ? "generating"
      : rawStatus === "rejected"
        ? "failed"
        : rawStatus === "approved"
          ? "ready"
          : rawStatus === "published"
            ? "published"
            : rawStatus === "ready"
              ? "ready"
              : "generating";

  const slidesData = (draft as any).slides_data as
    | { slides?: Array<{ idx: number; text: string }>; caption?: string }
    | null
    | undefined;

  return Response.json({
    id: draft.id,
    project_id: (draft as any).project_id,
    format: contentType,
    status: dtoStatus,
    phase: null,
    text: contentType === "post" ? (draft as any).body || "" : undefined,
    slides: contentType === "carousel" ? slidesData?.slides || [] : undefined,
    caption: contentType === "carousel" ? slidesData?.caption || (draft as any).body : undefined,
    error: null,
    updated_at: (draft as any).decided_at || (draft as any).created_at,
  });
}
