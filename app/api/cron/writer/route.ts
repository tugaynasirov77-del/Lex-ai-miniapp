import { getSupabase } from "../../../../lib/supabase";
import { generateDraftForProject } from "../../../../lib/contentWriter";

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
  // Берём проекты у которых давно не было свежего черновика. Один тик =
  // один проект; tick orchestrator зовёт нас каждые 5 минут, так что
  // за полчаса обходим до 6 проектов. Гарантируем что мы успеем в 60s
  // function budget даже если генерация одного драфта = 10-15s.
  const { data: projects } = await sb
    .from("projects")
    .select("id,channel_username")
    .not("channel_username", "is", null)
    .limit(2);

  const list = projects ?? [];
  const results: Array<{
    project_id: string;
    draft_id?: string;
    cost?: number;
    skipped?: string;
    error?: string;
  }> = [];

  // Параллельно — но с safety limit. На двух Haiku-проектах суммарно
  // ~10-15s, помещается в бюджет.
  await Promise.allSettled(
    list.map(async (p) => {
      try {
        const r = await generateDraftForProject(p.id);
        if ("draftId" in r) {
          results.push({ project_id: p.id, draft_id: r.draftId, cost: r.cost });
        } else {
          results.push({ project_id: p.id, skipped: r.skipped });
        }
      } catch (e: any) {
        results.push({ project_id: p.id, error: e.message ?? String(e) });
      }
    }),
  );

  return Response.json({ ok: true, processed: list.length, results });
}
