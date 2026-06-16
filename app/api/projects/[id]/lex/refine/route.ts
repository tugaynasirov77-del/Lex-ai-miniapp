import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";
import {
  refinePost,
  getInsightsFromCache,
  getBrandKitFromProject,
  type RefineDirection,
} from "../../../../../../lib/lexAI";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED: RefineDirection[] = ["shorter", "sharper", "emotional", "specific"];

async function authProject(req: NextRequest, projectId: string) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user)
    return { err: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const sb = getSupabase();
  const { data } = await sb
    .from("projects")
    .select("id,tg_id")
    .eq("id", projectId)
    .eq("tg_id", v.user.id)
    .maybeSingle();
  if (!data) return { err: Response.json({ error: "project not found" }, { status: 404 }) };
  return { tgId: v.user.id };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const body = await req.json().catch(() => ({}));
  const currentPost = String(body?.currentPost || "").trim();
  const direction = String(body?.direction || "") as RefineDirection;

  if (!currentPost) return Response.json({ error: "currentPost required" }, { status: 400 });
  if (!ALLOWED.includes(direction))
    return Response.json({ error: "direction must be one of: " + ALLOWED.join(",") }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY)
    return Response.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });

  const [{ insights }, brand] = await Promise.all([
    getInsightsFromCache(id),
    getBrandKitFromProject(id),
  ]);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const { post } = await refinePost({
    client,
    projectId: id,
    tgId: a.tgId,
    currentPost,
    direction,
    insights,
    brand,
  });

  if (!post) return Response.json({ error: "refinement failed" }, { status: 502 });
  return Response.json({ post });
}
