import { getSupabase } from "./supabase";

type PollData = {
  question: string;
  options: string[];
  type: "poll" | "quiz";
  correct_option_id?: number | null;
  explanation?: string | null;
};

type DueDraft = {
  id: string;
  project_id: string;
  body: string;
  title_variants: string[] | null;
  photo_url: string | null;
  poll_data: PollData | null;
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
      "id,project_id,body,title_variants,photo_url,poll_data,publish_attempts,projects(channel_id,channel_username)"
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
      let apiPath: string;
      const tgBody: any = { chat_id: chat };

      if (d.poll_data) {
        // Опрос: sendPoll. Игнорируем body/photo — sendPoll сам по себе пост.
        apiPath = "sendPoll";
        tgBody.question = d.poll_data.question.slice(0, 300);
        tgBody.options = d.poll_data.options.slice(0, 4).map((o) => o.slice(0, 100));
        tgBody.is_anonymous = true;
        if (d.poll_data.type === "quiz") {
          tgBody.type = "quiz";
          tgBody.correct_option_id = typeof d.poll_data.correct_option_id === "number" ? d.poll_data.correct_option_id : 0;
          if (d.poll_data.explanation) tgBody.explanation = d.poll_data.explanation.slice(0, 200);
        } else {
          tgBody.type = "regular";
          tgBody.allows_multiple_answers = false;
        }
      } else if (d.photo_url) {
        apiPath = "sendPhoto";
        tgBody.parse_mode = "HTML";
        tgBody.photo = d.photo_url;
        tgBody.caption = text.slice(0, 1024);
      } else {
        apiPath = "sendMessage";
        tgBody.parse_mode = "HTML";
        tgBody.disable_web_page_preview = true;
        tgBody.text = text;
      }

      const r = await fetch(`https://api.telegram.org/bot${token}/${apiPath}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(tgBody),
      });
      const j = await r.json();

      if (!j.ok) {
        const attempts = (d.publish_attempts ?? 0) + 1;
        const desc = (j.description || "send failed").slice(0, 500);
        // Fatal-ошибки от Telegram — нет смысла ретраить, сразу failed.
        const fatal = /chat not found|bot was kicked|forbidden|not enough rights|chat_not_found|bot_not_in_channel|bot_not_admin/i.test(
          desc,
        );
        const goingFailed = fatal || attempts >= 5;
        await sb
          .from("content_drafts")
          .update({
            publish_attempts: attempts,
            publish_error: desc,
            ...(goingFailed ? { status: "failed" } : {}),
          })
          .eq("id", d.id);
        results.push({
          draft_id: d.id,
          error: j.description,
          ...(goingFailed ? { final: true } : {}),
        });
        continue;
      }

      const messageId = j.result?.message_id;
      await sb
        .from("content_drafts")
        .update({
          status: "published",
          published_message_id: messageId,
          published_at: new Date().toISOString(),
          chosen_title: chosenTitle,
          publish_error: null,
        })
        .eq("id", d.id);

      results.push({ draft_id: d.id, message_id: messageId, channel: d.projects?.channel_username });
    } catch (e: any) {
      const attempts = (d.publish_attempts ?? 0) + 1;
      const goingFailed = attempts >= 5;
      await sb
        .from("content_drafts")
        .update({
          publish_attempts: attempts,
          publish_error: (e.message || "exception").slice(0, 500),
          ...(goingFailed ? { status: "failed" } : {}),
        })
        .eq("id", d.id);
      results.push({ draft_id: d.id, error: e.message, ...(goingFailed ? { final: true } : {}) });
    }
  }

  return { processed: drafts.length, results };
}
