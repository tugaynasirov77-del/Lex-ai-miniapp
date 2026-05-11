import Link from "next/link";
import { PROJECTS, getAgent } from "../lib/mockData";

const STATUS_DOT: Record<string, string> = {
  in_progress: "bg-accent2",
  done: "bg-emerald-400",
  paused: "bg-amber-400",
};
const STATUS_LABEL: Record<string, string> = {
  in_progress: "В работе",
  done: "Завершён",
  paused: "На паузе",
};

export default function RecentProjects() {
  const recent = PROJECTS.slice(0, 3);
  return (
    <section className="px-4 mt-6 mb-2 animate-fade-up" style={{ animationDelay: "240ms" }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white/90">Последние проекты</h2>
        <Link href="/projects" className="text-[11px] text-accent2 font-medium">все →</Link>
      </div>
      <div className="space-y-2">
        {recent.map((p) => (
          <div key={p.id} className="glass rounded-2xl p-3.5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold flex-1 leading-snug">{p.title}</h3>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[p.status]}`} />
                <span className="text-[10px] text-white/60">{STATUS_LABEL[p.status]}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex -space-x-1.5">
                {p.agents.slice(0, 5).map((id) => {
                  const a = getAgent(id);
                  if (!a) return null;
                  return (
                    <div key={id} className="w-6 h-6 rounded-full bg-bg2 border border-white/10 flex items-center justify-center text-xs">
                      {a.emoji}
                    </div>
                  );
                })}
              </div>
              <span className="text-[11px] text-white/40">{p.createdAt}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
