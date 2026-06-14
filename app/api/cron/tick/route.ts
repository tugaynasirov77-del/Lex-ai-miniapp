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
// После перехода на LEX AI остался только publishing-pipeline.
// Генерация контента теперь sync через /api/projects/[id]/lex/*,
// автогенерация по плану упразднена (юзер сам жмёт кнопку).
const PIPELINE = [
  "publish-scheduled",
  "ig-publish-scheduled",
  "reminders",
] as const;

export async function GET(req: Request) {
  if (!authOk(req)) return new Response("forbidden", { status: 403 });

  const secret = process.env.CRON_SECRET!;
  // VERCEL_URL даёт per-deployment URL который может требовать
  // дополнительную аутентификацию. Используем публичный prod URL.
  const base =
    process.env.NEXT_PUBLIC_APP_URL || "https://lex-ai-miniapp.vercel.app";

  // True fire-and-forget — НЕ ждём ответа cron'ов. Каждый cron получит
  // свой собственный maxDuration в его serverless-контексте; orchestrator
  // же возвращается мгновенно. Если бы мы ждали — превысили бы наш
  // собственный 60s бюджет на сумме медленных cron'ов.
  //
  // Этот pattern работает на Vercel: fetch() с AbortController +
  // короткий timeout заставляет request уйти "по сети", серверный
  // обработчик стартует, и нам уже неважно что мы прервёмся клиентски.
  const triggered: string[] = [];
  for (const name of PIPELINE) {
    const url = `${base}/api/cron/${name}?secret=${encodeURIComponent(secret)}`;
    // .catch чтобы unhandled promise rejection не убил функцию
    fetch(url, {
      method: "GET",
      headers: { "x-cron-secret": secret },
      cache: "no-store",
      // Прерываем клиентскую часть быстро — серверная продолжит
      signal: AbortSignal.timeout(1500),
    }).catch(() => {
      /* ожидаемо: timeout прерывает наш fetch, но сервер уже работает */
    });
    triggered.push(name);
  }

  return Response.json({
    ok: true,
    triggered: triggered.length,
    names: triggered,
    base,
  });
}
