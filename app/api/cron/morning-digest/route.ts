import { getSupabase } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DIGEST_CHAT_ID = 5825762433;

const PRICE = {
  input: 3 / 1_000_000,
  output: 15 / 1_000_000,
  cache_write: 3.75 / 1_000_000,
  cache_read: 0.3 / 1_000_000,
};

function authOk(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const x = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  return x === secret;
}

function yesterdayBoundsUTC(): { from: string; to: string; label: string } {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterdayUtc = new Date(todayUtc.getTime() - 24 * 60 * 60 * 1000);
  const yyyy = yesterdayUtc.getUTCFullYear();
  const mm = String(yesterdayUtc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(yesterdayUtc.getUTCDate()).padStart(2, "0");
  return {
    from: yesterdayUtc.toISOString(),
    to: todayUtc.toISOString(),
    label: `${dd}.${mm}.${yyyy}`,
  };
}

async function sendTg(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: DIGEST_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
}

export async function GET(req: Request) {
  if (!authOk(req)) return new Response("forbidden", { status: 403 });

  const { from, to, label } = yesterdayBoundsUTC();
  const sb = getSupabase();

  const { data: usage } = await sb
    .from("usage_log")
    .select("agent_id,input_tokens,output_tokens,cache_creation_tokens,cache_read_tokens")
    .gte("created_at", from)
    .lt("created_at", to);

  let totalCalls = 0;
  let inT = 0,
    outT = 0,
    cwT = 0,
    crT = 0;
  const byAgent = new Map<string, number>();
  for (const row of usage ?? []) {
    totalCalls += 1;
    inT += row.input_tokens || 0;
    outT += row.output_tokens || 0;
    cwT += row.cache_creation_tokens || 0;
    crT += row.cache_read_tokens || 0;
    const a = row.agent_id || "unknown";
    byAgent.set(a, (byAgent.get(a) ?? 0) + 1);
  }
  const cost = inT * PRICE.input + outT * PRICE.output + cwT * PRICE.cache_write + crT * PRICE.cache_read;
  const topAgents = [...byAgent.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const { count: newProjects } = await sb
    .from("projects")
    .select("id", { count: "exact", head: true })
    .gte("created_at", from)
    .lt("created_at", to);

  const { data: downEvents } = await sb
    .from("health_log")
    .select("service")
    .eq("status", "down")
    .gte("checked_at", from)
    .lt("checked_at", to);

  const downByService = new Map<string, number>();
  for (const d of downEvents ?? []) downByService.set(d.service, (downByService.get(d.service) ?? 0) + 1);

  const lines: string[] = [];
  lines.push(`📊 <b>Утренний дайджест — ${label}</b>`);
  lines.push("");
  lines.push(`<b>Запросы к агентам</b>`);
  lines.push(`• Всего: ${totalCalls}`);
  if (totalCalls > 0) {
    lines.push(`• Токенов: ${(inT + outT + cwT + crT).toLocaleString("ru-RU")}`);
    lines.push(`• Стоимость: $${cost.toFixed(4)}`);
    if (topAgents.length > 0) {
      lines.push(`• Топ-агенты: ${topAgents.map(([a, n]) => `${a} (${n})`).join(", ")}`);
    }
  }
  lines.push("");
  lines.push(`<b>Проекты</b>`);
  lines.push(`• Новых: ${newProjects ?? 0}`);
  lines.push("");
  lines.push(`<b>Аптайм</b>`);
  if ((downEvents?.length ?? 0) === 0) {
    lines.push(`• Все сервисы 🟢 без падений`);
  } else {
    for (const [svc, n] of downByService) lines.push(`• ${svc}: 🔴 ${n} падений`);
  }

  const text = lines.join("\n");
  await sendTg(text);

  return Response.json({
    ok: true,
    label,
    stats: {
      calls: totalCalls,
      tokens: inT + outT + cwT + crT,
      cost_usd: Number(cost.toFixed(4)),
      new_projects: newProjects ?? 0,
      down_events: downEvents?.length ?? 0,
    },
  });
}
