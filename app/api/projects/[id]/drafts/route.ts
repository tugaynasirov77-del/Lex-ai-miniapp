import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../lib/supabase";
import { verifyInitData } from "../../../../../lib/verifyTelegram";

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

/**
 * GET /api/projects/[id]/drafts?status=pending
 * Список черновиков проекта. Используется ProjectScreen для feed.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const status = req.nextUrl.searchParams.get("status");
  const sb = getSupabase();
  let q = sb
    .from("content_drafts")
    .select("*")
    .eq("project_id", id);
  if (status && status !== "all") {
    q = q.eq("status", status);
  } else {
    // По умолчанию — вся история: pending + approved + published.
    // rejected скрываем (юзер их явно отбракован).
    q = q.in("status", ["pending", "approved", "published"]);
  }
  const { data } = await q
    .order("created_at", { ascending: false })
    .limit(50);

  return Response.json({ drafts: data ?? [] });
}
