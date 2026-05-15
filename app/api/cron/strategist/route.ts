import { getSupabase } from "../../../../lib/supabase";
import { generatePlanForProject } from "../../../../lib/strategist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authOk(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const x = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  return x === secret;
}

export async function GET(req: Request) {
  if (!authOk(req)) return new Response("forbidden", { status: 403 });

  const sb = getSupabase();
  const { data: projects } = await sb
    .from("projects")
    .select("id,channel_username")
    .not("channel_username", "is", null);

  const list = projects ?? [];
  const results: Array<{ project_id: string; plan_id?: string; cost?: number; skipped?: string; error?: string }> = [];

  for (const p of list) {
    try {
      const r = await generatePlanForProject(p.id);
      if ("planId" in r) results.push({ project_id: p.id, plan_id: r.planId, cost: r.cost });
      else results.push({ project_id: p.id, skipped: r.skipped });
    } catch (e: any) {
      results.push({ project_id: p.id, error: e.message ?? String(e) });
    }
  }

  return Response.json({ ok: true, processed: list.length, results });
}
