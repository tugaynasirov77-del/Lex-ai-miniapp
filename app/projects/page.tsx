"use client";

import { useEffect, useState } from "react";
import Header from "../../components/Header";
import { getAgent } from "../../lib/mockData";
import { getTgId, tgFetch, hapticImpact, hapticNotify } from "../../lib/telegram";
import type { ProjectRow } from "../../lib/supabase";

const STATUS_LABEL: Record<ProjectRow["status"], { text: string; color: string }> = {
  in_progress: { text: "В работе", color: "bg-amber/15 text-amber" },
  done: { text: "Завершён", color: "bg-emerald-500/15 text-emerald-400" },
  paused: { text: "На паузе", color: "bg-white/5 text-faint" },
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tgId, setTgId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    const id = getTgId();
    setTgId(id);
    if (!id) {
      setLoading(false);
      return;
    }
    load(id);
  }, []);

  const load = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await tgFetch(`/api/projects`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "load failed");
      setProjects(d.projects ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!tgId || !newTitle.trim()) return;
    hapticImpact("medium");
    setCreating(true);
    setError(null);
    try {
      const r = await tgFetch("/api/projects", {
        method: "POST",
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "create failed");
      setNewTitle("");
      setProjects((p) => [d.project, ...p]);
      hapticNotify("success");
    } catch (e: any) {
      setError(e.message);
      hapticNotify("error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Header title="Проекты" accent={`${projects.length}`} subtitle="активных" />
      <div className="pb-24 space-y-3" style={{ paddingLeft: 22, paddingRight: 22 }}>

        {tgId && (
          <div className="glass rounded-xl p-2.5 flex gap-2 items-center">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Название проекта"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted px-2"
              style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 300, caretColor: "#F0A020" }}
              onKeyDown={(e) => e.key === "Enter" && createProject()}
            />
            <button
              onClick={createProject}
              disabled={!newTitle.trim() || creating}
              className="text-sm px-3 py-1.5 rounded-md font-medium disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #F0A020, #D05020)", color: "#0A0705" }}
            >
              +
            </button>
          </div>
        )}

        {!tgId && !loading && (
          <p className="text-sm text-muted py-8 text-center">
            открой через Telegram, чтобы видеть свои проекты
          </p>
        )}

        {loading && <p className="text-sm text-muted py-8 text-center">загрузка…</p>}

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        {!loading && tgId && projects.length === 0 && !error && (
          <p className="text-sm text-muted py-8 text-center">
            пока пусто — создай первый проект
          </p>
        )}

        {projects.map((p) => {
          const s = STATUS_LABEL[p.status] ?? STATUS_LABEL.in_progress;
          return (
            <div key={p.id} className="glass rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-semibold flex-1">{p.title}</h3>
                <span className={`text-[15px] px-2 py-1 rounded-full ${s.color} shrink-0`}>{s.text}</span>
              </div>
              <div className="flex items-center gap-1 mb-3">
                {p.agents.map((id) => {
                  const a = getAgent(id as any);
                  return a ? (
                    <div key={id} title={a.name} className="w-7 h-7 rounded-full overflow-hidden border border-white/10 -ml-1 first:ml-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                    </div>
                  ) : null;
                })}
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full transition-all" style={{ width: `${p.progress}%`, background: "linear-gradient(90deg, #F0A020, #D05020)" }} />
              </div>
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{p.progress}% • {new Date(p.created_at).toLocaleDateString("ru-RU")}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
