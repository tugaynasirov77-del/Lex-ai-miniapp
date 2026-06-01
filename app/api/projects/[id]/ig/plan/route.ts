import { NextRequest } from "next/server";

export const runtime = "nodejs";

// СКЕЛЕТ — Этап 4 (Милана Контент-директор) наполнит реальным планировщиком.
// План IG-недели = 2 Reels + 2 карусели + 3 поста-картинки (или иное соотношение).

export async function GET(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  return Response.json({
    plan: null,
    stub: true,
    message: "IG план — TODO Этап 4. Милана будет анализировать конкурентов и собирать недельный микс Reels+карусели+посты.",
  });
}

export async function POST(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  return Response.json({ ok: false, stub: true, message: "TODO Этап 4: Милана генерирует недельный IG-план" }, { status: 501 });
}
