import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook для бота поддержки @Strateg_alex_bot.
 *
 * Логика:
 * - В личке юзер пишет жалобу → бот отвечает «принято» + форвардит
 *   в SUPPORT_CHAT_ID (numeric id группы поддержки).
 * - /start → приветствие
 * - В группе (где бот админ): /chat_id → отвечает её id, чтобы
 *   юзер прописал его в SUPPORT_CHAT_ID env.
 *
 * Регистрация webhook: /api/telegram/support-setup?secret=$CRON_SECRET
 */

const WELCOME = `Поддержка LEX AI.

Опиши проблему одним сообщением — мы ответим в течение суток.
Если есть скрин — пришли его.`;

const ACK_USER = `✓ Принято.

Передал команде. Ответим тебе сюда в течение суток.`;

function authOk(req: NextRequest): boolean {
  const secret = process.env.TELEGRAM_SUPPORT_WEBHOOK_SECRET;
  if (!secret) return true;
  return req.headers.get("x-telegram-bot-api-secret-token") === secret;
}

async function tgApi(method: string, body: any): Promise<any> {
  const token = process.env.TELEGRAM_SUPPORT_BOT_TOKEN;
  if (!token) return null;
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!r) return null;
  return r.json().catch(() => null);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) return new Response("forbidden", { status: 403 });

  let update: any;
  try {
    update = await req.json();
  } catch {
    return Response.json({ ok: true });
  }

  const msg = update?.message;
  if (!msg) return Response.json({ ok: true });

  const chatType = msg.chat?.type;
  const chatId = msg.chat?.id;
  const text = String(msg.text || "").trim();

  // ─── Группа / супергруппа: команда /chat_id ───
  if (chatType === "group" || chatType === "supergroup") {
    if (text === "/chat_id" || text === "/chat_id@Strateg_alex_bot") {
      await tgApi("sendMessage", {
        chat_id: chatId,
        text: `Chat ID этой группы: <code>${chatId}</code>\n\nПропиши его как SUPPORT_CHAT_ID в Vercel ENV — туда буду слать обращения.`,
        parse_mode: "HTML",
      });
    }
    return Response.json({ ok: true });
  }

  // ─── Личка ───
  if (chatType !== "private") return Response.json({ ok: true });

  // /start
  if (text === "/start") {
    await tgApi("sendMessage", { chat_id: chatId, text: WELCOME });
    return Response.json({ ok: true });
  }

  // Любое сообщение в личке = жалоба
  const user = msg.from || {};
  const userName = [user.first_name, user.last_name].filter(Boolean).join(" ") || "—";
  const userHandle = user.username ? `@${user.username}` : "—";
  const userId = user.id;

  // 1) Ack юзеру
  await tgApi("sendMessage", { chat_id: chatId, text: ACK_USER });

  // 2) Форвард в support-группу + сводка
  const supportChatId = process.env.SUPPORT_CHAT_ID;
  if (supportChatId) {
    const header =
      `🆘 <b>Новое обращение</b>\n` +
      `Юзер: <a href="tg://user?id=${userId}">${escapeHtml(userName)}</a> (${escapeHtml(userHandle)})\n` +
      `ID: <code>${userId}</code>\n` +
      `Чат для ответа: <code>${chatId}</code>`;

    await tgApi("sendMessage", {
      chat_id: supportChatId,
      text: header,
      parse_mode: "HTML",
    });

    // Форвард оригинала (сохраняет фото / голос / документы)
    await tgApi("forwardMessage", {
      chat_id: supportChatId,
      from_chat_id: chatId,
      message_id: msg.message_id,
    });
  }

  return Response.json({ ok: true });
}
