import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../../lib/verifyTelegram";
import {
  refineScriptBlock,
  type RefineAction,
  type ScriptProjectContext,
} from "../../../../../../../lib/scriptGenerator";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * POST /api/projects/[id]/ig/script/refine
 *
 * Переписывает один блок сценария по выбранному AI-действию.
 * Body: { block_name: string, current_text: string, action: RefineAction }
 * Ответ: { ok: true, text: string }
 *
 * Расход трекается в project_usage (agent_role='script_refine').
 */

const ACTIONS: RefineAction[] = ["shorter", "sharper", "calmer", "expert", "simpler", "alternative"];

async function authProject(req: NextRequest, projectId: string) {
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user)
    return { err: Response.json({ error: "unauthorized" }, { status: 401 }) };
  const sb = getSupabase();
  const { data } = await sb
    .from("projects")
    .select("id, tg_id, niche, audience, content_style, content_language")
    .eq("id", projectId)
    .eq("tg_id", v.user.id)
    .maybeSingle();
  if (!data) return { err: Response.json({ error: "project not found" }, { status: 404 }) };
  return { project: data };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authProject(req, id);
  if ("err" in a) return a.err;

  const body = await req.json().catch(() => ({}));
  const blockName = String(body?.block_name || "").trim();
  const currentText = String(body?.current_text || "").trim();
  const action = body?.action as RefineAction;

  if (!blockName) return Response.json({ error: "block_name required" }, { status: 400 });
  if (currentText.length < 2)
    return Response.json({ error: "current_text слишком короткий" }, { status: 400 });
  if (!ACTIONS.includes(action))
    return Response.json({ error: "invalid action" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY)
    return Response.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });

  const projectCtx: ScriptProjectContext = {
    niche: a.project.niche,
    audience: a.project.audience,
    content_style: a.project.content_style,
    content_language: a.project.content_language,
  };

  try {
    const text = await refineScriptBlock({ blockName, currentText, action, projectCtx });
    const sb = getSupabase();
    await sb.from("project_usage").insert({
      project_id: id,
      agent_role: "script_refine",
      cost_usd: 0.005,
      model: "claude-haiku-4-5-20251001",
    });
    return Response.json({ ok: true, text });
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "Не получилось переписать. Попробуй ещё раз." },
      { status: 500 },
    );
  }
}
