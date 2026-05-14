import { NextRequest, NextResponse } from "next/server";
import { AGENT_DEFS, type AgentKey } from "../../../lib/agents";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 });
  }
  const { agentId, task } = (await req.json()) as { agentId?: AgentKey; task?: string };
  if (!agentId || !AGENT_DEFS[agentId]) {
    return NextResponse.json({ error: "invalid agentId" }, { status: 400 });
  }
  if (!task || !task.trim()) {
    return NextResponse.json({ error: "task is required" }, { status: 400 });
  }

  const def = AGENT_DEFS[agentId];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: def.system,
      messages: [{ role: "user", content: task }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: "Anthropic API error", details: errText }, { status: 502 });
  }
  const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  const reply = data.content?.find((b) => b.type === "text")?.text?.trim() ?? "";

  return NextResponse.json({ reply });
}
