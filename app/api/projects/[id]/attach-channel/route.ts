import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../lib/supabase";
import { verifyInitData } from "../../../../../lib/verifyTelegram";
import {
  getChat,
  getChatMember,
  getChatMembersCount,
  getMe,
  normalizeUsername,
} from "../../../../../lib/telegramBot";

export const runtime = "nodejs";

const AGENT_ROLES = ["analyst", "scout", "writer", "editor", "strategist", "community"] as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const initData = req.headers.get("x-telegram-init-data");
  const v = verifyInitData(initData);
  if (!v.ok || !v.user) return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });
  const tgId = v.user.id;

  const { id: projectId } = await ctx.params;
  if (!projectId) return Response.json({ error: "project id required" }, { status: 400 });

  let body: { channel?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const raw = (body.channel ?? "").toString();
  const username = normalizeUsername(raw);
  if (!username || username.length < 4) {
    return Response.json({ error: "укажи @username канала или ссылку t.me/..." }, { status: 400 });
  }

  const sb = getSupabase();

  const { data: project, error: projErr } = await sb
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("tg_id", tgId)
    .single();
  if (projErr || !project) return Response.json({ error: "проект не найден" }, { status: 404 });

  let chat, bot, subscribers = 0, member;
  try {
    [chat, bot] = await Promise.all([getChat(username), getMe()]);
  } catch (e) {
    return Response.json(
      { error: `не нашёл канал @${username} — проверь имя или сделай его публичным` },
      { status: 400 }
    );
  }

  if (chat.type !== "channel" && chat.type !== "supergroup") {
    return Response.json(
      { error: `это ${chat.type}, нужен канал или супергруппа` },
      { status: 400 }
    );
  }

  try {
    [member, subscribers] = await Promise.all([
      getChatMember(chat.id, bot.id),
      getChatMembersCount(chat.id).catch(() => 0),
    ]);
  } catch {
    return Response.json(
      {
        error: "bot_not_in_channel",
        message: `Добавь @${bot.username ?? "Lex_app_bot"} в канал админом, потом нажми "Проверить ещё раз"`,
      },
      { status: 400 }
    );
  }

  if (member.status !== "administrator" && member.status !== "creator") {
    return Response.json(
      {
        error: "bot_not_admin",
        message: `@${bot.username ?? "Lex_app_bot"} должен быть АДМИНОМ канала (сейчас: ${member.status})`,
      },
      { status: 400 }
    );
  }

  const { data: updated, error: updErr } = await sb
    .from("projects")
    .update({
      channel_username: username,
      channel_id: chat.id,
      channel_title: chat.title ?? username,
      channel_subscribers: subscribers,
      bot_admin_status: member.status,
      channel_attached_at: new Date().toISOString(),
      title: project.title || (chat.title ?? username),
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("tg_id", tgId)
    .select()
    .single();
  if (updErr) return Response.json({ error: updErr.message }, { status: 500 });

  await sb.from("project_budget").upsert(
    { project_id: projectId, monthly_cap_usd: 1.0 },
    { onConflict: "project_id", ignoreDuplicates: true }
  );

  await sb.from("project_agents").upsert(
    AGENT_ROLES.map((role) => ({ project_id: projectId, role, status: "pending" as const })),
    { onConflict: "project_id,role", ignoreDuplicates: true }
  );

  return Response.json({ ok: true, project: updated });
}
