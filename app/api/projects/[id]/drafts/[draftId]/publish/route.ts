import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../../lib/verifyTelegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function authProject(req: NextRequest, projectId: string) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return { err: Response.json({ error: v.error ?? "unauthorized" }, { status: 401 }) };
  const sb = getSupabase();
  const { data } = await sb
    .from("projects")
    .select("id,channel_id,channel_username")
    .eq("id", projectId)
    .eq("tg_id", v.user.id)
    .maybeSingle();
  if (!data) return { err: Response.json({ error: "проект не найден" }, { status: 404 }) };
  return { tgId: v.user.id, project: data };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; draftId: string }> }) {
  const { id, draftId } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  if (!a.project.channel_id) return Response.json({ error: "у проекта нет привязанного канала" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const titleIndex = typeof body.titleIndex === "number" ? body.titleIndex : 0;

  const sb = getSupabase();
  const { data: draft } = await sb
    .from("content_drafts")
    .select("*")
    .eq("id", draftId)
    .eq("project_id", id)
    .maybeSingle();
  if (!draft) return Response.json({ error: "черновик не найден" }, { status: 404 });
  if (draft.status !== "approved") return Response.json({ error: "сначала одобри черновик" }, { status: 400 });
  if (draft.published_message_id) return Response.json({ error: "уже опубликован" }, { status: 400 });

  const chosenTitle = draft.title_variants?.[titleIndex] ?? draft.title_variants?.[0] ?? "";
  // title — plain text, экранируем спецсимволы HTML; body уже содержит размеченный Telegram HTML
  const escTitle = chosenTitle.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const text = escTitle ? `<b>${escTitle}</b>\n\n${draft.body}` : draft.body;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return Response.json({ error: "TELEGRAM_BOT_TOKEN missing" }, { status: 500 });

  // Выбор API: опрос → sendPoll, фото → sendPhoto, иначе текст
  let apiPath: string;
  const tgPayload: Record<string, any> = { chat_id: a.project.channel_id };

  if (draft.poll_data) {
    apiPath = "sendPoll";
    const pd = draft.poll_data as { question: string; options: string[]; type: "poll" | "quiz"; correct_option_id?: number | null; explanation?: string | null };
    tgPayload.question = pd.question.slice(0, 300);
    tgPayload.options = pd.options.slice(0, 4).map((o) => o.slice(0, 100));
    tgPayload.is_anonymous = true;
    if (pd.type === "quiz") {
      tgPayload.type = "quiz";
      tgPayload.correct_option_id = typeof pd.correct_option_id === "number" ? pd.correct_option_id : 0;
      if (pd.explanation) tgPayload.explanation = pd.explanation.slice(0, 200);
    } else {
      tgPayload.type = "regular";
      tgPayload.allows_multiple_answers = false;
    }
  } else if (draft.photo_url) {
    apiPath = "sendPhoto";
    tgPayload.parse_mode = "HTML";
    tgPayload.disable_web_page_preview = true;
    tgPayload.photo = draft.photo_url;
    tgPayload.caption = text.slice(0, 1024);
  } else {
    apiPath = "sendMessage";
    tgPayload.parse_mode = "HTML";
    tgPayload.disable_web_page_preview = true;
    tgPayload.text = text;
  }

  const tgRes = await fetch(`https://api.telegram.org/bot${token}/${apiPath}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(tgPayload),
  });
  const tgJson = await tgRes.json();
  if (!tgJson.ok) {
    return Response.json({ error: `Telegram: ${tgJson.description || "send failed"}` }, { status: 500 });
  }

  const messageId = tgJson.result?.message_id;
  await sb
    .from("content_drafts")
    .update({
      published_message_id: messageId,
      published_at: new Date().toISOString(),
      chosen_title: chosenTitle,
    })
    .eq("id", draftId);

  return Response.json({
    ok: true,
    message_id: messageId,
    link: `https://t.me/${a.project.channel_username}/${messageId}`,
  });
}
