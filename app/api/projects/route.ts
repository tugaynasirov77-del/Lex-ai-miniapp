import { NextRequest } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyInitData } from "../../../lib/verifyTelegram";

export const runtime = "nodejs";

function auth(req: NextRequest) {
  const initData = req.headers.get("x-telegram-init-data");
  const v = verifyInitData(initData);
  if (!v.ok || !v.user) {
    return { error: Response.json({ error: v.error ?? "unauthorized" }, { status: 401 }) };
  }
  return { tgId: v.user.id };
}

export async function GET(req: NextRequest) {
  const a = auth(req);
  if ("error" in a) return a.error;
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("projects")
      .select("*")
      .eq("tg_id", a.tgId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ projects: data ?? [] });
  } catch (e: any) {
    return Response.json({ error: e.message ?? "db error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const a = auth(req);
  if ("error" in a) return a.error;
  try {
    const body = await req.json();
    const { title, status, progress, agents } = body ?? {};
    if (typeof title !== "string" || !title.trim()) {
      return Response.json({ error: "title required" }, { status: 400 });
    }

    const sb = getSupabase();
    const { data, error } = await sb
      .from("projects")
      .insert({
        tg_id: a.tgId,
        title: title.trim(),
        status: status ?? "in_progress",
        progress: typeof progress === "number" ? progress : 0,
        agents: Array.isArray(agents) ? agents : [],
      })
      .select()
      .single();
    if (error) throw error;
    return Response.json({ project: data });
  } catch (e: any) {
    return Response.json({ error: e.message ?? "db error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const a = auth(req);
  if ("error" in a) return a.error;
  try {
    const body = await req.json();
    const { id, ...patch } = body ?? {};
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    const allowed: Record<string, unknown> = {};
    if (typeof patch.title === "string") allowed.title = patch.title;
    if (typeof patch.status === "string") allowed.status = patch.status;
    if (typeof patch.progress === "number") allowed.progress = patch.progress;
    if (Array.isArray(patch.agents)) allowed.agents = patch.agents;
    allowed.updated_at = new Date().toISOString();

    const sb = getSupabase();
    const { data, error } = await sb
      .from("projects")
      .update(allowed)
      .eq("id", id)
      .eq("tg_id", a.tgId)
      .select()
      .single();
    if (error) throw error;
    return Response.json({ project: data });
  } catch (e: any) {
    return Response.json({ error: e.message ?? "db error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const a = auth(req);
  if ("error" in a) return a.error;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  try {
    const sb = getSupabase();
    const { error } = await sb.from("projects").delete().eq("id", id).eq("tg_id", a.tgId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message ?? "db error" }, { status: 500 });
  }
}
