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
      .select("id,title_variants,body,status,created_at,cost_usd")
      .eq("project_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10),
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
