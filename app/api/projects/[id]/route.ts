import { NextRequest } from "next/server";
import { getSupabase } from "../../../../lib/supabase";
import { verifyInitData } from "../../../../lib/verifyTelegram";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });
  const tgId = v.user.id;

  const { id } = await ctx.params;
  const sb = getSupabase();

  const { data: project, error } = await sb
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("tg_id", tgId)
    .single();
  if (error || !project) return Response.json({ error: "not found" }, { status: 404 });

  const [{ data: budget }, { data: agents }] = await Promise.all([
    sb.from("project_budget").select("*").eq("project_id", id).maybeSingle(),
    sb.from("project_agents").select("*").eq("project_id", id).order("role"),
  ]);

  return Response.json({
    project,
    budget: budget ?? { monthly_cap_usd: 1.0, spent_usd_current_month: 0, auto_pause_on_exceed: true },
    agents: agents ?? [],
  });
}
