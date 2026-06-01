"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SectionIcon from "../../../components/SectionIcon";
import { tgFetch, hapticImpact, hapticNotify } from "../../../lib/telegram";
import type { ProjectRow } from "../../../lib/supabase";

type IgReel = {
  id: string;
  body: string;
  video_url: string | null;
  cover_url: string | null;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  editor_score: number | null;
  needs_review: boolean;
  ig_media_id: string | null;
  ig_permalink: string | null;
  published_at: string | null;
  job?: {
    status: string;
    phase: string | null;
    error: string | null;
    attempts: number;
    updated_at: string;
  } | null;
};

const PHASE_STEPS = ["download", "extract_audio", "transcribe", "caption", "render", "upload"] as const;
const PHASE_LABELS: Record<string, string> = {
  download: "скачиваю видео",
  extract_audio: "извлекаю аудио",
  transcribe: "распознаю речь",
  caption: "Алина пишет подпись",
  render: "выжигаю субтитры",
  upload: "загружаю результат",
};

type IgCarousel = {
  id: string;
  body: string;
  media_urls: string[] | null;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  editor_score: number | null;
  needs_review: boolean;
  ig_media_id: string | null;
  ig_permalink: string | null;
  published_at: string | null;
};

type IgCompetitor = {
  id: string;
  username: string;
  full_name: string | null;
  followers: number | null;
  top_post_likes: number | null;
};

type IgSnapshot = { followers: number | null; posts_count: number | null; reels_count: number | null; snapshot_at: string };

type IgData = {
  project: ProjectRow;
  reels: IgReel[];
  carousels: IgCarousel[];
  competitors: IgCompetitor[];
  snapshots: IgSnapshot[];
};

