import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../lib/supabase";
import { verifyInitData } from "../../../../../lib/verifyTelegram";
import { generateDraftForProject } from "../../../../../lib/contentWriter";
import { computeScheduledAt } from "../../../../../lib/scheduling";

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

  let seed: { planId?: string; planDay?: string; topic?: string; hook?: string; format?: "text" | "poll" | "quiz" } | undefined;
  let replaceDraftId: string | null = null;
  try {
    const body = await req.json();
    if (body && typeof body === "object") {
      seed = {
        planId: body.plan_id || body.planId,
        planDay: body.plan_day || body.planDay,
        topic: body.topic,
        hook: body.hook,
        format: body.format,
      };
      replaceDraftId = body.replace_draft_id || null;
    }
  } catch {}

  // Если есть plan_id+plan_day но нет topic — подтягиваем из плана (для regenerate)
  if (seed?.planId && seed?.planDay && !seed.topic) {
    const sb = getSupabase();
    const { data: plan } = await sb
      .from("content_plans")
      .select("items")
      .eq("id", seed.planId)
      .maybeSingle();
    const items = (plan?.items as Array<{ day: string; topic: string; hook: string; format?: "text" | "poll" | "quiz" }>) ?? [];
    const item = items.find((it) => it.day === seed!.planDay);
    if (item) {
      seed.topic = item.topic;
      seed.hook = item.hook;
      seed.format = seed.format ?? item.format ?? "text";
    }
  }

  // Если просят заменить — отмечаем старый rejected до генерации нового
  if (replaceDraftId) {
    const sb = getSupabase();
    await sb
      .from("content_drafts")
      .update({ status: "rejected", decided_at: new Date().toISOString() })
      .eq("id", replaceDraftId)
      .eq("project_id", id);
  }

  try {
    const r = await generateDraftForProject(id, seed);
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
  const { draft_id, status, publish_now } = body as {
    draft_id?: string;
    status?: "approved" | "rejected";
    publish_now?: boolean;
  };
  if (!draft_id || !["approved", "rejected"].includes(status ?? "")) {
    return Response.json({ error: "draft_id + status (approved|rejected) required" }, { status: 400 });
  }

  const sb = getSupabase();

  // Если одобряем — вычисляем scheduled_at (или null если publish_now)
  let scheduledAt: string | null = null;
  if (status === "approved" && !publish_now) {
    const { data: draft } = await sb
      .from("content_drafts")
      .select("plan_day")
      .eq("id", draft_id)
      .eq("project_id", id)
      .maybeSingle();
    const { data: project } = await sb
      .from("projects")
      .select("publish_time, publish_timezone")
      .eq("id", id)
      .maybeSingle();
    if (draft && project) {
      scheduledAt = computeScheduledAt(
        project.publish_time || "10:00",
        project.publish_timezone || "Europe/Moscow",
        draft.plan_day
      ).toISOString();
    }
  }

  const update: Record<string, any> = { status, decided_at: new Date().toISOString() };
  if (status === "approved") {
    update.scheduled_at = scheduledAt; // null при publish_now — публикуем сразу
  }

  const { error } = await sb
    .from("content_drafts")
    .update(update)
    .eq("id", draft_id)
    .eq("project_id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, scheduled_at: scheduledAt });
}
