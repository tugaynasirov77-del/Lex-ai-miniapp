import { NextRequest, after } from "next/server";
import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOKEN = () => process.env.BARTENDER_BOT_TOKEN!;
const TTK_FOLDER = () => process.env.GOOGLE_DRIVE_FOLDER_ID!;
const REV_FOLDER = () => process.env.REVISION_FOLDER_ID!;

const WELCOME = `Привет! Я бот-бармен 🍸

Выбери режим кнопкой внизу:

🍸 *ТТК* — кидай голосовое с напитком и ингредиентами, соберу карту.
🧾 *Ревизия* — открою сессию, кидай позиции, я суммирую дубли, потом сохраняю в таблицу.`;

const BTN_TTK = "🍸 ТТК";
const BTN_REV = "🧾 Ревизия";
const BTN_SAVE = "💾 Сохранить ревизию";
const BTN_CANCEL = "❌ Отменить ревизию";

const KB_MAIN = { keyboard: [[{ text: BTN_TTK }, { text: BTN_REV }]], resize_keyboard: true, is_persistent: true };
const KB_REVISION = { keyboard: [[{ text: BTN_SAVE }, { text: BTN_CANCEL }]], resize_keyboard: true, is_persistent: true };

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

// ───────────────────────── TTK ─────────────────────────

const PARSE_TTK_PROMPT = `Ты — помощник бармена. Из текста извлеки технологическую карту коктейля.

Верни СТРОГО JSON без markdown:
{
  "name": "Название",
  "yield_ml": число,
  "ingredients": [{"name": "...", "unit": "мл"|"гр", "brutto": 0, "netto": число}],
  "technology": "Технология одним абзацем"
}

Правила:
- Жидкости — "мл", украшения/фрукты/лёд — "гр"
- brutto = 0, заполняй netto
- yield_ml — сумма жидкостей (лёд не считай)
- Технология — придумай (билд/шейк/стир) если не сказано
- Названия с заглавной

Текст:
`;

type TTK = {
  name: string;
  yield_ml: number | string;
  ingredients: { name: string; unit: string; brutto: number; netto: number }[];
  technology: string;
};

// ───────────────────────── Revision ─────────────────────────

const PARSE_REVISION_PROMPT_BASE = `Ты — помощник бармена. Бармен диктует позиции ревизии (остатки на складе бара).
Извлеки ВСЕ упомянутые позиции из текста.

Верни СТРОГО JSON-массив без markdown:
[{"name": "Наименование", "unit": "л"|"кг"|"шт", "amount": число}, ...]

Правила:
- Алкоголь/соки/сиропы/вода/любые жидкости — unit: "л" (литры)
- Фрукты/специи/сахар/любые весовые — unit: "кг"
- Лимоны/лаймы/яблоки/банки/упаковки/штучный товар — unit: "шт"
- ВСЕГДА конвертируй мл→л и гр→кг: "300 мл" → amount: 0.3, unit: "л"; "500 гр" → 0.5 кг; "1500 мл" → 1.5 л; "пол-литра" → 0.5 л; "литр" → 1 л; "кило" → 1 кг; "пол-кило" → 0.5 кг
- Названия с заглавной, бренд если назвал
- Только массив, никакого текста вокруг

КРИТИЧЕСКИ ВАЖНО про дубли:
- "Jack Daniel's", "Jack Daniels", "Джек Дэниелс", "джек дениэлс" — это ОДНА ПОЗИЦИЯ
- "Bombay Sapphire", "Бомбей Сапфир", "джин Бомбей" — это ОДНА ПОЗИЦИЯ
- Если ниже дан список уже добавленных позиций — ОБЯЗАТЕЛЬНО используй ТО ЖЕ написание имени и ТУ ЖЕ единицу, что в списке. Не выдумывай альтернативные написания.
`;

type RevisionItem = { name: string; unit: string; amount: number };
type SessionRow = { chat_id: string; items: RevisionItem[]; started_at: string };

