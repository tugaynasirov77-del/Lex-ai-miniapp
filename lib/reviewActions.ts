import { getSupabase } from "./supabase";

export type ReviewAction = "approve" | "reject" | "edit" | "reschedule";

export type LogEntry = {
  action: ReviewAction;
  at: string;
  by_tg_id: number;
  prev?: Record<string, any>;
  next?: Record<string, any>;
};

/** Атомарно: обновляет поля draft + append в review_log */
export async function transitionDraft(
  draftId: string,
  patch: Record<string, any>,
  log: LogEntry,
): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  const { data: cur } = await sb
    .from("content_drafts")
    .select("review_log")
    .eq("id", draftId)
    .maybeSingle();
  const prevLog = Array.isArray(cur?.review_log) ? (cur!.review_log as any[]) : [];
  const nextLog = [...prevLog, log].slice(-50); // последние 50

  const { error } = await sb
    .from("content_drafts")
    .update({ ...patch, review_log: nextLog })
    .eq("id", draftId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Проверка, что draft принадлежит проекту юзера. Возвращает draft или null. */
export async function authDraft(draftId: string, tgId: number) {
  const sb = getSupabase();
  const { data } = await sb
    .from("content_drafts")
    .select("id,project_id,content_type,platform,status,scheduled_at,text,body,chosen_title,caption,media_urls,video_url,published_message_id,projects!inner(tg_id)")
    .eq("id", draftId)
    .maybeSingle();
  if (!data) return null;
  if ((data as any).projects.tg_id !== tgId) return null;
  return data as any;
}
