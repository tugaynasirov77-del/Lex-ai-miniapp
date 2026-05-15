import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { AGENT_DEFS, LEX_TEAM_RULES, type AgentKey } from "@/lib/agents";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 });
  }
  const body = (await req.json()) as {
    agentId?: AgentKey;
    task?: string;
    messages?: { role: "user" | "assistant"; content: string }[];
  };
  const { agentId } = body;
  if (!agentId || !AGENT_DEFS[agentId]) {
    return NextResponse.json({ error: "invalid agentId" }, { status: 400 });
  }
  const history: { role: "user" | "assistant"; content: string }[] =
    Array.isArray(body.messages) && body.messages.length > 0
      ? body.messages
          .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
          .map((m) => ({ role: m.role, content: m.content }))
      : body.task && body.task.trim()
      ? [{ role: "user" as const, content: body.task }]
      : [];
  if (history.length === 0) {
    return NextResponse.json({ error: "messages or task required" }, { status: 400 });
  }
  if (history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "last message must be user" }, { status: 400 });
  }

  const def = AGENT_DEFS[agentId];
  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        const streamResp = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: [
            { type: "text", text: LEX_TEAM_RULES, cache_control: { type: "ephemeral" } },
            { type: "text", text: def.system },
          ],
          messages: history,
        });

        let full = "";
        streamResp.on("text", (delta) => {
          full += delta;
          send({ type: "delta", text: delta });
        });

        const final = await streamResp.finalMessage();
        send({
          type: "done",
          reply: full.trim(),
          agentId,
          agentName: def.name,
          usage: {
            input_tokens: final.usage?.input_tokens,
            output_tokens: final.usage?.output_tokens,
            cache_creation_input_tokens: final.usage?.cache_creation_input_tokens || 0,
            cache_read_input_tokens: final.usage?.cache_read_input_tokens || 0,
          },
        });
        controller.close();
      } catch (e: any) {
        send({ type: "error", error: e?.message ?? String(e) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