const normKey = (name: string, unit: string) => {
  const n = name
    .toLowerCase()
    .replace(/[''`'".,\-_()«»"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const u = unit.toLowerCase().trim();
  return `${n}::${u}`;
};

async function getSession(chatId: number): Promise<SessionRow | null> {
  const sb = getSupabase();
  const { data } = await sb.from("bartender_sessions").select("*").eq("chat_id", String(chatId)).maybeSingle();
  return data as SessionRow | null;
}

async function startSession(chatId: number) {
  const sb = getSupabase();
  await sb.from("bartender_sessions").upsert({
    chat_id: String(chatId),
    items: [],
    started_at: new Date().toISOString(),
  });
}

async function saveItems(chatId: number, items: RevisionItem[]) {
  const sb = getSupabase();
  await sb.from("bartender_sessions").update({ items }).eq("chat_id", String(chatId));
}

async function endSession(chatId: number) {
  const sb = getSupabase();
  await sb.from("bartender_sessions").delete().eq("chat_id", String(chatId));
}

// ───────────────────────── AI helpers ─────────────────────────

async function transcribe(audioUrl: string): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const audioRes = await fetch(audioUrl);
  const buf = Buffer.from(await audioRes.arrayBuffer());
  const file = new File([new Uint8Array(buf)], "voice.ogg", { type: "audio/ogg" });
  const r = await openai.audio.transcriptions.create({ model: "whisper-1", file, language: "ru" });
  return r.text;
}

function stripFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.split("```")[1] || s;
    if (s.startsWith("json")) s = s.slice(4);
    s = s.trim();
  }
  return s;
}

async function claudeJson<T>(prompt: string, text: string): Promise<T> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt + text }],
  });
  const block = msg.content[0];
  const raw = block.type === "text" ? block.text : "";
  return JSON.parse(stripFences(raw)) as T;
}

// ───────────────────────── Apps Script calls ─────────────────────────

async function callAppsScript(payload: any): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const t0 = Date.now();
    const r = await fetch(process.env.APPS_SCRIPT_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.APPS_SCRIPT_SECRET, ...payload }),
      redirect: "follow",
      signal: ctrl.signal,
    });
    const text = await r.text();
    console.log(`[bartender] AppsScript ${Date.now() - t0}ms status=${r.status} body=${text.slice(0, 200)}`);
    const data = JSON.parse(text);
    if (data.error) throw new Error(`Apps Script: ${data.error}`);
    if (!data.url) throw new Error(`Apps Script: no URL`);
    return data.url;
  } finally {
    clearTimeout(timer);
  }
}

const createTTKSheet = (ttk: TTK) => callAppsScript({ folderId: TTK_FOLDER(), ttk });
const createRevisionSheet = (items: RevisionItem[]) =>
  callAppsScript({ folderId: REV_FOLDER(), action: "revision", items, date: new Date().toISOString() });

// ───────────────────────── Handlers ─────────────────────────

async function handleTTK(msg: any, text: string) {
  const chatId = msg.chat.id;
  await tg("sendMessage", { chat_id: chatId, text: "🧠 Составляю ТТК..." });
  const ttk = await claudeJson<TTK>(PARSE_TTK_PROMPT, text);
  await tg("sendMessage", { chat_id: chatId, text: "📊 Создаю Google-таблицу..." });
  const url = await createTTKSheet(ttk);
  const ingList = (ttk.ingredients || [])
    .map((i) => `• ${i.name} — ${i.netto ?? "?"} ${i.unit || ""}`)
    .join("\n");
  await tg("sendMessage", {
    chat_id: chatId,
    text: `✅ Готово!\n\n*${ttk.name}* (выход ${ttk.yield_ml ?? "?"} мл)\n\n${ingList}\n\n📄 ${url}`,
    parse_mode: "Markdown",
  });
}

