import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";
import { getBrandKitFromProject } from "../../../../../../lib/lexAI";
import { checkQuota } from "../../../../../../lib/gating";
import { generateCaptions } from "../../../../../../lib/captionGenerator";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function authProject(req: NextRequest, projectId: string) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return { err: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const sb = getSupabase();
  const { data } = await sb
    .from("projects")
    .select("id,tg_id")
    .eq("id", projectId)
    .eq("tg_id", v.user.id)
    .maybeSingle();
  if (!data) return { err: Response.json({ error: "project not found" }, { status: 404 }) };
  return { tgId: v.user.id };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const body = await req.json().catch(() => ({}));
  const topic = String(body?.topic || "").trim();
  if (topic.length < 5)
    return Response.json({ error: "Опиши идею Reels (минимум 5 символов)" }, { status: 400 });
  if (topic.length > 800)
    return Response.json({ error: "Слишком длинно. До 800 символов." }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY)
    return Response.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });

  const gate = await checkQuota({ tgId: a.tgId, action: "caption" });
  if (!gate.ok) {
    return Response.json(
      {
        error:
          gate.tier === "free"
            ? "Бесплатно 5 подписей в месяц. Перейди на Pro — безлимит."
            : "Лимит подписей исчерпан.",
        code: "quota_exceeded",
        tier: gate.tier,
        limit: gate.limit.count,
      },
      { status: 402 },
    );
  }

  const brand = await getBrandKitFromProject(id);

  let result;
  try {
    result = await generateCaptions({ topic, brand });
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "Не получилось сгенерировать. Попробуй ещё раз." },
      { status: 500 },
    );
  }

  // Фиксируем расход квоты в project_usage с маркером agent_role='caption_generator'
  const sb = getSupabase();
  await sb.from("project_usage").insert({
    project_id: id,
    agent_role: "caption_generator",
    cost_usd: 0.02,
    model: "claude-haiku-4-5-20251001",
  });

  // Сохраняем как черновик, чтобы подпись попадала в «Контент».
  const variants: any[] = (result as any)?.variants || [];
  const hashtags: string[] = (result as any)?.hashtags || [];
  const fullText = [
    ...variants.map((v: any) => `[${v.style_label || v.style}]\n${v.text}`),
    hashtags.length ? hashtags.map((h) => `#${String(h).replace(/^#+/, "")}`).join(" ") : "",
  ].filter(Boolean).join("\n\n");
  await sb.from("content_drafts").insert({
    project_id: id,
    platform: "instagram",
    content_type: "caption",
    status: "scenario_ready",
    chosen_title: topic.slice(0, 120),
    source_topic: topic,
    caption: variants[0]?.text || fullText,
    body: fullText,
    source: "caption_generator",
  }).then(() => {}, () => {});

  return Response.json({
    ok: true,
    result,
    quota: {
      tier: gate.tier,
      used: (gate.used ?? 0) + 1,
      limit: gate.limit.count,
    },
  });
}
