import { NextRequest } from "next/server";
import { getSupabase } from "../../../../../../../lib/supabase";
import { verifyInitData } from "../../../../../../../lib/verifyTelegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BUCKET = "post-photos";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; draftId: string }> }) {
  const { id, draftId } = await ctx.params;
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });

  const sb = getSupabase();
  const { data: project } = await sb
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("tg_id", v.user.id)
    .maybeSingle();
  if (!project) return Response.json({ error: "проект не найден" }, { status: 404 });

  const { data: draft } = await sb
    .from("content_drafts")
    .select("id, photo_storage_path")
    .eq("id", draftId)
    .eq("project_id", id)
    .maybeSingle();
  if (!draft) return Response.json({ error: "черновик не найден" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("photo");
  if (!(file instanceof File)) return Response.json({ error: "поле photo обязательно" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "файл больше 10 МБ" }, { status: 400 });
  if (!file.type.startsWith("image/")) return Response.json({ error: "только изображения" }, { status: 400 });

  // Удаляем предыдущее фото, если было
  if (draft.photo_storage_path) {
    await sb.storage.from(BUCKET).remove([draft.photo_storage_path]).catch(() => {});
  }

  const ext = file.type.split("/")[1] || "jpg";
  const path = `${id}/${draftId}-${Date.now()}.${ext}`;
  const buf = await file.arrayBuffer();
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, buf, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) return Response.json({ error: upErr.message }, { status: 500 });

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  const photoUrl = pub.publicUrl;

  await sb
    .from("content_drafts")
    .update({ photo_url: photoUrl, photo_storage_path: path })
    .eq("id", draftId);

  return Response.json({ ok: true, photo_url: photoUrl });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; draftId: string }> }) {
  const { id, draftId } = await ctx.params;
  const v = verifyInitData(req.headers.get("x-telegram-init-data"));
  if (!v.ok || !v.user) return Response.json({ error: v.error ?? "unauthorized" }, { status: 401 });

  const sb = getSupabase();
  const { data: project } = await sb
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("tg_id", v.user.id)
    .maybeSingle();
  if (!project) return Response.json({ error: "проект не найден" }, { status: 404 });

  const { data: draft } = await sb
    .from("content_drafts")
    .select("photo_storage_path")
    .eq("id", draftId)
    .eq("project_id", id)
    .maybeSingle();
  if (!draft) return Response.json({ error: "черновик не найден" }, { status: 404 });

  if (draft.photo_storage_path) {
    await sb.storage.from(BUCKET).remove([draft.photo_storage_path]).catch(() => {});
  }

  await sb
    .from("content_drafts")
    .update({ photo_url: null, photo_storage_path: null })
    .eq("id", draftId);

  return Response.json({ ok: true });
}
