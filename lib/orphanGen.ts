import { getSupabase } from "./supabase";

const ORPHAN_AGE_MINUTES = 3;

/**
 * Ловит «зависшие» draft'ы в status='generating' старше N минут и
 * помечает их failed. Запускается из cron'а publish-scheduled
 * (тикает каждые 5 мин через UptimeRobot).
 *
 * Корень проблемы: на Vercel Hobby maxDuration=10s. Если AI-генерация
 * (Алина + Аркадий + retry) превышает бюджет, `after()` убивается
 * посреди работы — content_drafts.id остаётся в 'generating' навсегда.
 * UI polling ждёт terminal status → юзер видит вечный спиннер.
 *
 * Этот детектор закрывает дыру: через 3 мин запись → 'failed' с
 * понятным error, polling успешно завершается через 'failed' DTO,
 * UI рисует retry-баннер (см. openItem.failed в ProjectScreen).
 */
export async function orphanGeneratingDrafts(): Promise<{
  reclaimed: number;
  ids: string[];
}> {
  const sb = getSupabase();
  const cutoffIso = new Date(
    Date.now() - ORPHAN_AGE_MINUTES * 60_000,
  ).toISOString();

  // Placeholder = status='pending' AND body='' (CHECK не разрешает
  // 'generating'). Дополнительно ловим прямые 'generating' на случай
  // легаси-данных.
  const { data: stuck } = await sb
    .from("content_drafts")
    .select("id,status,body")
    .in("status", ["pending", "generating"])
    .lt("updated_at", cutoffIso)
    .limit(100);

  const ids = (stuck ?? [])
    .filter(
      (r) =>
        (r.status as string) === "generating" ||
        String((r as { body?: string }).body || "").trim().length === 0,
    )
    .map((r) => (r as { id: string }).id);
  if (ids.length === 0) return { reclaimed: 0, ids: [] };

  await sb
    .from("content_drafts")
    .update({
      status: "rejected", // 'failed' нет в CHECK; 'rejected' маппится в DTO 'failed'
      error: `generation timeout (>${ORPHAN_AGE_MINUTES}m)`,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);

  return { reclaimed: ids.length, ids };
}
