import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";

export const runtime = "nodejs";

async function authProject(req: NextRequest, projectId: string) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user)
    return { err: Response.json({ error: v.error ?? "unauthorized" }, { status: 401 }) };
  const sb = getSupabase();
  const { data } = await sb
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("tg_id", v.user.id)
    .maybeSingle();
  if (!data) return { err: Response.json({ error: "project not found" }, { status: 404 }) };
  return { tgId: v.user.id };
}

function normalizeHandle(input: string): { username: string; profile_url: string } | null {
  const raw = input.trim();
  if (!raw) return null;
  const m = raw.match(/instagram\.com\/([A-Za-z0-9_.]{2,30})/i);
  let u = m ? m[1] : raw.replace(/^@/, "");
  u = u.split(/[/?#]/)[0].toLowerCase();
  if (!/^[a-z0-9_.]{2,30}$/.test(u)) return null;
  return { username: u, profile_url: `https://instagram.com/${u}` };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const sb = getSupabase();
  const { data, error } = await sb
    .from("ig_competitors")
    .select(
      "id,username,profile_url,notes,followers,full_name,top_post_caption,top_post_likes,top_post_url,added_at,fetched_at"
    )
    .eq("project_id", id)
    .order("added_at", { ascending: false, nullsFirst: false })
    .limit(50);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ competitors: data ?? [] });
}

/** Body: { handle: string, notes?: string } */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const body = await req.json().catch(() => ({}));
  const handle = String(body.handle || "").trim();
  const notes = String(body.notes || "").trim().slice(0, 2000);

  const norm = normalizeHandle(handle);
  if (!norm)
    return Response.json(
      { error: "invalid handle (use @name or instagram.com/name)" },
      { status: 400 }
    );

  const sb = getSupabase();
  const { data, error } = await sb
    .from("ig_competitors")
    .upsert(
      {
        project_id: id,
        username: norm.username,
        profile_url: norm.profile_url,
        notes: notes || null,
        added_at: new Date().toISOString(),
      },
      { onConflict: "project_id,username" }
    )
    .select("id,username,profile_url,notes,added_at")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, competitor: data });
}

/** Body: { competitor_id } */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const body = await req.json().catch(() => ({}));
  const cid = String(body.competitor_id || "");
  if (!cid) return Response.json({ error: "competitor_id required" }, { status: 400 });

  const sb = getSupabase();
  const { error } = await sb
    .from("ig_competitors")
    .delete()
    .eq("id", cid)
    .eq("project_id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
