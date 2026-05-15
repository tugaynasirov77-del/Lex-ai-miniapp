import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../lib/supabase";
import { verifyInitData } from "../../../../../lib/verifyTelegram";
import { analyzeNicheStrategy } from "../../../../../lib/strategyAnalyzer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authProject(req: NextRequest, projectId: string) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return { err: Response.json({ error: v.error ?? "unauthorized" }, { status: 401 }) };
  const sb = getSupabase();
  const { data } = await sb.from("projects").select("id").eq("id", projectId).eq("tg_id", v.user.id).maybeSingle();
  if (!data) return { err: Response.json({ error: "проект не найден" }, { status: 404 }) };
  return { tgId: v.user.id };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;
  try {
    const r = await analyzeNicheStrategy(id);
    if ("skipped" in r) return Response.json({ ok: false, skipped: r.skipped });
    return Response.json({ ok: true, ...r });
  } catch (e: any) {
    return Response.json({ error: e.message ?? "analyzer error" }, { status: 500 });
  }
}
