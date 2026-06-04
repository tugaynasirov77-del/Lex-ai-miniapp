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

  const fourteenAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: budget },
    { data: agents },
    { data: snapshots },
    { data: topPosts },
    { data: competitors },
    { data: drafts },
    { data: latestPlan },
    { data: suggestions },
    { data: nicheStrategy },
  ] = await Promise.all([
    sb.from("project_budget").select("*").eq("project_id", id).maybeSingle(),
    sb.from("project_agents").select("*").eq("project_id", id).order("role"),
    sb
      .from("channel_snapshots")
      .select("subscribers,snapshot_at")
      .eq("project_id", id)
      .gte("snapshot_at", fourteenAgo)
      .order("snapshot_at", { ascending: true }),
    sb
      .from("channel_posts")
      .select("message_id,text,views,published_at")
      .eq("project_id", id)
      .order("views", { ascending: false, nullsFirst: false })
      .limit(3),
    sb
      .from("competitor_channels")
      .select("*")
      .eq("project_id", id)
      .order("subscribers", { ascending: false, nullsFirst: false }),
    sb
      .from("content_drafts")
      .select("id,title_variants,body,status,created_at,cost_usd,published_message_id,published_at,chosen_title,plan_id,plan_day,scheduled_at,photo_url,poll_data")
      .eq("project_id", id)
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: false })
      .limit(15),
    sb
      .from("content_plans")
      .select("id,week_start,items,summary,created_at,cost_usd")
      .eq("project_id", id)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("scout_suggestions")
      .select("username,title,description,subscribers,relevance_score,reason")
      .eq("project_id", id)
      .eq("status", "pending")
      .order("relevance_score", { ascending: false })
      .limit(5),
    sb.from("niche_strategy").select("*").eq("project_id", id).maybeSingle(),
  ]);

  const snaps = snapshots ?? [];
  const latest = snaps.length > 0 ? snaps[snaps.length - 1] : null;
  const weekFirst = snaps.find((s) => s.snapshot_at >= weekAgo) ?? null;
  const growthAbs = latest && weekFirst ? latest.subscribers - weekFirst.subscribers : 0;
  const growthPct = weekFirst && weekFirst.subscribers > 0 ? (growthAbs / weekFirst.subscribers) * 100 : 0;

  return Response.json({
    project,
    budget: budget ?? { monthly_cap_usd: 1.0, spent_usd_current_month: 0, auto_pause_on_exceed: true },
    agents: agents ?? [],
    analytics: {
      snapshots: snaps,
      latest_subscribers: latest?.subscribers ?? project.channel_subscribers ?? 0,
      growth_abs: growthAbs,
      growth_pct: growthPct,
      top_posts: topPosts ?? [],
    },
    competitors: competitors ?? [],
    drafts: drafts ?? [],
    plan: latestPlan ?? null,
    suggestions: suggestions ?? [],
    niche_strategy: nicheStrategy ?? null,
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });
  const tgId = v.user.id;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const update: Record<string, any> = {};
  if (typeof body.publish_time === "string" && /^\d{1,2}:\d{2}$/.test(body.publish_time)) {
    const [h, m] = body.publish_time.split(":").map((x: string) => parseInt(x, 10));
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      update.publish_time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  if (typeof body.publish_timezone === "string" && body.publish_timezone.length < 64) {
    update.publish_timezone = body.publish_timezone;
  }
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (t.length < 2 || t.length > 80) {
      return Response.json(
        { error: "название должно быть от 2 до 80 символов" },
        { status: 400 },
      );
    }
    update.title = t;
  }
  if (Object.keys(update).length === 0) {
    return Response.json({ error: "нет полей для обновления" }, { status: 400 });
  }

  const sb = getSupabase();
  const { data: updated, error } = await sb
    .from("projects")
    .update(update)
    .eq("id", id)
    .eq("tg_id", tgId)
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!updated) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true, project: updated });
}

// DELETE /api/projects/:id — удаление проекта.
// Owner-check через tg_id; cascade на дочерние таблицы должен быть в схеме.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });
  const tgId = v.user.id;
  const { id } = await ctx.params;

  const sb = getSupabase();
  const { data: existing } = await sb
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("tg_id", tgId)
    .maybeSingle();
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });

  const { error } = await sb.from("projects").delete().eq("id", id).eq("tg_id", tgId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
