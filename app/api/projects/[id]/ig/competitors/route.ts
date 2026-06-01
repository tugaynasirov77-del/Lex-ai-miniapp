import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../../lib/supabase";

export const runtime = "nodejs";

// СКЕЛЕТ — Этап 4. Сейчас просто читает таблицу ig_competitors.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = getSupabase();
  const { data, error } = await sb
    .from("ig_competitors")
    .select("*")
    .eq("project_id", id)
    .order("followers", { ascending: false, nullsFirst: false })
    .limit(20);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ competitors: data ?? [] });
}

export async function POST(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  return Response.json(
    { ok: false, stub: true, message: "TODO Этап 4: автодобавление конкурентов через IG Graph + парсинг hashtag-листа" },
    { status: 501 }
  );
}
