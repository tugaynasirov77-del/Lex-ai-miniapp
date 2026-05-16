import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../lib/supabase";
import { verifyInitData } from "../../../../../lib/verifyTelegram";
import { discoverCompetitorsForProject } from "../../../../../lib/scoutDiscover";
import { syncCompetitor } from "../../../../../lib/scoutSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
  const url = new URL(req.url);
  const useNiche = url.searchParams.get("niche") === "1";
  try {
    const r = await discoverCompetitorsForProject(id, { useNicheSearch: useNiche });
    if ("skipped" in r) return Response.json({ ok: false, skipped: r.skipped });
    return Response.json({ ok: true, found: r.found, cost: r.cost, diagnostics: r.diagnostics });
  } catch (e: any) {
    return Response.json({ error: e.message ?? "scout error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const body = await req.json().catch(() => ({}));
  const { username, action } = body as { username?: string; action?: "add" | "dismiss" };
  if (!username || !["add", "dismiss"].includes(action ?? "")) {
    return Response.json({ error: "username + action (add|dismiss) required" }, { status: 400 });
  }

  const sb = getSupabase();
  if (action === "dismiss") {
    await sb
      .from("scout_suggestions")
      .update({ status: "dismissed" })
      .eq("project_id", id)
      .eq("username", username);
    return Response.json({ ok: true });
  }

  try {
    const competitor = await syncCompetitor(id, username);
    await sb
      .from("scout_suggestions")
      .update({ status: "added" })
      .eq("project_id", id)
      .eq("username", username);
    return Response.json({ ok: true, competitor });
  } catch (e: any) {
    return Response.json({ error: e.message ?? "add failed" }, { status: 500 });
  }
}
