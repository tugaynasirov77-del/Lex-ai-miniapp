import { NextRequest } from "next/server";
import { getSupabase } from "../../../../lib/supabase";

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

// Web App URL — должен совпадать с тем что прописан в BotFather → /newapp.
// Бот @Lex_app_bot имеет has_main_web_app: true, значит запускаем главную WebApp.
const MINI_APP_WEB_URL = "https://lex-ai-miniapp.vercel.app";
// Fallback для клиентов без поддержки web_app кнопки (старые версии TG)
const MINI_APP_TME_URL = "https://t.me/Lex_app_bot?startapp";

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
  // web_app кнопка — самый надёжный способ открыть Mini App изнутри чата.
  // В inline_keyboard поддерживается всеми современными клиентами TG.
  return {
    inline_keyboard: [
      [{ text: "🚀 Открыть LEX AI", web_app: { url: MINI_APP_WEB_URL } }],
      [{ text: "Открыть в браузере", url: MINI_APP_TME_URL }],
    ],
  };
}

async function answerCallback(callbackId: string, text?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId, text }),
  }).catch(() => {});
}

async function handleCallback(cb: any) {
  const data = String(cb.data || "");
  const fromId = cb.from?.id;
  if (data === "reminders:off" && typeof fromId === "number") {
    const sb = getSupabase();
    await sb
      .from("user_prefs")
      .upsert(
        {
          tg_id: fromId,
          reminder_frequency: "off",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tg_id" },
      );
    await answerCallback(cb.id, "Напоминания выключены ✓");
    // Дополнительное подтверждение в чат
    if (cb.message?.chat?.id) {
      await sendMessage(
        cb.message.chat.id,
        "Готово, напоминания выключены. Включить обратно можно в самом приложении (раздел «Настройки» → «Напоминания»).",
      );
    }
    return;
  }
  await answerCallback(cb.id);
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) return new Response("forbidden", { status: 403 });

  let update: any;
  try {
    update = await req.json();
  } catch {
    return Response.json({ ok: true });
  }

  if (update?.callback_query) {
    await handleCallback(update.callback_query);
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
