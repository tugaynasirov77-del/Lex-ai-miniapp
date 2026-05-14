import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { AGENT_DEFS, type AgentKey } from "@/lib/agents";

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
  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: def.system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: task }],
    });

    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({
      reply,
      agentId,
      agentName: def.name,
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
