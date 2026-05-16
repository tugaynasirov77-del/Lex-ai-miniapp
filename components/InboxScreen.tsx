"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "./Header";
import { tgFetch, hapticSelection } from "../lib/telegram";

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
  payload?: Record<string, any>;
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

export default function InboxScreen() {
  const [events, setEvents] = useState<InboxEvent[]>([]);
  const [projectsCount, setProjectsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<EventKind | null>(null);

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

  return (
    <>
      <Header
        title="История"
        accent={String(events.length)}
        subtitle={projectsCount === 0 ? "пока нет проектов" : `событий по проектам`}
      />

      <div className="px-5 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
        <Chip label="всё" count={events.length} active={filter === null} onClick={() => setFilter(null)} />
        {counts.pending_draft ? <Chip label="на одобрение" count={counts.pending_draft} color="#F0A020" active={filter === "pending_draft"} onClick={() => setFilter(filter === "pending_draft" ? null : "pending_draft")} /> : null}
        {counts.publish_failed ? <Chip label="ошибки" count={counts.publish_failed} color="#ef4444" active={filter === "publish_failed"} onClick={() => setFilter(filter === "publish_failed" ? null : "publish_failed")} /> : null}
        {counts.approved_soon ? <Chip label="в очереди" count={counts.approved_soon} color="#7dd3fc" active={filter === "approved_soon"} onClick={() => setFilter(filter === "approved_soon" ? null : "approved_soon")} /> : null}
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
        {!loading && visible.map((ev) => <EventCard key={ev.id} ev={ev} />)}
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

function EventCard({ ev }: { ev: InboxEvent }) {
  const style = TYPE_STYLE[ev.type];
  return (
    <Link
      href={`/projects/${ev.project_id}`}
      onClick={() => hapticSelection()}
      className="block glass rounded-xl p-3.5 active:scale-[0.99] transition-transform"
      style={{ borderLeft: `3px solid ${style.color}` }}
    >
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: style.bg }}>
          {style.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-ink leading-tight">{ev.title}</div>
          <div className="text-[12px] text-ink/70 mt-0.5 leading-snug line-clamp-2">{ev.subtitle}</div>
          <div className="text-[10px] text-muted mt-1.5 flex items-center gap-1.5">
            <span className="truncate">{ev.channel_username ? `@${ev.channel_username}` : ev.project_title}</span>
            <span>·</span>
            <span>{timeAgo(ev.at)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