async function handleRevisionAdd(msg: any, text: string, session: SessionRow) {
  const chatId = msg.chat.id;
  await tg("sendMessage", { chat_id: chatId, text: "🧠 Разбираю позиции..." });

  const existing = session.items || [];
  const existingHint =
    existing.length > 0
      ? `\n\nУже добавленные позиции (используй точно такие же написания если упомянуто):\n` +
        existing.map((i) => `- ${i.name} (${i.unit})`).join("\n")
      : "";
  const prompt = PARSE_REVISION_PROMPT_BASE + existingHint + "\n\nТекст:\n";
  const parsed = await claudeJson<RevisionItem[]>(prompt, text);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    await tg("sendMessage", { chat_id: chatId, text: "🤔 Не нашёл позиций. Повтори голосом/текстом." });
    return;
  }

  const map = new Map<string, RevisionItem>();
  for (const i of session.items || []) map.set(normKey(i.name, i.unit), { ...i });

  const lines: string[] = [];
  for (const p of parsed) {
    const key = normKey(p.name, p.unit);
    const existing = map.get(key);
    if (existing) {
      const newAmount = (Number(existing.amount) || 0) + (Number(p.amount) || 0);
      existing.amount = newAmount;
      lines.push(`✓ *${p.name}*: +${p.amount} ${p.unit} → итого ${newAmount} ${p.unit}`);
    } else {
      map.set(key, { name: p.name, unit: p.unit, amount: Number(p.amount) || 0 });
      lines.push(`✓ *${p.name}*: ${p.amount} ${p.unit}`);
    }
  }

  const newItems = Array.from(map.values());
  await saveItems(chatId, newItems);
  await tg("sendMessage", {
    chat_id: chatId,
    text: lines.join("\n") + `\n\nВсего позиций в ревизии: *${newItems.length}*`,
    parse_mode: "Markdown",
  });
}

async function processMessage(msg: any) {
  const chatId = msg.chat.id;
  const textIn = String(msg.text || "").trim();

  // Команды/кнопки ревизии
  if (textIn === "/revision_start" || textIn === BTN_REV) {
    await startSession(chatId);
    await tg("sendMessage", {
      chat_id: chatId,
      text: "🧾 Ревизия открыта.\n\nКидай позиции голосом или текстом — я буду суммировать дубли.",
      reply_markup: KB_REVISION,
    });
    return;
  }

  if (textIn === BTN_TTK) {
    await endSession(chatId);
    await tg("sendMessage", {
      chat_id: chatId,
      text: "🍸 Режим ТТК.\n\nКидай голосовое или текст с напитком и ингредиентами.\nПример: «Негрони, джин 30, кампари 30, вермут 30, стир»",
      reply_markup: KB_MAIN,
    });
    return;
  }

  if (textIn === "/revision_cancel" || textIn === BTN_CANCEL) {
    await endSession(chatId);
    await tg("sendMessage", { chat_id: chatId, text: "❌ Ревизия отменена.", reply_markup: KB_MAIN });
    return;
  }

  if (textIn === "/revision_save" || textIn === BTN_SAVE) {
    const session = await getSession(chatId);
    if (!session || !session.items || session.items.length === 0) {
      await tg("sendMessage", { chat_id: chatId, text: "Нет активной ревизии или позиций нет.", reply_markup: KB_MAIN });
      return;
    }
    try {
      await tg("sendMessage", { chat_id: chatId, text: "📊 Сохраняю ревизию в Google-таблицу..." });
      const url = await createRevisionSheet(session.items);
      await endSession(chatId);
      await tg("sendMessage", {
        chat_id: chatId,
        text: `✅ Ревизия сохранена (${session.items.length} позиций)\n\n📄 ${url}`,
        reply_markup: KB_MAIN,
      });
    } catch (e: any) {
      console.error("[bartender] revision save failed:", e);
      await tg("sendMessage", { chat_id: chatId, text: `❌ Ошибка: ${e?.message || e}` });
    }
    return;
  }

  // Получаем текст (из голоса или текста)
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

    // Если активна ревизия — добавляем позиции, иначе ТТК
    const session = await getSession(chatId);
    if (session) {
      await handleRevisionAdd(msg, text, session);
    } else {
      await handleTTK(msg, text);
    }
  } catch (e: any) {
    console.error("[bartender] processing failed:", e);
    await tg("sendMessage", { chat_id: chatId, text: `❌ Ошибка: ${e?.message || e}` });
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
  if (text === "/start" || text === "/help") {
    after(async () => {
      await tg("sendMessage", { chat_id: msg.chat.id, text: WELCOME, parse_mode: "Markdown", reply_markup: KB_MAIN });
    });
    return Response.json({ ok: true });
  }

  after(() => processMessage(msg));
  return Response.json({ ok: true });
}
