import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// СКЕЛЕТ — Этап 3 (Виктор IG). Будет публиковать IG-черновики со scheduled_at <= now.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return Response.json({ stub: true, published: 0, message: "TODO Этап 3: IG автопубликация" });
}
