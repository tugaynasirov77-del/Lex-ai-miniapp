import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../lib/supabase";
import { verifyInitData } from "../../../../../lib/verifyTelegram";
import { generateDraftForProject } from "../../../../../lib/contentWriter";

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

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const status = req.nextUrl.searchParams.get("status") || "pending";
  const sb = getSupabase();
  const { data } = await sb
    .from("content_drafts")
    .select("*")
    .eq("project_id", id)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(20);

  return Response.json({ drafts: data ?? [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  try {
    const r = await generateDraftForProject(id);
    if ("draftId" in r) return Response.json({ ok: true, draft_id: r.draftId, cost: r.cost });
    return Response.json({ ok: false, skipped: r.skipped }, { status: 200 });
  } catch (e: any) {
    return Response.json({ error: e.message ?? "writer error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const body = await req.json().catch(() => ({}));
  const { draft_id, status } = body as { draft_id?: string; status?: "approved" | "rejected" };
  if (!draft_id || !["approved", "rejected"].includes(status ?? "")) {
    return Response.json({ error: "draft_id + status (approved|rejected) required" }, { status: 400 });
  }

  const sb = getSupabase();
  const { error } = await sb
    .from("content_drafts")
    .update({ status, decided_at: new Date().toISOString() })
    .eq("id", draft_id)
    .eq("project_id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
