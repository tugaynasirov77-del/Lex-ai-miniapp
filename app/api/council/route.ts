import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { verifyInitData } from "../../../lib/verifyTelegram";
import { buildAgentSystem, AGENT_DEFS, type AgentKey } from "../../../lib/agents";
import { sanitizeForAnthropic } from "../../../lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COUNCIL_MODEL = "claude-sonnet-4-6";

const COUNCIL_TASK = `ЗАДАЧА: ответить на вопрос пользователя как член консилиума.

Ты один из нескольких агентов которые отвечают на ОДИН вопрос с разных углов.
Не пересказывай вопрос, не извиняйся, не пиши "как маркетолог скажу" — просто отвечай по существу из СВОЕЙ роли.

Формат ответа:
• Полный, законченный ответ — НЕ обрывайся на полуслове
• 4-8 предложений или короткий нумерованный список
• Конкретика: цифры, шаги, имена инструментов
• Без эмодзи и заголовков
• Заканчивай одним практичным следующим шагом

Если вопрос явно не из твоей зоны компетенции — коротко скажи это (1 предложение) и предложи на чьё мнение опереться. НЕ выдумывай.`;

const ALL_AGENTS: AgentKey[] = ["milena", "alexander", "alina", "mikhail", "nikolay", "viktor", "arkadiy"];

/**
 * Простая эвристика выбора 3 агентов для вопроса.
 * Можно потом заменить на Haiku-классификатор, но для MVP — keywords.
 */
function pickAgents(question: string): AgentKey[] {
  const q = question.toLowerCase();
  const picked = new Set<AgentKey>();

  // ключевые слова → агенты
  const kw: Array<[RegExp, AgentKey]> = [
    [/маркет|реклам|кампан|целев|позицион|охват|трафик/, "milena"],
    [/стратег|план|долгосроч|roadmap|приорит|цел/, "alexander"],
    [/копирайт|пост|текст|заголов|сторител|нарратив/, "alina"],
    [/код|бот|api|интегра|автоматиз|webhook|js|python|sql/, "mikhail"],
    [/анализ|метрик|конверс|данн|цифр|статист|рост|воронк/, "nikolay"],
    [/продаж|лид|выручк|клиент|сделк|чек|подписк|монетиз/, "viktor"],
    [/крит|проверк|ревью|качеств|риск|слаб/, "arkadiy"],
  ];

  for (const [re, agent] of kw) {
    if (re.test(q)) picked.add(agent);
  }

  // Дефолтная триада для общих вопросов: стратег + аналитик + критик
  if (picked.size === 0) {
    return ["alexander", "nikolay", "arkadiy"];
  }

  // Добавляем Аркадия если он не выбран, для критики
  if (!picked.has("arkadiy") && picked.size < 4) picked.add("arkadiy");

  // Если слишком мало — добавляем стратега
  if (picked.size < 2) picked.add("alexander");

  // Не больше 4
  return Array.from(picked).slice(0, 4);
}

type CouncilResponse = {
  agent_id: AgentKey;
  agent_name: string;
  agent_role: string;
  answer: string;
  error?: string;
};

export async function POST(req: NextRequest) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length < 5) {
    return Response.json({ error: "вопрос обязателен (минимум 5 символов)" }, { status: 400 });
  }
  if (question.length > 1500) {
    return Response.json({ error: "вопрос слишком длинный, максимум 1500 символов" }, { status: 400 });
  }

  const explicitAgents = Array.isArray(body.agents) ? (body.agents as string[]).filter((a): a is AgentKey => ALL_AGENTS.includes(a as AgentKey)) : null;
  const selected = explicitAgents && explicitAgents.length > 0 ? explicitAgents.slice(0, 4) : pickAgents(question);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });

  const client = new Anthropic({ apiKey });

  const responses = await Promise.all(
    selected.map(async (agentKey): Promise<CouncilResponse> => {
      const def = AGENT_DEFS[agentKey];
      try {
        const res = await client.messages.create({
          model: COUNCIL_MODEL,
          max_tokens: 1024,
          system: buildAgentSystem(agentKey, COUNCIL_TASK),
          messages: [{ role: "user", content: sanitizeForAnthropic(question) }],
        });
        const text = res.content
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("")
          .trim();
        return { agent_id: agentKey, agent_name: def.name, agent_role: def.role, answer: text };
      } catch (e: any) {
        return { agent_id: agentKey, agent_name: def.name, agent_role: def.role, answer: "", error: e.message ?? "agent failed" };
      }
    })
  );

  return Response.json({
    ok: true,
    question,
    selected_agents: selected,
    responses,
  });
}
