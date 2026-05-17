"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "./Header";
import { TelegramPostPreview } from "./TelegramPostPreview";
import { tgFetch, hapticSelection, hapticImpact, hapticNotify } from "../lib/telegram";

type EventKind =
  | "pending_draft"
  | "approved_soon"
  | "published"
  | "publish_failed"
  | "new_competitors"
  | "channel_growth";

type InboxEvent = {
  id: string;
  type: EventKind;
  project_id: string;
  project_title: string;
  channel_username: string | null;
  title: string;
  subtitle: string;
  at: string;
  priority: number;
  payload?: {
    draft_id?: string;
    plan_day?: string;
    message_id?: number;
    count?: number;
    attempts?: number;
    body?: string;
    photo_url?: string | null;
    poll_data?: {
      question: string;
      options: string[];
      type: "poll" | "quiz";
      correct_option_id?: number | null;
      explanation?: string | null;
    } | null;
    title?: string | null;
  };
};

const TYPE_STYLE: Record<EventKind, { color: string; bg: string; emoji: string }> = {
  publish_failed: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.10)", emoji: "⚠️" },
  pending_draft: { color: "#F0A020", bg: "rgba(240, 160, 32, 0.10)", emoji: "📝" },
  new_competitors: { color: "#a98cff", bg: "rgba(124, 92, 252, 0.10)", emoji: "🔍" },
  channel_growth: { color: "#22d3a5", bg: "rgba(34, 211, 165, 0.10)", emoji: "📈" },
  approved_soon: { color: "#7dd3fc", bg: "rgba(125, 211, 252, 0.08)", emoji: "⏰" },
  published: { color: "#22d3a5", bg: "rgba(34, 211, 165, 0.06)", emoji: "✓" },
};

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 0) {
    const f = Math.abs(d);
    const min = Math.round(f / 60_000);
    if (min < 60) return `через ${min} мин`;
    const h = Math.round(min / 60);
    if (h < 24) return `через ${h} ч`;
    return `через ${Math.round(h / 24)} дн`;
  }
  const min = Math.round(d / 60_000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.round(h / 24)} дн назад`;
}

function timeOfDay(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function InboxScreen() {
  const [events, setEvents] = useState<InboxEvent[]>([]);
  const [projectsCount, setProjectsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<EventKind | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // id события в работе
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await tgFetch(`/api/inbox?t=${Date.now()}`, { cache: "no-store" } as any);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "не удалось загрузить");
      setEvents(d.events ?? []);
      setProjectsCount(d.projects_count ?? 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const counts: Partial<Record<EventKind, number>> = {};
  for (const e of events) counts[e.type] = (counts[e.type] ?? 0) + 1;
  const visible = filter ? events.filter((e) => e.type === filter) : events;

  const decideDraft = async (ev: InboxEvent, status: "approved" | "rejected") => {
    if (!ev.payload?.draft_id) return;
    hapticImpact(status === "approved" ? "medium" : "light");
    setBusy(ev.id);
    try {
      await tgFetch(`/api/projects/${ev.project_id}/drafts`, {
        method: "PATCH",
        body: JSON.stringify({ draft_id: ev.payload.draft_id, status }),
      });
      hapticNotify("success");
      await load();
    } catch {
      hapticNotify("error");
    } finally {
      setBusy(null);
    }
  };

  const uploadPhoto = async (ev: InboxEvent, file: File) => {
    if (!ev.payload?.draft_id) return;
    hapticImpact("light");
    setBusy(ev.id);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      await tgFetch(`/api/projects/${ev.project_id}/drafts/${ev.payload.draft_id}/photo`, {
        method: "POST",
        body: fd,
      });
      hapticNotify("success");
      await load();
    } catch {
      hapticNotify("error");
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = async (ev: InboxEvent) => {
    if (!ev.payload?.draft_id) return;
    hapticImpact("light");
    setBusy(ev.id);
    try {
      await tgFetch(`/api/projects/${ev.project_id}/drafts/${ev.payload.draft_id}/photo`, { method: "DELETE" });
      hapticNotify("success");
      await load();
    } catch {
      hapticNotify("error");
    } finally {
      setBusy(null);
    }
  };

  const publishNow = async (ev: InboxEvent) => {
    if (!ev.payload?.draft_id) return;
    hapticImpact("heavy");
    setBusy(ev.id);
    try {
      await tgFetch(`/api/projects/${ev.project_id}/drafts/${ev.payload.draft_id}/publish`, {
        method: "POST",
        body: JSON.stringify({ titleIndex: 0 }),
      });
      hapticNotify("success");
      await load();
    } catch {
      hapticNotify("error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Header
        title="История"
        accent={String(events.length)}
        subtitle={projectsCount === 0 ? "пока нет проектов" : `событий по проектам`}
      />

      <div className="px-5 pb-3 flex flex-wrap gap-2">
        <Chip label="всё" count={events.length} active={filter === null} onClick={() => setFilter(null)} />
        {counts.pending_draft ? <Chip label="на одобрение" count={counts.pending_draft} color="#F0A020" active={filter === "pending_draft"} onClick={() => setFilter(filter === "pending_draft" ? null : "pending_draft")} /> : null}
        {counts.publish_failed ? <Chip label="ошибки" count={counts.publish_failed} color="#ef4444" active={filter === "publish_failed"} onClick={() => setFilter(filter === "publish_failed" ? null : "publish_failed")} /> : null}
        {counts.approved_soon ? <Chip label="в работе" count={counts.approved_soon} color="#7dd3fc" active={filter === "approved_soon"} onClick={() => setFilter(filter === "approved_soon" ? null : "approved_soon")} /> : null}
        {counts.new_competitors ? <Chip label="конкуренты" count={counts.new_competitors} color="#a98cff" active={filter === "new_competitors"} onClick={() => setFilter(filter === "new_competitors" ? null : "new_competitors")} /> : null}
        {counts.published ? <Chip label="вышло" count={counts.published} color="#22d3a5" active={filter === "published"} onClick={() => setFilter(filter === "published" ? null : "published")} /> : null}
      </div>

      <div className="px-5 pb-24 space-y-2">
        {loading && <p className="text-sm text-muted py-8 text-center">загружаю…</p>}
        {error && <p className="text-sm py-4 text-center" style={{ color: "#ef4444" }}>{error}</p>}
        {!loading && events.length === 0 && (
          <div className="py-12 text-center space-y-3">
            <div className="text-5xl">🌱</div>
            <p className="text-sm text-muted">Пока тихо. Зайди в проекты — там вся работа.</p>
            <Link href="/projects" className="inline-block text-xs px-4 py-2 rounded-md font-medium" style={{ background: "linear-gradient(135deg, #F0A020, #D05020)", color: "#0A0705" }}>
              открыть проекты
            </Link>
          </div>
        )}
        {!loading && visible.map((ev) => (
          <EventCard
            key={ev.id}
            ev={ev}
            busy={busy === ev.id}
            expanded={expandedId === ev.id}
            onToggle={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
            onApprove={() => decideDraft(ev, "approved")}
            onDelete={() => decideDraft(ev, "rejected")}
            onPublishNow={() => publishNow(ev)}
            onUploadPhoto={(file) => uploadPhoto(ev, file)}
            onRemovePhoto={() => removePhoto(ev)}
          />
        ))}
      </div>
    </>
  );
}

function Chip({ label, count, active, color, onClick }: { label: string; count: number; active?: boolean; color?: string; onClick?: () => void }) {
  return (
    <button
      onClick={() => {
        hapticSelection();
        onClick?.();
      }}
      className="px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 active:scale-[0.97] transition-transform"
      style={{
        background: active ? "rgba(240, 160, 32, 0.15)" : "rgba(255,255,255,0.04)",
        color: active ? "#F0A020" : color ?? "#8a8175",
      }}
    >
      <span>{label}</span>
      <span className="opacity-70 tnum">{count}</span>
    </button>
  );
}

function EventCard({
  ev,
  busy,
  expanded,
  onToggle,
  onApprove,
  onDelete,
  onPublishNow,
  onUploadPhoto,
  onRemovePhoto,
}: {
  ev: InboxEvent;
  busy: boolean;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onDelete: () => void;
  onPublishNow: () => void;
  onUploadPhoto: (f: File) => void;
  onRemovePhoto: () => void;
}) {
  const router = useRouter();
  const style = TYPE_STYLE[ev.type];
  const planDay = ev.payload?.plan_day;
  const isDraftEvent = (ev.type === "pending_draft" || ev.type === "approved_soon") && !!ev.payload?.draft_id;
  const isPoll = !!ev.payload?.poll_data;

  const handleBodyClick = () => {
    if (isDraftEvent) {
      hapticSelection();
      onToggle();
    } else {
      hapticSelection();
      router.push(`/projects/${ev.project_id}`);
    }
  };

  return (
    <div
      className="glass rounded-xl p-3.5 space-y-2.5"
      style={{ borderLeft: `3px solid ${style.color}` }}
    >
      <button
        onClick={handleBodyClick}
        className="w-full text-left flex items-start gap-2.5 active:opacity-80"
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: style.bg }}>
          {style.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[13px] font-semibold text-ink leading-tight">{ev.title}</div>
            {planDay && (
              <span className="text-[10px] font-medium uppercase shrink-0 px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: style.color }}>
                {planDay}{ev.type === "approved_soon" ? ` ${timeOfDay(ev.at)}` : ""}
              </span>
            )}
          </div>
          <div className="text-[12px] text-ink/70 mt-0.5 leading-snug line-clamp-2">{ev.subtitle}</div>
          <div className="text-[10px] text-muted mt-1.5 flex items-center gap-1.5">
            <span className="truncate">{ev.channel_username ? `@${ev.channel_username}` : ev.project_title}</span>
            <span>·</span>
            <span>{timeAgo(ev.at)}</span>
            {isDraftEvent && <span className="ml-auto text-[10px]">{expanded ? "▴" : "▾"}</span>}
          </div>
        </div>
      </button>

      {/* Развёрнутое превью: текст поста + фото upload */}
      {expanded && isDraftEvent && (
        <div className="space-y-2 pt-1 border-t border-white/5">
          {isPoll && ev.payload?.poll_data ? (
            <div className="space-y-1.5">
              <div className="text-[10px] text-muted uppercase tracking-wider">{ev.payload.poll_data.type === "quiz" ? "Викторина" : "Опрос"}</div>
              <div className="bg-white/[0.03] rounded-md p-2.5 space-y-2">
                <div className="text-xs font-medium text-ink/95">{ev.payload.poll_data.question}</div>
                <div className="space-y-1">
                  {ev.payload.poll_data.options.map((opt, k) => {
                    const isCorrect = ev.payload?.poll_data?.type === "quiz" && ev.payload?.poll_data?.correct_option_id === k;
                    return (
                      <div
                        key={k}
                        className="text-[11px] px-2 py-1.5 rounded flex items-center gap-2"
                        style={{
                          background: isCorrect ? "rgba(34, 211, 165, 0.10)" : "rgba(255,255,255,0.03)",
                          color: isCorrect ? "#22d3a5" : "#F5EDD8",
                        }}
                      >
                        <span className="opacity-50">{k + 1}.</span>
                        <span className="flex-1">{opt}</span>
                        {isCorrect && <span className="text-[10px]">✓</span>}
                      </div>
                    );
                  })}
                </div>
                {ev.payload.poll_data.type === "quiz" && ev.payload.poll_data.explanation && (
                  <div className="text-[10px] text-muted italic pt-1 border-t border-white/5">{ev.payload.poll_data.explanation}</div>
                )}
              </div>
            </div>
          ) : ev.payload?.body ? (
            <div>
              <div className="text-[10px] text-muted uppercase tracking-wider mb-1">текст поста</div>
              <TelegramPostPreview body={ev.payload.body} className="text-xs text-ink/90 leading-relaxed bg-white/[0.03] rounded-md p-2.5" />
            </div>
          ) : null}

          {/* Фото — только для текстовых постов */}
          {!isPoll && (
            ev.payload?.photo_url ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ev.payload.photo_url} alt="" className="w-full max-h-40 object-cover rounded-md" />
                <button
                  onClick={(e) => { e.stopPropagation(); onRemovePhoto(); }}
                  disabled={busy}
                  className="absolute top-1.5 right-1.5 text-[10px] px-2 py-1 rounded bg-black/60 text-white"
                >
                  убрать фото
                </button>
              </div>
            ) : (
              <label
                className="block w-full text-center text-xs py-2 rounded-md font-medium cursor-pointer"
                style={{ background: "rgba(124, 92, 252, 0.12)", color: "#a98cff" }}
                onClick={(e) => e.stopPropagation()}
              >
                прикрепить фото
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadPhoto(f);
                    e.target.value = "";
                  }}
                />
              </label>
            )
          )}

          {ev.payload?.title && !isPoll && (
            <div className="text-[10px] text-muted text-center">заголовок: {ev.payload.title}</div>
          )}
        </div>
      )}

      {ev.type === "pending_draft" && isDraftEvent && (
        <div className="flex gap-2">
          <ActionButton
            label={busy ? "…" : "одобрить"}
            onClick={onApprove}
            disabled={busy}
            color="#22d3a5"
            bg="rgba(34, 211, 165, 0.15)"
            flex
          />
          <ActionButton
            label="удалить"
            onClick={onDelete}
            disabled={busy}
            color="#ef4444"
            bg="rgba(239, 68, 68, 0.12)"
            flex
          />
        </div>
      )}

      {ev.type === "approved_soon" && isDraftEvent && (
        <div className="flex gap-2">
          <ActionButton
            label={busy ? "…" : "опубликовать сейчас"}
            onClick={onPublishNow}
            disabled={busy}
            color="#0A0705"
            bg="linear-gradient(135deg, #F0A020, #D05020)"
            flex
          />
          <ActionButton
            label="удалить"
            onClick={onDelete}
            disabled={busy}
            color="#ef4444"
            bg="rgba(239, 68, 68, 0.12)"
          />
        </div>
      )}
    </div>
  );
}

function ActionButton({ label, onClick, disabled, color, bg, flex }: { label: string; onClick: () => void; disabled?: boolean; color: string; bg: string; flex?: boolean }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className={`text-xs py-2 px-3 rounded-md font-medium active:scale-[0.97] transition-transform disabled:opacity-40 ${flex ? "flex-1" : ""}`}
      style={{ background: bg, color }}
    >
      {label}
    </button>
  );
}
