import { publishDueDrafts } from "../../../../lib/publishScheduler";

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
  const r = await publishDueDrafts();
  return Response.json({ ok: true, ...r });
}
