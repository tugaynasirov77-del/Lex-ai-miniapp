import { NextRequest, after } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../lib/verifyTelegram";
import {
  generateCarousel,
  ALINA_CAROUSEL_PROMPT_VERSION,
} from "../../../../../../lib/carouselWriter";
import {
  reviewCarousel,
  ARKADIY_CAROUSEL_PROMPT_VERSION,
  type CarouselReview,
} from "../../../../../../lib/arkadiyEditor";
import { enforceQuota } from "../../../../../../lib/gating";

export const runtime = "nodejs";
export const maxDuration = 120;

const ARKADIY_THRESHOLD = 7;
const MAX_RETRIES = 1;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = getSupabase();
  const { data, error } = await sb
    .from("content_drafts")
    .select(
      "id,chosen_title,caption,body,media_urls,status,scheduled_at,created_at,editor_score,editor_verdict,editor_comments,needs_review,ig_media_id,ig_permalink"
    )
    .eq("project_id", id)
    .eq("content_type", "carousel")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ carousels: data ?? [] });
}

/** POST: генерация карусели через Алину + Аркадия. Async-free (~30 сек).
 *  Body: { topic?: string; plan_id?: string; plan_day?: string }
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id: projectId } = await ctx.params;
  const sb = getSupabase();

  const { data: project } = await sb
    .from("projects")
    .select("id,tg_id,title")
    .eq("id", projectId)
    .eq("tg_id", v.user.id)
    .maybeSingle();
  if (!project) return Response.json({ error: "project not found" }, { status: 404 });

  const gate = await enforceQuota({ projectId, tgId: v.user.id, action: "carousel" });
  if (!gate.pass) return gate.response;

  const body = await req.json().catch(() => ({}));
  let topic = String(body.topic || "").trim();
  const planId = String(body.plan_id || "").trim();
  const planDay = String(body.plan_day || "").trim();

  if (!topic && planId && planDay) {
    const { data: plan } = await sb
      .from("content_plans")
      .select("items")
      .eq("id", planId)
      .maybeSingle();
    const items = (plan?.items as Array<{ day: string; topic: string; hook?: string }>) ?? [];
    const item = items.find((it) => it.day === planDay);
    if (item) topic = `${item.topic}${item.hook ? `\n\nHook: ${item.hook}` : ""}`;
  }

  if (!topic) {
    return Response.json({ error: "topic OR (plan_id+plan_day) required" }, { status: 400 });
  }
  if (topic.length < 8) {
    return Response.json({ error: "topic too short (<8 chars)" }, { status: 400 });
  }

  // 1) Сразу placeholder в 'generating' — клиент получает draft_id без
  //    ожидания AI. Тяжёлая работа Алина+Аркадий+retry уезжает в after().
  //    Зависание >3 мин ловит orphan-detector из cron'а publish-scheduled.
  const { data: placeholder, error: insErr } = await sb
    .from("content_drafts")
    .insert({
      project_id: projectId,
      platform: "instagram",
      content_type: "carousel",
      source: planId ? "plan" : "manual",
      plan_id: planId || null,
      plan_day: planDay || null,
      body: "",
      status: "generating",
      writer_prompt_version: ALINA_CAROUSEL_PROMPT_VERSION,
    })
    .select("id")
    .single();
  if (insErr || !placeholder) {
    return Response.json({ error: insErr?.message || "insert failed" }, { status: 500 });
  }
  const draftId = placeholder.id as string;

  after(async () => {
    const sb2 = getSupabase();
    const markFailed = async (reason: string) => {
      await sb2
        .from("content_drafts")
        .update({
          status: "failed",
          error: reason.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", draftId);
    };

    try {
      const { data: niche } = await sb2
        .from("niche_strategy")
        .select("summary")
        .eq("project_id", projectId)
        .maybeSingle();

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      let totalCost = 0;
      let retries = 0;

      // Алина
      let { carousel, cost: c1 } = await generateCarousel({
        client,
        topic,
        nicheSummary: niche?.summary || undefined,
        projectId,
        tgId: project.tg_id,
      });
      totalCost += c1;
      if (!carousel) {
        await markFailed("invalid JSON from Алина");
        return;
      }

      // Аркадий
      let review: CarouselReview | null = null;
      try {
        const rr = await reviewCarousel({
          client,
          carouselJson: carousel,
          projectId,
          tgId: project.tg_id,
        });
        review = rr.review;
        totalCost += rr.cost;
      } catch {
        review = null;
      }

      // Retry если score<7
      if (review && review.score < ARKADIY_THRESHOLD && retries < MAX_RETRIES) {
        retries++;
        const extraSystem = `ПРЕДЫДУЩАЯ ПОПЫТКА БЫЛА СЛАБОЙ (оценка ${review.score}/10).
Замечания редактора:
${review.comments}
${review.errors.length ? "Ошибки: " + review.errors.join("; ") : ""}

Перепиши карусель с учётом этих замечаний.`;
        const retryGen = await generateCarousel({
          client,
          topic,
          nicheSummary: niche?.summary || undefined,
          projectId,
          tgId: project.tg_id,
          extraSystem,
        });
        totalCost += retryGen.cost;
        if (retryGen.carousel) {
          carousel = retryGen.carousel;
          try {
            const rr2 = await reviewCarousel({
              client,
              carouselJson: carousel,
              projectId,
              tgId: project.tg_id,
            });
            totalCost += rr2.cost;
            if (rr2.review) review = rr2.review;
          } catch {
            /* keep prior review */
          }
        }
      }

      const updatePayload: Record<string, any> = {
        chosen_title: carousel.carousel_title,
        caption: carousel.caption,
        body: carousel.caption,
        media_urls: carousel.slides,
        status: "pending",
        cost_usd: totalCost,
        error: null,
        updated_at: new Date().toISOString(),
      };
      if (review) {
        updatePayload.editor_score = review.score;
        updatePayload.editor_verdict = review.verdict;
        updatePayload.editor_comments = review.comments;
        updatePayload.editor_errors = review.errors;
        updatePayload.needs_review = review.verdict !== "approve";
        updatePayload.editor_prompt_version = ARKADIY_CAROUSEL_PROMPT_VERSION;
        updatePayload.editor_retries = retries;
      }
      await sb2
        .from("content_drafts")
        .update(updatePayload)
        .eq("id", draftId);
    } catch (e: any) {
      await markFailed(`carousel: ${e?.message || "fail"}`);
    }
  });

  return Response.json({ ok: true, draft_id: draftId });
}
