"use client";
import { useState } from "react";
import InlineEdit from "./InlineEdit";

export type ReviewDraft = {
  id: string;
  project_id: string;
  platform?: "telegram" | "instagram";
  content_type: "post" | "reel" | "carousel";
  status?: string;
  chosen_title?: string;
  text?: string;
  body?: string;
  caption?: string;
  video_url?: string;
  cover_url?: string;
  media_urls?: Array<{ url?: string; text?: string }> | null;
  editor_score?: number;
  editor_verdict?: string;
  editor_comments?: string;
  scheduled_at?: string | null;
  review_log?: Array<{ action: string; at: string; by_tg_id?: number }>;
  user_selections?: { animation?: string; key_indices?: number[] };
  created_at: string;
  published_message_id?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-300",
  approved: "bg-emerald-500/20 text-emerald-300",
  rejected: "bg-rose-500/20 text-rose-300",
  published: "bg-zinc-500/20 text-zinc-400",
};

function initData(): string {
  if (typeof window === "undefined") return "";
  return (window as any).Telegram?.WebApp?.initData || "";
}

async function call(path: string, method: "POST" | "PATCH" = "POST", body?: any) {
  const r = await fetch(path, {
    method,
    headers: {
      "content-type": "application/json",
      "x-telegram-init-data": initData(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}

export default function ReviewCard({
  draft,
  onChange,
}: {
  draft: ReviewDraft;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  const act = async (action: "approve" | "reject", confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    try {
      await call(`/api/drafts/${draft.id}/${action}`);
      onChange();
    } catch (e: any) {
      alert(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (patch: Record<string, any>) => {
    try {
      // media_urls приходит как JSON-строка — парсим
      const finalPatch: Record<string, any> = { ...patch };
      if (typeof finalPatch.media_urls === "string") {
        try {
          finalPatch.media_urls = JSON.parse(finalPatch.media_urls);
        } catch {
          alert("Невалидный JSON для слайдов");
          return;
        }
      }
      await call(`/api/drafts/${draft.id}/edit`, "PATCH", finalPatch);
      setEditing(false);
      onChange();
    } catch (e: any) {
      alert(e.message || String(e));
    }
  };

  const saveSchedule = async (iso: string) => {
    setBusy(true);
    try {
      await call(`/api/drafts/${draft.id}/reschedule`, "POST", { scheduled_at: iso });
      setRescheduling(false);
      onChange();
    } catch (e: any) {
      alert(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const score = typeof draft.editor_score === "number" ? draft.editor_score : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      {/* header */}
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <span className="text-xs uppercase tracking-wide text-zinc-400">{draft.content_type}</span>
        <span className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[draft.status || "pending"] || ""}`}>
          {draft.status || "pending"}
        </span>
        {score !== null && (
          <span className="ml-auto text-xs">
            Аркадий:{" "}
            <b className={score >= 7 ? "text-emerald-400" : "text-amber-400"}>{score}/10</b>
          </span>
        )}
      </div>

      {/* body */}
      <div className="space-y-3 p-4">
        {draft.content_type === "reel" && <ReelBody draft={draft} />}
        {draft.content_type === "post" && (
          <PostBody draft={draft} editing={editing} onSave={saveEdit} onCancel={() => setEditing(false)} />
        )}
        {draft.content_type === "carousel" && (
          <CarouselBody draft={draft} editing={editing} onSave={saveEdit} onCancel={() => setEditing(false)} />
        )}

        {draft.editor_comments && (
          <details className="text-xs text-zinc-400">
            <summary className="cursor-pointer">Комментарии редактора</summary>
            <p className="mt-1 whitespace-pre-wrap">{draft.editor_comments}</p>
          </details>
        )}

        {draft.scheduled_at && (
          <div className="text-xs text-indigo-300">
            📅 {new Date(draft.scheduled_at).toLocaleString("ru-RU")}
          </div>
        )}
      </div>

      {/* actions */}
      <div className="flex gap-2 border-t border-zinc-800 bg-black/40 px-3 py-3">
        <button
          disabled={busy}
          onClick={() => act("approve")}
          className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium disabled:opacity-50"
        >
          Approve
        </button>
        <button
          disabled={busy}
          onClick={() => act("reject", "Отклонить черновик?")}
          className="flex-1 rounded-lg bg-rose-600/80 py-2 text-sm font-medium disabled:opacity-50"
        >
          Reject
        </button>
        <button
          disabled={busy}
          onClick={() => setEditing((x) => !x)}
          className="flex-1 rounded-lg bg-zinc-700 py-2 text-sm disabled:opacity-50"
        >
          Edit
        </button>
        <button
          disabled={busy}
          onClick={() => setRescheduling((x) => !x)}
          className="flex-1 rounded-lg bg-indigo-700 py-2 text-sm disabled:opacity-50"
        >
          Time
        </button>
      </div>

      {rescheduling && (
        <div className="border-t border-zinc-800 bg-black/40 px-4 py-3">
          <input
            type="datetime-local"
            defaultValue={
              draft.scheduled_at ? new Date(draft.scheduled_at).toISOString().slice(0, 16) : ""
            }
            onChange={(e) => e.target.value && saveSchedule(new Date(e.target.value).toISOString())}
            className="w-full rounded bg-zinc-800 px-3 py-2 text-sm"
          />
        </div>
      )}

      {Array.isArray(draft.review_log) && draft.review_log.length > 0 && (
        <details className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-500">
          <summary className="cursor-pointer">История ({draft.review_log.length})</summary>
          <ul className="mt-2 space-y-1">
            {draft.review_log
              .slice(-5)
              .reverse()
              .map((e, i) => (
                <li key={i}>
                  · {e.action} — {new Date(e.at).toLocaleString("ru-RU")}
                </li>
              ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function ReelBody({ draft }: { draft: ReviewDraft }) {
  const captionText = draft.caption || draft.body || "";
  return (
    <div className="space-y-2">
      {draft.video_url ? (
        <video
          src={draft.video_url}
          poster={draft.cover_url || undefined}
          controls
          playsInline
          className="aspect-[9/16] w-full rounded-lg bg-black"
        />
      ) : (
        <div className="flex aspect-[9/16] w-full items-center justify-center rounded-lg bg-zinc-800 text-xs text-zinc-500">
          Видео ещё рендерится…
        </div>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400">
        {draft.user_selections?.animation && <span>Анимация: {draft.user_selections.animation}</span>}
        {Array.isArray(draft.user_selections?.key_indices) && (
          <span>Ключевых слов: {draft.user_selections!.key_indices!.length}</span>
        )}
      </div>
      {captionText && (
        <p className="whitespace-pre-wrap text-sm text-zinc-200">{captionText}</p>
      )}
    </div>
  );
}

function PostBody({
  draft,
  editing,
  onSave,
  onCancel,
}: {
  draft: ReviewDraft;
  editing: boolean;
  onSave: (p: Record<string, any>) => Promise<void>;
  onCancel: () => void;
}) {
  // tg-посты используют поле body, не text — поддерживаем оба
  const textVal = draft.text ?? draft.body ?? "";
  if (editing) {
    return (
      <InlineEdit
        initial={{ chosen_title: draft.chosen_title || "", text: textVal }}
        onSave={(v) => {
          // отправляем оба поля — обработчик примет существующие
          return onSave({
            chosen_title: v.chosen_title,
            text: v.text,
            body: v.text,
          });
        }}
        onCancel={onCancel}
        fields={[
          { key: "chosen_title", label: "Заголовок" },
          { key: "text", label: "Текст поста", multiline: true },
        ]}
      />
    );
  }
  return (
    <div className="space-y-1">
      {draft.chosen_title && <h3 className="font-semibold text-zinc-100">{draft.chosen_title}</h3>}
      <p className="whitespace-pre-wrap text-sm text-zinc-200">{textVal}</p>
    </div>
  );
}

function CarouselBody({
  draft,
  editing,
  onSave,
  onCancel,
}: {
  draft: ReviewDraft;
  editing: boolean;
  onSave: (p: Record<string, any>) => Promise<void>;
  onCancel: () => void;
}) {
  const slides = Array.isArray(draft.media_urls) ? draft.media_urls : [];
  if (editing) {
    return (
      <InlineEdit
        initial={{
          caption: draft.caption || "",
          media_urls: JSON.stringify(slides, null, 2),
        }}
        onSave={(v) => onSave({ caption: v.caption, media_urls: v.media_urls })}
        onCancel={onCancel}
        fields={[
          { key: "caption", label: "Caption", multiline: true },
          { key: "media_urls", label: "Слайды (JSON)", multiline: true },
        ]}
      />
    );
  }
  return (
    <div className="space-y-2">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
        {slides.length === 0 && (
          <div className="text-xs text-zinc-500">Слайдов нет</div>
        )}
        {slides.map((s, i) => (
          <div
            key={i}
            className="relative aspect-[4/5] w-32 shrink-0 overflow-hidden rounded-lg bg-zinc-800"
          >
            {s.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.url} alt="" className="h-full w-full object-cover" />
            )}
            {s.text && (
              <div className="absolute inset-x-0 bottom-0 line-clamp-3 bg-black/70 p-1 text-[10px]">
                {s.text}
              </div>
            )}
            <div className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px]">{i + 1}</div>
          </div>
        ))}
      </div>
      {draft.caption && (
        <p className="whitespace-pre-wrap text-sm text-zinc-200">{draft.caption}</p>
      )}
    </div>
  );
}
