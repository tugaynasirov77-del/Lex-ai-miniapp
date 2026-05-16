import { getSupabase } from "./supabase";

type DueDraft = {
  id: string;
  project_id: string;
  body: string;
  title_variants: string[] | null;
  photo_url: string | null;
  publish_attempts: number;
  projects: { channel_id: string | null; channel_username: string | null } | null;
};

export async function publishDueDrafts(): Promise<{ processed: number; results: any[] }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { processed: 0, results: [{ error: "TELEGRAM_BOT_TOKEN missing" }] };

  const sb = getSupabase();
  const nowIso = new Date().toISOString();
  const { data: due } = await sb
    .from("content_drafts")
    .select(
      "id,project_id,body,title_variants,photo_url,publish_attempts,projects(channel_id,channel_username)"
    )
    .eq("status", "approved")
    .is("published_message_id", null)
    .lte("scheduled_at", nowIso)
    .lt("publish_attempts", 5)
    .limit(20);

  const drafts = (due ?? []) as unknown as DueDraft[];
  const results: any[] = [];

  for (const d of drafts) {
    const chat = d.projects?.channel_id;
    if (!chat) {
      results.push({ draft_id: d.id, skipped: "no channel_id" });
      continue;
    }

    const chosenTitle = d.title_variants?.[0] ?? "";
    const escTitle = chosenTitle.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const text = escTitle ? `<b>${escTitle}</b>\n\n${d.body}` : d.body;

    try {
      const apiPath = d.photo_url ? "sendPhoto" : "sendMessage";
      const tgBody: any = {
        chat_id: chat,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      };
      if (d.photo_url) {
        tgBody.photo = d.photo_url;
        tgBody.caption = text.slice(0, 1024);
      } else {
        tgBody.text = text;
      }

      const r = await fetch(`https://api.telegram.org/bot${token}/${apiPath}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(tgBody),
      });
      const j = await r.json();

      if (!j.ok) {
        await sb
          .from("content_drafts")
          .update({
            publish_attempts: (d.publish_attempts ?? 0) + 1,
            publish_error: (j.description || "send failed").slice(0, 500),
          })
          .eq("id", d.id);
        results.push({ draft_id: d.id, error: j.description });
        continue;
      }

      const messageId = j.result?.message_id;
      await sb
        .from("content_drafts")
        .update({
          published_message_id: messageId,
          published_at: new Date().toISOString(),
          chosen_title: chosenTitle,
          publish_error: null,
        })
        .eq("id", d.id);

      results.push({ draft_id: d.id, message_id: messageId, channel: d.projects?.channel_username });
    } catch (e: any) {
      await sb
        .from("content_drafts")
        .update({
          publish_attempts: (d.publish_attempts ?? 0) + 1,
          publish_error: (e.message || "exception").slice(0, 500),
        })
        .eq("id", d.id);
      results.push({ draft_id: d.id, error: e.message });
    }
  }

  return { processed: drafts.length, results };
}
