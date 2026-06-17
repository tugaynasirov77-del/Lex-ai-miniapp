import { NextRequest, after } from "next/server";
import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOKEN = () => process.env.BARTENDER_BOT_TOKEN!;
const FOLDER_ID = () => process.env.GOOGLE_DRIVE_FOLDER_ID!;

const WELCOME = `Привет! Я бот-бармен 🍸

Кидай голосовое или текст — назови напиток, ингредиенты и граммовку. Я соберу ТТК и пришлю Google-таблицу.

Пример: «Негрони, джин 30 мл, кампари 30 мл, вермут россо 30 мл, метод стир»`;

async function tg(method: string, body: any): Promise<any> {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  return r ? r.json().catch(() => null) : null;
}

async function tgGetFileUrl(fileId: string): Promise<string | null> {
  const r = await tg("getFile", { file_id: fileId });
  const path = r?.result?.file_path;
  return path ? `https://api.telegram.org/file/bot${TOKEN()}/${path}` : null;
}

const PARSE_PROMPT = `Ты — помощник бармена. Из текста ниже извлеки технологическую карту коктейля по форме «Акт контрольной проработки блюда».

Верни СТРОГО JSON без markdown, без комментариев, без обёртки. Структура:
{
  "name": "Название напитка",
  "yield_ml": число — выход блюда в мл,
  "ingredients": [
    {"name": "Наименование продукта", "unit": "мл" или "гр", "brutto": число, "netto": число}
  ],
  "technology": "Технология приготовления одним абзацем"
}

Правила:
- Жидкости (алкоголь, соки, сиропы, вода, пюре) — unit: "мл"
- Твёрдые украшения, фрукты, лёд, мята, цедра — unit: "гр"
- brutto всегда оставляй 0, заполняй только netto (для коктейлей потерь нет)
- yield_ml — оцени по сумме жидкостей, лёд в выход НЕ считай
- Технология: даже если бармен не сказал — придумай стандартную (билд/шейк/стир) исходя из состава, одним абзацем
- Названия ингредиентов с заглавной буквы
- Никаких лишних полей, никакого текста вне JSON

Текст бармена:
`;

type TTK = {
  name: string;
  yield_ml: number | string;
  ingredients: { name: string; unit: string; brutto: number; netto: number }[];
  technology: string;
};

async function transcribe(audioUrl: string): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const audioRes = await fetch(audioUrl);
  const buf = Buffer.from(await audioRes.arrayBuffer());
  const file = new File([new Uint8Array(buf)], "voice.ogg", { type: "audio/ogg" });
  const r = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    language: "ru",
  });
  return r.text;
}

async function parseDrink(text: string): Promise<TTK> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 2000,
    messages: [{ role: "user", content: PARSE_PROMPT + text }],
  });
  const block = msg.content[0];
  let raw = block.type === "text" ? block.text.trim() : "";
  if (raw.startsWith("```")) {
    raw = raw.split("```")[1] || raw;
    if (raw.startsWith("json")) raw = raw.slice(4);
    raw = raw.trim();
  }
  return JSON.parse(raw);
}

async function createSheet(ttk: TTK): Promise<string> {
  const r = await fetch(process.env.APPS_SCRIPT_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: process.env.APPS_SCRIPT_SECRET,
      folderId: FOLDER_ID(),
      ttk,
    }),
    redirect: "follow",
  });
  const data = await r.json();
  if (data.error) throw new Error(`Apps Script: ${data.error}`);
  if (!data.url) throw new Error(`Apps Script: no URL in response`);
  return data.url;
}

async function processMessage(msg: any) {
  const chatId = msg.chat.id;
  let text = "";

  try {
    if (msg.voice || msg.audio) {
      await tg("sendChatAction", { chat_id: chatId, action: "typing" });
      await tg("sendMessage", { chat_id: chatId, text: "🎙 Распознаю голосовое..." });
      const fileId = (msg.voice || msg.audio).file_id;
      const url = await tgGetFileUrl(fileId);
      if (!url) {
        await tg("sendMessage", { chat_id: chatId, text: "❌ Не смог скачать аудио." });
        return;
      }
      text = await transcribe(url);
      await tg("sendMessage", { chat_id: chatId, text: `📝 Услышал: «${text}»` });
    } else if (msg.text) {
      text = msg.text;
    } else {
      return;
    }

    await tg("sendChatAction", { chat_id: chatId, action: "typing" });
    await tg("sendMessage", { chat_id: chatId, text: "🧠 Составляю ТТК..." });
    const ttk = await parseDrink(text);

    await tg("sendMessage", { chat_id: chatId, text: "📊 Создаю Google-таблицу..." });
    const url = await createSheet(ttk);

    const ingList = (ttk.ingredients || [])
      .map((i) => `• ${i.name} — ${i.brutto ?? "?"} ${i.unit || ""}`)
      .join("\n");

    await tg("sendMessage", {
      chat_id: chatId,
      text: `✅ Готово!\n\n*${ttk.name}* (выход ${ttk.yield_ml ?? "?"} мл)\n\n${ingList}\n\n📄 ${url}`,
      parse_mode: "Markdown",
    });
  } catch (e: any) {
    console.error("[bartender] processing failed:", e);
    await tg("sendMessage", {
      chat_id: chatId,
      text: `❌ Ошибка: ${e?.message || e}`,
    });
  }
}

export async function POST(req: NextRequest) {
  let update: any;
  try {
    update = await req.json();
  } catch {
    return Response.json({ ok: true });
  }

  const msg = update?.message;
  if (!msg || msg.chat?.type !== "private") return Response.json({ ok: true });

  const text = String(msg.text || "").trim();
  if (text === "/start") {
    after(async () => {
      await tg("sendMessage", { chat_id: msg.chat.id, text: WELCOME });
    });
    return Response.json({ ok: true });
  }

  after(() => processMessage(msg));
  return Response.json({ ok: true });
}
