import { NextRequest, after } from "next/server";
import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { getSupabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

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
[{"name": "Наименование", "unit": "л"|"кг"|"шт", "amount": число_или_null}, ...]

Правила:
- Алкоголь/соки/сиропы/вода/любые жидкости — unit: "л" (литры)
- Фрукты/специи/сахар/любые весовые — unit: "кг"
- Лимоны/лаймы/яблоки/банки/упаковки/штучный товар — unit: "шт"
- ВСЕГДА конвертируй мл→л и гр→кг: "300 мл" → amount: 0.3, unit: "л"; "500 гр" → 0.5 кг; "1500 мл" → 1.5 л; "пол-литра" → 0.5 л; "литр" → 1 л; "кило" → 1 кг; "пол-кило" → 0.5 кг
- Если количество НЕ названо (только перечисление товаров без чисел) — поставь amount: null
- Названия с заглавной, бренд если назвал
- Только массив, никакого текста вокруг

КРИТИЧЕСКИ ВАЖНО про дубли:
- "Jack Daniel's", "Jack Daniels", "Джек Дэниелс", "джек дениэлс" — это ОДНА ПОЗИЦИЯ
- "Bombay Sapphire", "Бомбей Сапфир", "джин Бомбей" — это ОДНА ПОЗИЦИЯ
- Если ниже дан список уже добавленных позиций — ОБЯЗАТЕЛЬНО используй ТО ЖЕ написание имени и ТУ ЖЕ единицу, что в списке. Не выдумывай альтернативные написания.
`;

type RevisionItem = { name: string; unit: string; amount: number | null };
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

// ───────────────────────── Source list (persistent) ─────────────────────────

type SourceList = { chat_id: string; source_url: string | null; positions: RevisionItem[]; updated_at: string };

async function getSourceList(chatId: number): Promise<SourceList | null> {
  const sb = getSupabase();
  const { data } = await sb.from("bartender_lists").select("*").eq("chat_id", String(chatId)).maybeSingle();
  return data as SourceList | null;
}

async function saveSourceList(chatId: number, url: string, positions: RevisionItem[]) {
  const sb = getSupabase();
  await sb.from("bartender_lists").upsert({
    chat_id: String(chatId),
    source_url: url,
    positions,
    updated_at: new Date().toISOString(),
  });
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

async function claudeJson<T>(prompt: string, text: string, opts: { maxTokens?: number; model?: string } = {}): Promise<T> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const msg = await anthropic.messages.create({
    model: opts.model || "claude-opus-4-7",
    max_tokens: opts.maxTokens ?? 4000,
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
  const parsed = await claudeJson<RevisionItem[]>(prompt, text, { model: "claude-sonnet-4-6", maxTokens: 16000 });
  if (!Array.isArray(parsed) || parsed.length === 0) {
    await tg("sendMessage", { chat_id: chatId, text: "🤔 Не нашёл позиций. Повтори голосом/текстом." });
    return;
  }

  const map = new Map<string, RevisionItem>();
  for (const i of session.items || []) map.set(normKey(i.name, i.unit), { ...i });

  const addedNames: string[] = [];
  const filledLines: string[] = [];

  for (const p of parsed) {
    const key = normKey(p.name, p.unit);
    const existing = map.get(key);
    const pAmount = p.amount == null ? null : Number(p.amount);

    if (existing) {
      if (pAmount != null) {
        const prev = existing.amount == null ? 0 : Number(existing.amount);
        const next = prev + pAmount;
        existing.amount = next;
        filledLines.push(
          prev > 0
            ? `✓ *${p.name}*: +${pAmount} ${p.unit} → итого ${next} ${p.unit}`
            : `✓ *${p.name}*: ${next} ${p.unit}`
        );
      }
      // если позиция уже есть и amount не назван — ничего не делаем
    } else {
      map.set(key, { name: p.name, unit: p.unit, amount: pAmount });
      if (pAmount != null) {
        filledLines.push(`✓ *${p.name}*: ${pAmount} ${p.unit} (новая позиция)`);
      } else {
        addedNames.push(`• ${p.name} (${p.unit})`);
      }
    }
  }

  const newItems = Array.from(map.values());
  await saveItems(chatId, newItems);

  const totalFilled = newItems.filter((i) => i.amount != null && Number(i.amount) > 0).length;
  const totalAll = newItems.length;

  let reply = "";
  if (addedNames.length > 0) {
    reply += `📋 Добавил в список (${addedNames.length}):\n${addedNames.join("\n")}\n\n`;
  }
  if (filledLines.length > 0) {
    reply += filledLines.join("\n") + "\n\n";
  }
  reply += `Всего позиций: *${totalAll}* | с остатком: *${totalFilled}*`;
  if (addedNames.length > 0 && filledLines.length === 0) {
    reply += `\n\n*Шаг 2:* теперь проходись по списку и говори остатки: «водка 700», «джек 350»`;
  }

  await tg("sendMessage", { chat_id: chatId, text: reply, parse_mode: "Markdown" });
}

async function processMessage(msg: any) {
  const chatId = msg.chat.id;
  const textIn = String(msg.text || "").trim();

  // Команды/кнопки ревизии
  if (textIn === "/revision_start" || textIn === BTN_REV) {
    const saved = await getSourceList(chatId);
    if (!saved || !saved.source_url) {
      await startSession(chatId);
      await tg("sendMessage", {
        chat_id: chatId,
        text: "🧾 Ревизия открыта.\n\nУ тебя пока не привязан список товаров. Пришли *ссылку на свою Google Таблицу* со списком позиций (доступ «всем по ссылке»). Один раз — потом буду брать её сама и отслеживать изменения.",
        parse_mode: "Markdown",
        reply_markup: KB_REVISION,
      });
      return;
    }
    try {
      await tg("sendMessage", { chat_id: chatId, text: "📥 Подтягиваю актуальный список из твоей таблицы..." });
      const id = extractGoogleSheetsId(saved.source_url);
      if (!id) throw new Error("сохранённая ссылка повреждена");
      const freshNames = await fetchSourceNames(id);
      if (!freshNames || freshNames.length === 0) throw new Error("не смог прочитать таблицу — открой доступ «всем по ссылке» → Читатель");
      const freshItems: RevisionItem[] = freshNames.map((n) => ({ name: n, unit: guessUnit(n), amount: null }));

      const diffMsg = diffPositions(saved.positions || [], freshItems);
      await saveSourceList(chatId, saved.source_url, freshItems);
      await startSession(chatId);
      await saveItems(chatId, freshItems.map((i) => ({ ...i, amount: null })));

      await tg("sendMessage", {
        chat_id: chatId,
        text: `🧾 *Ревизия открыта* (${freshItems.length} позиций в списке)\n${diffMsg}\n\nГовори остатки голосом/текстом: «водка 700», «джек 350», «лимоны 5».\n\n💾 Сохранить ревизию — когда закончишь.\n🔄 «сменить список» — если хочешь привязать другую таблицу.`,
        parse_mode: "Markdown",
        reply_markup: KB_REVISION,
      });
    } catch (e: any) {
      console.error("[bartender] revision start failed:", e);
      await tg("sendMessage", { chat_id: chatId, text: `❌ Ошибка: ${e?.message || e}\n\nПришли новую ссылку на таблицу.`, reply_markup: KB_REVISION });
      await startSession(chatId); // открыта пустая сессия чтобы получить новую ссылку
    }
    return;
  }

  if (textIn.toLowerCase() === "сменить список") {
    const sb = getSupabase();
    await sb.from("bartender_lists").delete().eq("chat_id", String(chatId));
    await endSession(chatId);
    await tg("sendMessage", { chat_id: chatId, text: "✅ Привязка списка сброшена. Нажми 🧾 Ревизия и пришли новую ссылку.", reply_markup: KB_MAIN });
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

  // Документ (xlsx/csv) — только в режиме ревизии
  if (msg.document) {
    const session = await getSession(chatId);
    if (!session) {
      await tg("sendMessage", { chat_id: chatId, text: "Файл могу принять только в режиме ревизии. Нажми 🧾 Ревизия." });
      return;
    }
    try {
      await tg("sendMessage", { chat_id: chatId, text: "📥 Читаю файл..." });
      const names = await extractNamesFromDocument(msg.document);
      if (!names.length) {
        await tg("sendMessage", { chat_id: chatId, text: "❌ Не нашёл позиций в файле. Должна быть колонка с названиями." });
        return;
      }
      await mergeNamesIntoSession(chatId, names, session);
    } catch (e: any) {
      console.error("[bartender] document parse failed:", e);
      await tg("sendMessage", { chat_id: chatId, text: `❌ Ошибка чтения файла: ${e?.message || e}` });
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

    const session = await getSession(chatId);

    // В режиме ревизии: если прислана Google-таблица — это привязка источника
    if (session) {
      const gsId = extractGoogleSheetsId(text);
      if (gsId) {
        await tg("sendMessage", { chat_id: chatId, text: "📥 Читаю таблицу и привязываю как источник списка..." });
        const names = await fetchSourceNames(gsId);
        if (!names || !names.length) {
          await tg("sendMessage", { chat_id: chatId, text: "❌ Не смог прочитать таблицу. Открой доступ «всем по ссылке» → Читатель." });
          return;
        }
        const items: RevisionItem[] = names.map((n) => ({ name: n, unit: guessUnit(n), amount: null }));
        await saveSourceList(chatId, text, items);
        await saveItems(chatId, items);
        await tg("sendMessage", {
          chat_id: chatId,
          text: `✅ Список привязан (${items.length} позиций). В следующий раз подтяну автоматически.\n\nТеперь говори остатки: «водка 700», «джек 350».`,
          parse_mode: "Markdown",
        });
        return;
      }
      // обычный голос/текст с остатками
      await handleRevisionAdd(msg, text, session);
    } else {
      await handleTTK(msg, text);
    }
  } catch (e: any) {
    console.error("[bartender] processing failed:", e);
    await tg("sendMessage", { chat_id: chatId, text: `❌ Ошибка: ${e?.message || e}` });
  }
}

function looksLikeName(s: string): boolean {
  const t = s.trim();
  if (!t || t.length > 120) return false;
  if (/^\d+([.,]\d+)?$/.test(t)) return false; // чистое число
  if (/^\d+\s*(мл|л|гр|г|кг|шт)\.?$/i.test(t)) return false; // "500 мл"
  if (!/[a-zA-Zа-яА-ЯёЁ]/.test(t)) return false; // нет букв
  const skipWords = ["итого", "всего", "наименование", "наименование товара", "название", "категория", "ед.изм", "ед. изм.", "остаток", "приход", "расход", "цена"];
  if (skipWords.includes(t.toLowerCase())) return false;
  return true;
}

function pickBestColumn(rows: string[][]): number {
  // выбираем колонку с наибольшим числом УНИКАЛЬНЫХ «похожих на названия» значений
  // (колонка с ед.изм. имеет много значений, но всего 3-4 уникальных — отсеется)
  if (!rows.length) return 0;
  const cols = Math.max(...rows.map((r) => r.length));
  let best = 0;
  let bestScore = -1;
  for (let c = 0; c < cols; c++) {
    const uniq = new Set<string>();
    for (const r of rows) {
      const v = String(r[c] || "").trim();
      if (looksLikeName(v)) uniq.add(v.toLowerCase());
    }
    if (uniq.size > bestScore) {
      bestScore = uniq.size;
      best = c;
    }
  }
  return best;
}

async function extractNamesFromDocument(doc: any): Promise<string[]> {
  const fileName: string = doc.file_name || "";
  const url = await tgGetFileUrl(doc.file_id);
  if (!url) throw new Error("Не смог скачать файл");
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());

  let rows: string[][] = [];
  if (/\.csv$/i.test(fileName)) {
    rows = buf
      .toString("utf-8")
      .split(/\r?\n/)
      .map((l) => l.split(/[,;\t]/).map((c) => c.trim()));
  } else if (/\.(xlsx|xls)$/i.test(fileName)) {
    const wb = XLSX.read(buf, { type: "buffer" });
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const sheetRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
      for (const r of sheetRows) {
        rows.push(r.map((c) => String(c || "").trim()));
      }
    }
  } else {
    throw new Error("Поддерживаю только .xlsx и .csv");
  }

  const col = pickBestColumn(rows);
  const seen = new Set<string>();
  const names: string[] = [];
  for (const r of rows) {
    const val = (r[col] || "").trim();
    if (!looksLikeName(val)) continue;
    const key = val.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(val);
  }
  return names;
}

function guessUnit(name: string): string {
  const n = name.toLowerCase();
  const piece = /(лимон|лайм|апельсин|яблок|груш|ананас|банан|маракуй|клубник|малин|вишн|банк|бутыл|упаковк|пакет|штук)/;
  const kg = /(сахар|соль|кофе|чай в листьях|перец|корица|ваниль|какао|орех|изюм|курага|финик)/;
  if (piece.test(n)) return "шт";
  if (kg.test(n)) return "кг";
  return "л";
}

async function mergeNamesIntoSession(chatId: number, names: string[], session: SessionRow) {
  const map = new Map<string, RevisionItem>();
  for (const i of session.items || []) map.set(normKey(i.name, i.unit), { ...i });

  let added = 0;
  for (const n of names) {
    const unit = guessUnit(n);
    const key = normKey(n, unit);
    if (!map.has(key)) {
      map.set(key, { name: n, unit, amount: null });
      added++;
    }
  }
  const items = Array.from(map.values());
  await saveItems(chatId, items);
  await tg("sendMessage", {
    chat_id: chatId,
    text: `📋 Загрузил *${added}* позиций (всего в списке: *${items.length}*).\n\n*Шаг 2:* теперь голосом или текстом говори остатки: «водка 700», «джек 350», «лимон 5 шт»\n\nЕсли единица угадана неверно — просто скажи правильную: «соль 2 кг».`,
    parse_mode: "Markdown",
  });
}

function parseNamesFromCsv(csvText: string): string[] {
  const rows = csvText.split(/\r?\n/).map((l) => l.split(/[,;\t]/).map((c) => c.trim().replace(/^"(.*)"$/, "$1")));
  const col = pickBestColumn(rows);
  const seen = new Set<string>();
  const names: string[] = [];
  for (const r of rows) {
    const val = (r[col] || "").trim();
    if (!looksLikeName(val)) continue;
    const key = val.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(val);
  }
  return names;
}

function diffPositions(prev: RevisionItem[], next: RevisionItem[]): string {
  const prevSet = new Set(prev.map((i) => normKey(i.name, i.unit)));
  const nextSet = new Set(next.map((i) => normKey(i.name, i.unit)));
  const added = next.filter((i) => !prevSet.has(normKey(i.name, i.unit)));
  const removed = prev.filter((i) => !nextSet.has(normKey(i.name, i.unit)));
  if (added.length === 0 && removed.length === 0) {
    return prev.length === 0 ? "" : "\n_Изменений в списке нет._";
  }
  const parts: string[] = [];
  if (added.length > 0) parts.push(`\n➕ *Добавилось (${added.length}):*\n${added.map((i) => `• ${i.name}`).join("\n")}`);
  if (removed.length > 0) parts.push(`\n➖ *Удалилось (${removed.length}):*\n${removed.map((i) => `• ${i.name}`).join("\n")}`);
  return parts.join("\n");
}

function extractGoogleSheetsId(text: string): string | null {
  const m =
    text.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/) ||
    text.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    text.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

async function fetchSourceNames(fileId: string): Promise<string[] | null> {
  // 1. Пробуем как нативную Google Sheet (CSV export)
  try {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`, { redirect: "follow" });
    if (r.ok) {
      const ct = r.headers.get("content-type") || "";
      if (ct.includes("csv") || ct.includes("text/plain")) {
        const text = await r.text();
        const names = parseNamesFromCsv(text);
        if (names.length > 0) return names;
      }
    }
  } catch (e) {
    console.warn("[bartender] csv export failed:", (e as any)?.message);
  }
  // 2. Пробуем как xlsx в Drive (прямое скачивание)
  // Несколько попыток с разными URL — Drive иногда отдаёт virus-scan warning
  const driveUrls = [
    `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`,
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`,
    `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`,
  ];
  for (const url of driveUrls) {
    try {
      const r = await fetch(url, { redirect: "follow" });
      console.log(`[bartender] drive try ${url.slice(0, 80)} → ${r.status} ${r.headers.get("content-type")}`);
      if (!r.ok) continue;
      const ct = r.headers.get("content-type") || "";
      const buf = Buffer.from(await r.arrayBuffer());
      console.log(`[bartender] got ${buf.length} bytes`);

      // если это HTML страница (virus warning) — пропускаем
      if (ct.includes("text/html")) {
        const preview = buf.toString("utf-8").slice(0, 200);
        console.warn(`[bartender] got HTML instead of file:`, preview);
        continue;
      }

      try {
        const wb = XLSX.read(buf, { type: "buffer" });
        const rows: string[][] = [];
        for (const sheetName of wb.SheetNames) {
          const sheet = wb.Sheets[sheetName];
          const sheetRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
          for (const r of sheetRows) rows.push(r.map((c) => String(c || "").trim()));
        }
        console.log(`[bartender] xlsx parsed: ${wb.SheetNames.length} sheets, ${rows.length} total rows`);
        const col = pickBestColumn(rows);
        console.log(`[bartender] best column: ${col}`);
        const seen = new Set<string>();
        const names: string[] = [];
        for (const r of rows) {
          const val = (r[col] || "").trim();
          if (!looksLikeName(val)) continue;
          const key = val.toLowerCase().replace(/\s+/g, " ");
          if (seen.has(key)) continue;
          seen.add(key);
          names.push(val);
        }
        console.log(`[bartender] extracted ${names.length} names`);
        if (names.length > 0) return names;
      } catch (parseErr) {
        console.warn(`[bartender] not xlsx, trying csv:`, (parseErr as any)?.message);
        const text = buf.toString("utf-8");
        const names = parseNamesFromCsv(text);
        if (names.length > 0) return names;
      }
    } catch (e) {
      console.warn("[bartender] drive try failed:", (e as any)?.message);
    }
  }
  return null;
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
