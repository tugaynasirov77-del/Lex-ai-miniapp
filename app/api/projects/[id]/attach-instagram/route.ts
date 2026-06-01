import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../lib/supabase";
import { verifyInitData } from "../../../../../lib/verifyTelegram";

export const runtime = "nodejs";

// Этап 1 (текущий) — просто сохраняет username/account_id вручную.
// Этап 4 — обмен короткого токена FB на long-lived + auto-fetch account info.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const initData = req.headers.get("x-telegram-init-data");
  const v = verifyInitData(initData);
  if (!v.ok || !v.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id: projectId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const username = String(body.username || "").trim().replace(/^@/, "");
  const account_id = body.account_id ? String(body.account_id).trim() : null;
  const followers = typeof body.followers === "number" ? body.followers : null;

  if (!username) return Response.json({ error: "username required" }, { status: 400 });

  const sb = getSupabase();
  const { data, error } = await sb
    .from("projects")
    .update({
      platform: "instagram",
      instagram_username: username,
      instagram_account_id: account_id,
      instagram_followers: followers,
      instagram_attached_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("tg_id", v.user.id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ project: data });
}
