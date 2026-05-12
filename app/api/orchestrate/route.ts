import { NextRequest, NextResponse } from "next/server";
import { ORCHESTRATOR_SYSTEM, AGENT_DEFS, type AgentKey } from "../../../lib/agents";

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

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      system: ORCHESTRATOR_SYSTEM,
      messages: [{ role: "user", content: task }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: "Anthropic API error", details: errText }, { status: 502 });
  }
  const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  const text = data.content?.find((b) => b.type === "text")?.text?.trim() ?? "";

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

  return NextResponse.json(parsed);
}
