"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReviewCard, { type ReviewDraft } from "../../components/ReviewCard";

type Project = { id: string; title: string; platform: "telegram" | "instagram" };

const TYPES = ["all", "post", "reel", "carousel"] as const;
type TypeFilter = (typeof TYPES)[number];

function initData(): string {
  if (typeof window === "undefined") return "";
  return (window as any).Telegram?.WebApp?.initData || "";
}

export default function ReviewPage() {
  const [drafts, setDrafts] = useState<ReviewDraft[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/drafts/review-queue", {
        headers: { "x-telegram-init-data": initData() },
        cache: "no-store",
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setDrafts(j.drafts || []);
      setProjects(j.projects || []);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const visible = useMemo(() => {
    return drafts.filter((d) => {
      if (typeFilter !== "all" && d.content_type !== typeFilter) return false;
      if (projectFilter !== "all" && d.project_id !== projectFilter) return false;
      return true;
    });
  }, [drafts, typeFilter, projectFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: drafts.length, post: 0, reel: 0, carousel: 0 };
    for (const d of drafts) c[d.content_type] = (c[d.content_type] || 0) + 1;
    return c;
  }, [drafts]);

  return (
    <div className="min-h-screen bg-black pb-24 text-white">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Review</h1>
          <button
            onClick={reload}
            className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
            aria-label="Обновить"
          >
            ↻
          </button>
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-sm ${
                typeFilter === t ? "bg-white text-black" : "bg-zinc-800 text-zinc-300"
              }`}
            >
              {t} <span className="opacity-60">({counts[t] ?? 0})</span>
            </button>
          ))}
        </div>

        {projects.length > 1 && (
          <div className="mt-2 flex gap-2 overflow-x-auto">
            <button
              onClick={() => setProjectFilter("all")}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${
                projectFilter === "all" ? "bg-white text-black" : "bg-zinc-800 text-zinc-300"
              }`}
            >
              Все проекты
            </button>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setProjectFilter(p.id)}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${
                  projectFilter === p.id ? "bg-white text-black" : "bg-zinc-800 text-zinc-300"
                }`}
              >
                {p.platform === "instagram" ? "📷 " : "💬 "}
                {p.title}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="space-y-3 px-4 py-3">
        {loading && <div className="py-12 text-center text-sm text-zinc-500">Загружаю…</div>}
        {error && <div className="rounded bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
        {!loading && !error && visible.length === 0 && (
          <div className="py-12 text-center text-sm text-zinc-500">Нет черновиков на ревью</div>
        )}
        {visible.map((d) => (
          <ReviewCard key={d.id} draft={d} onChange={reload} />
        ))}
      </main>
    </div>
  );
}
