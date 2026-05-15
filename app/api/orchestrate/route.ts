import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ORCHESTRATOR_SYSTEM, AGENT_DEFS, LEX_TEAM_RULES, type AgentKey } from "@/lib/agents";
import { logUsage, tgIdFromHeader } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 30;

interface OrchestrateResult {
  agentId: AgentKey;
  reasoning: string;
}

const VALID_AGENTS = Object.keys(AGENT_DEFS) as AgentKey[];

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 });
  }
  const { task } = (await req.json()) as { task?: string };
  if (!task || !task.trim()) {
    return NextResponse.json({ error: "task is required" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });
  // warmup: минимальный запрос, единственная цель — записать LEX_TEAM_RULES в кэш Anthropic
  const isWarmup = task.trim().toLowerCase() === "warmup";

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: isWarmup ? 1 : 100,
      system: [
        {
          type: "text",
          text: LEX_TEAM_RULES,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: ORCHESTRATOR_SYSTEM,
        },
      ],
      messages: [{ role: "user", content: task }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    // на warmup-запросах не парсим выбор агента — это не настоящая задача
    if (isWarmup) {
      return NextResponse.json({
        warmed: true,
        usage: {
          input_tokens: response.usage?.input_tokens,
          output_tokens: response.usage?.output_tokens,
          cache_creation_input_tokens: response.usage?.cache_creation_input_tokens || 0,
          cache_read_input_tokens: response.usage?.cache_read_input_tokens || 0,
        },
      });
    }

    let parsed: OrchestrateResult | null = null;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const obj = JSON.parse(m[0]);
        if (VALID_AGENTS.includes(obj.agentId)) {
          parsed = { agentId: obj.agentId, reasoning: String(obj.reasoning ?? "").slice(0, 200) };
        }
      }
    } catch {}

    if (!parsed) {
      parsed = { agentId: "alina", reasoning: "По умолчанию направил копирайтеру" };
    }

    const tgId = tgIdFromHeader(req.headers.get("x-telegram-init-data"));
    if (tgId) {
      await logUsage({
        tgId,
        agentId: "andrey",
        endpoint: "orchestrate",
        input_tokens: response.usage?.input_tokens,
        output_tokens: response.usage?.output_tokens,
        cache_creation_tokens: response.usage?.cache_creation_input_tokens || 0,
        cache_read_tokens: response.usage?.cache_read_input_tokens || 0,
      });
    }

    return NextResponse.json({
      ...parsed,
      usage: {
        input_tokens: response.usage?.input_tokens,
        output_tokens: response.usage?.output_tokens,
        cache_creation_input_tokens: response.usage?.cache_creation_input_tokens || 0,
        cache_read_input_tokens: response.usage?.cache_read_input_tokens || 0,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Anthropic API error", details: e?.message ?? String(e) }, { status: 502 });
  }
}
