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

/**
 * POST /api/projects/[id]/drafts
 * Создаёт черновик. Используется PersonalScriptScreen для сохранения
 * готового сценария Reels (content_type='reel', status='scenario_ready',
 * scenario_data jsonb).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const body = await req.json().catch(() => ({} as any));

  const contentType = ["reel", "post", "carousel", "idea", "caption"].includes(body?.content_type)
    ? body.content_type
    : "reel";

  const insert: Record<string, any> = {
    project_id: id,
    platform: "instagram",
    content_type: contentType,
    status: typeof body?.status === "string" ? body.status : "scenario_ready",
  };
  if (typeof body?.title === "string") insert.title = body.title.slice(0, 200);
  if (typeof body?.body === "string") insert.body = body.body.slice(0, 4096);
  if (typeof body?.caption === "string") insert.caption = body.caption.slice(0, 2048);
  if (typeof body?.source_decode_id === "string" && body.source_decode_id)
    insert.source_decode_id = body.source_decode_id;
  if (typeof body?.source_topic === "string") insert.source_topic = body.source_topic.slice(0, 300);
  if (body?.scenario_data && typeof body.scenario_data === "object")
    insert.scenario_data = body.scenario_data;
  if (typeof body?.planned_for_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.planned_for_date))
    insert.planned_for_date = body.planned_for_date;

  const sb = getSupabase();
  const { data, error } = await sb
    .from("content_drafts")
    .insert(insert)
    .select("id")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ id: data.id });
}
