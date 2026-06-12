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

  const { data: draftRaw } = await sb
    .from("content_drafts")
    .select(
      "id,project_id,content_type,status,body,caption,media_urls,decided_at,scheduled_at,error,published_message_id,created_at,updated_at,projects!inner(tg_id)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!draftRaw) return Response.json({ error: "not found" }, { status: 404 });
  if ((draftRaw as any).projects.tg_id !== v.user.id) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  // Inline orphan-check: если placeholder (status='pending' + body='')
  // висит >60 сек — Vercel after() явно убил функцию посреди работы.
  // Перемечаем в rejected (DTO 'failed') прямо сейчас, чтобы polling
  // получил terminal за следующий же тик (≤2 сек), а не ждал
  // cron-цикла UptimeRobot (до 5 мин).
  let draft = draftRaw as any;
  const stalePlaceholder =
    draft.status === "pending" &&
    String(draft.body || "").trim().length === 0 &&
    draft.updated_at &&
    Date.now() - new Date(draft.updated_at).getTime() > 60_000;
  if (stalePlaceholder) {
    await sb
      .from("content_drafts")
      .update({
        status: "rejected",
        error: "generation timeout (>60s)",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    draft = { ...draft, status: "rejected", error: "generation timeout (>60s)" };
  }

  const contentType = (draft as any).content_type;
  if (contentType !== "post" && contentType !== "carousel") {
    return Response.json({ error: "wrong content_type" }, { status: 400 });
  }

  // Маппинг status → DraftStatus (generating|reviewing|ready|published|failed).
  // content_drafts.status в существующей схеме: pending|ready|approved|rejected|published.
  // Для flow polling: pending→generating, ready→ready, approved→ready (юзер уже approve'нул),
  // published→published, rejected→failed.
  // Sync-генерация в POST /api/drafts кладёт status='pending', контент уже готов.
  // Маппим:
  //   pending/ready → 'ready'  (черновик ждёт решения)
  //   approved      → 'scheduled' (запланировано, ещё не опубликовано)
  //   published     → 'published'
  //   rejected      → 'failed'
  const rawStatus = String((draft as any).status || "");
  const rawBody = String((draft as any).body || "");
  // pending + пустой body = placeholder в процессе генерации.
  // pending + заполненный body = реально готовый draft.
  const isPlaceholder = rawStatus === "pending" && rawBody.trim().length === 0;
  const dtoStatus = isPlaceholder
    ? "generating"
    : rawStatus === "rejected" || rawStatus === "failed"
      ? "failed"
      : rawStatus === "published"
        ? "published"
        : rawStatus === "approved"
          ? "scheduled"
          : rawStatus === "ready" || rawStatus === "pending"
            ? "ready"
            : "generating";

  // Слайды карусели лежат в media_urls jsonb с полями из carouselWriter:
  // {index, title, body, ...}. Мап в DTO-формат {idx, text}.
  const rawSlides = Array.isArray((draft as any).media_urls)
    ? ((draft as any).media_urls as any[])
    : [];
  const slides = rawSlides.map((s, i) => ({
    idx: typeof s?.index === "number" ? s.index - 1 : i,
    text: [s?.title, s?.body].filter(Boolean).join("\n\n") || String(s?.text || ""),
  }));

  return Response.json({
    id: draft.id,
    project_id: (draft as any).project_id,
    format: contentType,
    status: dtoStatus,
    phase: null,
    text: contentType === "post" ? (draft as any).body || "" : undefined,
    slides: contentType === "carousel" ? slides : undefined,
    caption:
      contentType === "carousel"
        ? (draft as any).caption || (draft as any).body || ""
        : undefined,
    scheduled_at: (draft as any).scheduled_at ?? null,
    error: (draft as any).error ?? null,
    updated_at: (draft as any).decided_at || (draft as any).created_at,
  });
}
