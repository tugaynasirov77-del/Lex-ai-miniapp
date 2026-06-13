import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Telegram Bot Webhook для @Lex_app_bot.
 *
 * Главная задача: на /start (или любое сообщение) ответить
 * приветствием + inline-кнопкой «Открыть LEX AI» которая запускает
 * Mini App. Без этого юзеры, написавшие в бот, видели тишину.
 *
 * Регистрация (один раз):
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://lex-ai-miniapp.vercel.app/api/telegram/webhook&secret_token=<SECRET>"
 */

const MINI_APP_URL = "https://t.me/Lex_app_bot/lex";

const WELCOME = `LEX AI — ИИ-фабрика контента для Telegram и Instagram.

🎯 Анализирует конкурентов
✍️ Пишет посты, карусели и сценарии Reels
📲 Публикует в твой канал

Жми кнопку ниже, чтобы открыть приложение.`;

const HELP = `Команды:
/start — открыть приложение
/help — это сообщение

Все действия в самом приложении — жми «Открыть LEX AI».`;

function authOk(req: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true; // не настроен — пропускаем (dev mode)
  const got = req.headers.get("x-telegram-bot-api-secret-token");
  return got === secret;
}

async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: any,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: replyMarkup,
    }),
  }).catch(() => {/* swallow */});
}

function openAppKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🚀 Открыть LEX AI", url: MINI_APP_URL }],
    ],
  };
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) return new Response("forbidden", { status: 403 });

  let update: any;
  try {
    update = await req.json();
  } catch {
    return Response.json({ ok: true });
  }

  const msg = update?.message || update?.edited_message;
  if (!msg) return Response.json({ ok: true });

  const chatId = msg.chat?.id;
  if (typeof chatId !== "number") return Response.json({ ok: true });

  const text = String(msg.text || "").trim();

  // Все команды/любое сообщение в личке → приглашение в Mini App
  if (text === "/start" || text === "/start@Lex_app_bot") {
    await sendMessage(chatId, WELCOME, openAppKeyboard());
  } else if (text === "/help" || text === "/help@Lex_app_bot") {
    await sendMessage(chatId, HELP, openAppKeyboard());
  } else if (msg.chat?.type === "private") {
    // Любой другой текст в личке — мягкий ремайндер
    await sendMessage(
      chatId,
      "Не понял команду. Открой приложение и работай в нём — там всё под рукой.",
      openAppKeyboard(),
    );
  }
  // В каналах и группах не отвечаем — бот туда добавляется как админ
  // для публикации, а не для разговоров.

  return Response.json({ ok: true });
}
