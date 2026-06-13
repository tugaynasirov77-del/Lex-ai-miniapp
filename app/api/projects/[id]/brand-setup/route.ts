import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../../../../../lib/supabase";
import { verifyInitData } from "../../../../../lib/verifyTelegram";
import { analyzeCompetitors, type CompetitorInput } from "../../../../../lib/lexAI";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/projects/[id]/brand-setup
 * Body: { niche: string, description: string, audience: string, tone: string,
 *         inspirations?: string[] (опц. handles конкурентов) }
 *
 * Сохраняет brand_kit в проект + сразу генерит playbook (LEX_insights).
 * Это заменяет «Разведка → Конкуренты → Анализ» для IG-проектов.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const sb = getSupabase();
  const { data: project } = await sb
    .from("projects")
    .select("id,tg_id,title,platform")
    .eq("id", id)
    .eq("tg_id", v.user.id)
    .maybeSingle();
  if (!project) return Response.json({ error: "project not found" }, { status: 404 });

  const body = await req.json().catch(() => ({} as any));
  const niche = String(body?.niche || "").slice(0, 80).trim();
  const description = String(body?.description || "").slice(0, 500).trim();
  const audience = String(body?.audience || "").slice(0, 300).trim();
  const tone = String(body?.tone || "").slice(0, 80).trim();
  const inspirations: string[] = Array.isArray(body?.inspirations)
    ? body.inspirations.slice(0, 5).map((s: any) => String(s).trim().replace(/^@/, ""))
    : [];

  if (!niche || !description) {
    return Response.json(
      { error: "Заполни нишу и описание бренда." },
      { status: 400 }
    );
  }

  // Сохраняем brand_kit
  const brand_kit = {
    channel_title: project.title || "",
    niche,
    short_description: description,
    voice: tone || "доверительный",
    audience,
    goals: ["рост подписчиков", "вовлечение", "продажи"],
    inspirations,
  };

  await sb.from("projects").update({ lex_brand_kit: brand_kit }).eq("id", id);

  // Сразу генерим playbook (используем существующий analyzeCompetitors
  // но с "виртуальными" конкурентами из inspirations + brand_kit как контекст)
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ ok: true, playbook_skipped: true, brand_kit });
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Передаём в анализ полноценный контекст бренда + handles вдохновения.
  // Это даёт LEX-у конкретику, а не «список аккаунтов без описания».
  const brandContext = [
    `Бренд: ${description}`,
    audience ? `Целевая аудитория: ${audience}` : "",
    tone ? `Тон общения: ${tone}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const inspirationsList: CompetitorInput[] = inspirations.length
    ? inspirations.map((h) => ({
        handle: h,
        description: `Один из топ-аккаунтов в нише, который вдохновляет бренд`,
      }))
    : [];

  try {
    const { insights, cost } = await analyzeCompetitors({
      client,
      projectId: id,
      tgId: v.user.id,
      channelTitle: `${project.title || "канал"} — ${brandContext}`,
      niche,
      competitors: inspirationsList,
      platform: (project.platform as any) || "instagram",
    });
    return Response.json({ ok: true, brand_kit, insights, cost });
  } catch (e: any) {
    // Brand kit сохранили — playbook можно перегенерить позже
    return Response.json(
      { ok: true, brand_kit, playbook_error: e?.message || "playbook generation failed" }
    );
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const sb = getSupabase();
  const { data } = await sb
    .from("projects")
    .select("lex_brand_kit")
    .eq("id", id)
    .eq("tg_id", v.user.id)
    .maybeSingle();
  return Response.json({ brand_kit: data?.lex_brand_kit ?? null });
}
