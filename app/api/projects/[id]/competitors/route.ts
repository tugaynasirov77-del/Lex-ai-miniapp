import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../lib/supabase";
import { verifyInitData } from "../../../../../lib/verifyTelegram";
import { syncCompetitor } from "../../../../../lib/scoutSync";
import { normalizeUsername } from "../../../../../lib/telegramBot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  let body: { username?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  const username = normalizeUsername((body.username ?? "").toString());
  if (!username || username.length < 4) {
    return Response.json({ error: "укажи @username или ссылку t.me/..." }, { status: 400 });
  }

  try {
    const row = await syncCompetitor(id, username);
    if (!row.subscribers && !row.posts_count) {
      return Response.json({ error: `не нашёл канал @${username} (или он приватный)` }, { status: 400 });
    }

    await getSupabase()
      .from("project_agents")
      .update({ status: "active", last_run_at: new Date().toISOString() })
      .eq("project_id", id)
      .eq("role", "scout");

    return Response.json({ ok: true, competitor: row });
  } catch (e: any) {
    return Response.json({ error: e.message ?? "scout error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const username = req.nextUrl.searchParams.get("username");
  if (!username) return Response.json({ error: "username required" }, { status: 400 });

  const sb = getSupabase();
  const { error } = await sb.from("competitor_channels").delete().eq("project_id", id).eq("username", username);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