export default function InstagramView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [data, setData] = useState<IgData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [attachUsername, setAttachUsername] = useState("");
  const [attachAccountId, setAttachAccountId] = useState("");
  const [preset, setPreset] = useState<"expert_clean" | "personal_brand_energy" | "ai_tech_fast">("expert_clean");

  const load = async () => {
    try {
      const r = await tgFetch(`/api/projects/${projectId}/ig`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "load failed");
      setData(d);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, [projectId]);

  // авто-поллинг пока есть Reels в обработке
  useEffect(() => {
    if (!data) return;
    const inProgress = data.reels.some((r) => r.job && r.job.status !== "done" && r.job.status !== "failed");
    if (!inProgress) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [data]);

  const attachInstagram = async () => {
    if (!attachUsername.trim()) return;
    setBusy(true);
    try {
      const r = await tgFetch(`/api/projects/${projectId}/attach-instagram`, {
        method: "POST",
        body: JSON.stringify({
          username: attachUsername.trim(),
          account_id: attachAccountId.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "attach failed");
      hapticNotify("success");
      await load();
    } catch (e: any) {
      setError(e.message);
      hapticNotify("error");
    } finally {
      setBusy(false);
    }
  };

  const uploadReelVideo = async (file: File) => {
    if (file.size > 52_428_800) {
      setError(`файл больше 50 МБ (${(file.size / 1_048_576).toFixed(1)} МБ)`);
      hapticNotify("error");
      return;
    }
    setBusy(true);
    setError(null);
    let stage = "init";
    try {
      // 1) длительность — best effort, с таймаутом 3 сек (TG WebView не везде поддерживает)
      stage = "metadata";
      const duration = await new Promise<number>((res) => {
        const url = URL.createObjectURL(file);
        const v = document.createElement("video");
        const timer = setTimeout(() => { URL.revokeObjectURL(url); res(0); }, 3000);
        v.preload = "metadata";
        v.onloadedmetadata = () => { clearTimeout(timer); URL.revokeObjectURL(url); res(Math.round(v.duration || 0)); };
        v.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(url); res(0); };
        v.src = url;
      });
      if (duration > 90) throw new Error(`видео длиннее 90 секунд (${duration} сек)`);

      // 2) signed upload URL
      stage = "sign";
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const r1 = await tgFetch(`/api/projects/${projectId}/ig/reels/upload-url`, {
        method: "POST",
        body: JSON.stringify({ size: file.size, duration, ext }),
      });
      const d1 = await r1.json();
      if (!r1.ok) throw new Error(`sign: ${d1.error || r1.status}`);

      // 3) Льём mp4 на VPS-proxy (Cloudflare Tunnel) — iOS блокирует прямую загрузку в Supabase
      stage = "upload";
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", d1.proxy_url, true);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.setRequestHeader("x-upload-token", d1.upload_token);
        xhr.setRequestHeader("x-storage-path", d1.storage_path);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            const pct = Math.round((ev.loaded / ev.total) * 100);
            setError(`загрузка ${pct}%…`);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) { setError(null); resolve(); }
          else reject(new Error(`upload ${xhr.status}: ${(xhr.responseText || "").slice(0, 200)}`));
        };
        xhr.onerror = () => reject(new Error(`network error (status ${xhr.status || "?"})`));
        xhr.ontimeout = () => reject(new Error("upload timeout"));
        xhr.timeout = 180_000;
        xhr.send(file);
      });

      // 4) создаём драфт + job
      stage = "create-draft";
      const r2 = await tgFetch(`/api/projects/${projectId}/ig/reels`, {
        method: "POST",
        body: JSON.stringify({
          source_video_url: d1.source_video_url,
          source_video_size: file.size,
          source_video_duration: duration,
          preset,
        }),
      });
      const d2 = await r2.json();
      if (!r2.ok) throw new Error(`draft: ${d2.error || r2.status}`);
      hapticImpact("medium");
      await load();
    } catch (e: any) {
      setError(`[${stage}] ${e.message || e}`);
      hapticNotify("error");
    } finally {
      setBusy(false);
    }
  };

  const createReelFromTopic = async () => {
    const topic = window.prompt("Тема Reel (AI-аватар, Premium):", "");
    if (!topic || !topic.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await tgFetch(`/api/projects/${projectId}/ig/reels`, {
        method: "POST",
        body: JSON.stringify({ topic: topic.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "fail");
      hapticImpact("medium");
      await load();
    } catch (e: any) {
      setError(e.message);
      hapticNotify("error");
    } finally {
      setBusy(false);
    }
  };

  const createCarousel = async () => {
    setBusy(true);
    try {
      const r = await tgFetch(`/api/projects/${projectId}/ig/carousels`, {
        method: "POST",
        body: JSON.stringify({ caption: "(placeholder caption)", media_urls: [] }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "fail");
      hapticImpact("light");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const project = data?.project;
  const attached = !!project?.instagram_username;

  return (
    <>
      <div style={{ paddingTop: 16, paddingLeft: 22, paddingRight: 22 }} className="flex justify-between items-center">
        <button onClick={() => router.back()} className="text-sm text-amber">← назад</button>
        <span className="text-[11px] text-muted uppercase tracking-wider">Instagram-проект</span>
      </div>

      <div style={{ paddingLeft: 22, paddingRight: 22 }} className="pt-3 pb-24 space-y-4">
        <h1 className="text-xl font-semibold">{project?.title ?? "…"}</h1>

        {/* Привязка IG-аккаунта */}
        {!attached && (
          <div className="glass rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold">📸 Привязать Instagram-аккаунт</h3>
            <p className="text-xs text-muted">
              Введи @username и (опционально) Business Account ID. Long-lived access token
              настраивается через переменные окружения (Этап 4).
            </p>
            <input
              value={attachUsername}
              onChange={(e) => setAttachUsername(e.target.value)}
              placeholder="@username"
              className="w-full bg-white/[0.04] rounded-md px-3 py-2 text-sm outline-none"
            />
            <input
              value={attachAccountId}
              onChange={(e) => setAttachAccountId(e.target.value)}
              placeholder="IG account ID (опц.)"
              className="w-full bg-white/[0.04] rounded-md px-3 py-2 text-sm outline-none"
            />
            <button
              onClick={attachInstagram}
              disabled={!attachUsername.trim() || busy}
              className="w-full text-sm py-2 rounded-md font-medium disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #E1306C, #F77737)", color: "#fff" }}
            >
              привязать
            </button>
          </div>
        )}

        {attached && (
          <div className="glass rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">@{project!.instagram_username}</div>
              <div className="text-xs text-muted">
                {project!.instagram_followers != null ? `${project!.instagram_followers.toLocaleString("ru-RU")} подписчиков` : "подписчики — TBD"}
              </div>
            </div>
            <a
              href={`https://instagram.com/${project!.instagram_username}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-amber"
            >
              открыть →
            </a>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div>
        )}

        {/* 01 Аналитика IG */}
        <Section idx="01" icon="analytics" title="Аналитика IG">
          <p className="text-xs text-muted">
            Подписчики, лайки, охваты, топ постов. TODO Этап 4 — Николай-аналитик подключит IG Graph Insights API.
          </p>
          <div className="text-[11px] text-muted/60 mt-2">
            снимков: {data?.snapshots.length ?? 0}
          </div>
        </Section>

        {/* 02 Конкуренты IG */}
        <Section idx="02" icon="scout" title="Конкуренты IG">
          <p className="text-xs text-muted mb-2">
            Топ-аккаунтов в нише + их топ-посты. TODO Этап 4 — Разведчик IG (hashtag scout).
          </p>
          {(data?.competitors ?? []).length === 0 ? (
            <p className="text-[11px] text-muted/60">пока пусто</p>
          ) : (
            <ul className="space-y-1">
              {data!.competitors.map((c) => (
                <li key={c.id} className="text-xs flex justify-between">
                  <span>@{c.username}</span>
                  <span className="text-muted">{c.followers?.toLocaleString("ru-RU") ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* 03 Стратегия ниши IG */}
        <Section idx="03" icon="strategy" title="Стратегия ниши IG">
          <p className="text-xs text-muted">
            Паттерны топ-аккаунтов: формат Reels, длина caption, hashtag-стратегия. TODO Этап 4.
          </p>
        </Section>

        {/* 04 План на неделю IG */}
        <Section idx="04" icon="plan" title="План на неделю IG">
          <p className="text-xs text-muted">
            Микс на неделю: 2 Reels + 2 карусели + 3 поста. TODO Этап 4 — Милана Контент-директор.
          </p>
        </Section>

        {/* 05 Reels-фабрика */}
        <Section idx="05" icon="drafts" title="Reels — Михаил">
          <p className="text-xs text-muted mb-3">
            Грузишь своё видео (до 50 МБ, до 90 сек) → Whisper транскрибирует →
            Алина пишет caption + overlays → FFmpeg выжигает субтитры в выбранном стиле.
          </p>

          {/* выбор пресета */}
          <div className="mb-3 space-y-1.5">
            <div className="text-[10px] text-muted uppercase tracking-wider">стиль монтажа</div>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { id: "expert_clean", label: "Эксперт", emoji: "✨", desc: "Минимализм" },
                { id: "personal_brand_energy", label: "Бренд", emoji: "🔥", desc: "Динамика" },
                { id: "ai_tech_fast", label: "AI-tech", emoji: "⚡", desc: "Холодный" },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setPreset(opt.id)}
                  className="text-[10px] py-2 rounded-md font-medium transition text-left px-2"
                  style={
                    preset === opt.id
                      ? { background: "linear-gradient(135deg, #E1306C, #F77737)", color: "#fff" }
                      : { background: "rgba(255,255,255,0.04)", color: "#94A3B8" }
                  }
                >
                  <div>{opt.emoji} {opt.label}</div>
                  <div className="opacity-60 text-[9px]">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <label
            className="block text-center text-xs py-2 px-3 rounded-md font-medium mb-2 cursor-pointer"
            style={{ background: "rgba(225, 48, 108, 0.15)", color: "#E1306C", opacity: busy ? 0.4 : 1 }}
          >
            📹 загрузить своё видео
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadReelVideo(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
          <button
            onClick={createReelFromTopic}
            disabled={busy}
            className="w-full text-[11px] py-1.5 px-3 rounded-md mb-3"
            style={{ background: "rgba(255,255,255,0.04)", color: "#94A3B8" }}
          >
            или сгенерировать AI-аватара (Premium)
          </button>
          <ReelList items={data?.reels ?? []} />
        </Section>

        {/* 06 Карусели */}
        <Section idx="06" icon="drafts" title="Карусели — Алина + Аркадий">
          <p className="text-xs text-muted mb-3">
            Caption + раскадровка слайдов. Алина пишет, Аркадий ревьюит, Виктор публикует.
          </p>
          <button
            onClick={createCarousel}
            disabled={busy}
            className="text-xs py-2 px-3 rounded-md font-medium mb-3"
            style={{ background: "rgba(247, 119, 55, 0.15)", color: "#F77737" }}
          >
            + новая карусель (заглушка)
          </button>
          <CarouselList items={data?.carousels ?? []} />
        </Section>

        {/* 07 Публикатор */}
        <Section idx="07" icon="community" title="Публикатор — Виктор">
          <p className="text-xs text-muted">
            Автопубликация в IG по расписанию (cron `ig-publish-scheduled`). TODO Этап 3 —
            подключение IG Graph API + retry до 3 раз. Сейчас все эндпойнты вернут 501.
          </p>
        </Section>
      </div>
    </>
  );
}

function Section({ idx, icon, title, children }: { idx: string; icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-4 space-y-2">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <span className="text-amber text-xs font-medium">{idx}</span>
        <SectionIcon name={icon} />
        <span>{title}</span>
      </h4>
      {children}
    </div>
  );
}

function ReelProgress({ job }: { job: NonNullable<IgReel["job"]> }) {
  if (job.status === "failed") {
    return (
      <div className="mt-2 text-[10px] rounded-md p-2 border" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", color: "#fca5a5" }}>
        ⚠️ ошибка: {job.error?.slice(0, 200) || "неизвестная"}
      </div>
    );
  }
  if (job.status === "done") return null;

  const phase = job.phase || "download";
  const phaseIdx = PHASE_STEPS.indexOf(phase as any);
  const pct = phaseIdx < 0 ? 5 : Math.round(((phaseIdx + 1) / PHASE_STEPS.length) * 100);
  const label = PHASE_LABELS[phase] || (job.status === "pending" ? "в очереди" : "обрабатываю");

  return (
    <div className="mt-2 space-y-1">
      <div className="flex justify-between items-center text-[10px]">
        <span className="text-amber">{label}…</span>
        <span className="text-muted">{pct}%</span>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #E1306C, #F77737)" }}
        />
      </div>
    </div>
  );
}

function ReelList({ items }: { items: IgReel[] }) {
  if (items.length === 0) return <p className="text-[11px] text-muted/60">пока пусто</p>;
  return (
    <ul className="space-y-2">
      {items.map((r) => (
        <li key={r.id} className="bg-white/[0.03] rounded-md p-2.5 text-xs">
          <div className="flex justify-between items-start gap-2">
            <span className="line-clamp-2 flex-1">{r.body || "(пусто)"}</span>
            <StatusChip status={r.status} score={r.editor_score} />
          </div>
          {r.job && r.job.status !== "done" && <ReelProgress job={r.job} />}
          {r.video_url && (
            <video controls src={r.video_url} poster={r.cover_url || undefined} className="mt-2 w-full rounded-md max-h-64 bg-black" />
          )}
          {r.ig_permalink && (
            <a href={r.ig_permalink} target="_blank" rel="noreferrer" className="text-[10px] text-amber">
              опубликовано →
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function CarouselList({ items }: { items: IgCarousel[] }) {
  if (items.length === 0) return <p className="text-[11px] text-muted/60">пока пусто</p>;
  return (
    <ul className="space-y-2">
      {items.map((c) => (
        <li key={c.id} className="bg-white/[0.03] rounded-md p-2.5 text-xs">
          <div className="flex justify-between items-start gap-2">
            <span className="line-clamp-2 flex-1">{c.body || "(пусто)"}</span>
            <StatusChip status={c.status} score={c.editor_score} />
          </div>
          <div className="text-[10px] text-muted/60 mt-1">
            слайдов: {Array.isArray(c.media_urls) ? c.media_urls.length : 0}
          </div>
        </li>
      ))}
    </ul>
  );
}

function StatusChip({ status, score }: { status: string; score: number | null }) {
  const label =
    status === "approved" ? "одобрено" :
    status === "pending" ? "черновик" : status;
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: "rgba(255,255,255,0.06)", color: "#F0A020" }}>
      {label}{typeof score === "number" ? ` · ${score}/10` : ""}
    </span>
  );
}
