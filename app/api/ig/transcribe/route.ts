import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Whisper proxy: worker на VPS (RU IP) не может ходить напрямую в OpenAI,
// Vercel (US/EU) — может. Worker присылает аудио, мы пересылаем в Whisper.

export async function POST(req: NextRequest) {
  if (req.headers.get("x-worker-secret") !== process.env.WORKER_SECRET) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });

  // Принимаем multipart с полем "file"
  const form = await req.formData();
  const file = form.get("file");
  const language = (form.get("language") as string) || "ru";
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > 24 * 1024 * 1024) {
    return Response.json({ error: "file > 24 MB (Whisper limit)" }, { status: 413 });
  }

  // Пересылаем в OpenAI
  const whisperForm = new FormData();
  whisperForm.append("file", file, "audio.mp3");
  whisperForm.append("model", "whisper-1");
  whisperForm.append("response_format", "srt");
  whisperForm.append("language", language);

  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: whisperForm,
  });
  if (!r.ok) {
    const t = await r.text();
    return Response.json({ error: `whisper ${r.status}: ${t.slice(0, 300)}` }, { status: 502 });
  }
  const srt = await r.text();
  return new Response(srt, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
