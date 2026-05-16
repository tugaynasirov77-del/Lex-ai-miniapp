import { getSupabase } from "../../../../lib/supabase";
import { publishDueDrafts } from "../../../../lib/publishScheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type CheckResult = {
  service: string;
  status: "up" | "down";
  latency_ms: number;
  error?: string;
};

const ALERT_CHAT_ID = 5825762433;

async function timed(fn: () => Promise<void>): Promise<{ latency_ms: number; error?: string }> {
  const t0 = Date.now();
  try {
    await fn();
    return { latency_ms: Date.now() - t0 };
  } catch (e) {
    return { latency_ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

async function checkTelegramBot(): Promise<CheckResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { service: "telegram_bot", status: "down", latency_ms: 0, error: "TELEGRAM_BOT_TOKEN missing" };
  const r = await timed(async () => {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: "no-store" });
    const j = await res.json();
    if (!j.ok) throw new Error(j.description || "getMe failed");
  });
  return { service: "telegram_bot", status: r.error ? "down" : "up", latency_ms: r.latency_ms, error: r.error };
}

async function checkMiniAppHome(): Promise<CheckResult> {
  const r = await timed(async () => {
    const res = await fetch("https://lex-ai-miniapp.vercel.app/", { method: "GET", cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
  return { service: "miniapp_home", status: r.error ? "down" : "up", latency_ms: r.latency_ms, error: r.error };
}

async function checkApiHealth(): Promise<CheckResult> {
  const r = await timed(async () => {
    const res = await fetch("https://lex-ai-miniapp.vercel.app/api/health", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    if (!j.ok) throw new Error("api/health returned ok:false");
  });
  return { service: "api_health", status: r.error ? "down" : "up", latency_ms: r.latency_ms, error: r.error };
}

async function checkSupabase(): Promise<CheckResult> {
  const r = await timed(async () => {
    const sb = getSupabase();
    const { error } = await sb.from("health_state").select("service", { count: "exact", head: true });
    if (error) throw new Error(error.message);
  });
  return { service: "supabase", status: r.error ? "down" : "up", latency_ms: r.latency_ms, error: r.error };
}

async function sendAlert(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: ALERT_CHAT_ID, text, parse_mode: "HTML" }),
    });
  } catch {}
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  if (!secret || provided !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  const results = await Promise.all([
    checkTelegramBot(),
    checkMiniAppHome(),
    checkApiHealth(),
    checkSupabase(),
  ]);

  const sb = getSupabase();

  await sb.from("health_log").insert(
    results.map((r) => ({
      service: r.service,
      status: r.status,
      latency_ms: r.latency_ms,
      error: r.error ?? null,
    }))
  );

  const { data: prevStates } = await sb.from("health_state").select("*");
  const prev = new Map<string, { status: string; alert_sent: boolean }>();
  for (const row of prevStates ?? []) prev.set(row.service, { status: row.status, alert_sent: row.alert_sent });

  const alerts: string[] = [];

  for (const r of results) {
    const before = prev.get(r.service);
    const wasDown = before?.status === "down";
    const isDown = r.status === "down";
    const alertSent = before?.alert_sent ?? false;

    let alert_sent = alertSent;
    if (isDown && !alertSent) {
      alerts.push(`🔴 <b>${r.service}</b> упал\n${r.error ?? "unknown error"}`);
      alert_sent = true;
    } else if (!isDown && wasDown && alertSent) {
      alerts.push(`🟢 <b>${r.service}</b> восстановился (${r.latency_ms}ms)`);
      alert_sent = false;
    }

    const changed = !before || before.status !== r.status;
    await sb.from("health_state").upsert({
      service: r.service,
      status: r.status,
      since: changed ? new Date().toISOString() : undefined,
      alert_sent,
      last_error: r.error ?? null,
      updated_at: new Date().toISOString(),
    });
  }

  if (alerts.length > 0) {
    await sendAlert(alerts.join("\n\n"));
  }

  // Заодно публикуем все запланированные посты с scheduled_at <= now.
  // Healthcheck бежит каждые 5 минут — это даёт точность ±2.5 минуты.
  let publish: { processed: number; results: any[] } = { processed: 0, results: [] };
  try {
    publish = await publishDueDrafts();
  } catch (e: any) {
    publish.results.push({ error: e.message ?? "publish scheduler crashed" });
  }

  return Response.json({ ok: true, results, alerts_sent: alerts.length, publish });
}
