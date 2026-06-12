export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Orchestrator cron tick.
 *
 * Vercel Hobby даёт только 2 cron-слота в vercel.json — их забрали
 * morning-digest + cleanup-raw-uploads. Остальные пайплайны
 * (analyst, niche-strategy, strategist, writer, publish-scheduled,
 * ig-publish-scheduled) живут как HTTP-эндпоинты, но никто их не зовёт.
 *
 * Этот endpoint вызывается UptimeRobot'ом раз в N минут и параллельно
 * fire-and-forget'ом дёргает все остальные crons. Каждый из них
 * выполняется в своём serverless-контексте с собственным maxDuration —
 * мы не упираемся в 10s ceiling этого orchestrator'а.
 *
 * Регистрация в UptimeRobot:
 *   URL: https://lex-ai-miniapp.vercel.app/api/cron/tick?secret=$CRON_SECRET
 *   Interval: 15 минут (или 5 если активный flow)
 */

function authOk(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const x =
    req.headers.get("x-cron-secret") ||
    new URL(req.url).searchParams.get("secret");
  return x === secret;
}

// Полный пайплайн обработки. Порядок логический, но фактически
// каждый cron запускается независимо — никакого ожидания между ними.
const PIPELINE = [
  "publish-scheduled",
  "ig-publish-scheduled",
  "writer",
  "strategist",
  "analyst",
  "niche-strategy",
  "scout-discover",
] as const;

export async function GET(req: Request) {
  if (!authOk(req)) return new Response("forbidden", { status: 403 });

  const secret = process.env.CRON_SECRET!;
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  // Fire-and-forget каждого cron'а. Используем POST? Нет — все наши
  // crons экспортируют только GET. Передаём secret в query, так делает
  // и UptimeRobot для прямого пинга.
  const results = await Promise.allSettled(
    PIPELINE.map(async (name) => {
      try {
        const res = await fetch(`${base}/api/cron/${name}?secret=${secret}`, {
          method: "GET",
          headers: { "x-cron-secret": secret },
          cache: "no-store",
        });
        return { name, status: res.status, ok: res.ok };
      } catch (e: any) {
        return { name, error: String(e?.message || e) };
      }
    }),
  );

  return Response.json({
    ok: true,
    triggered: PIPELINE.length,
    results: results.map((r) => (r.status === "fulfilled" ? r.value : r.reason)),
  });
}
