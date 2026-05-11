import Header from "../../components/Header";
import { PROJECTS, getAgent } from "../../lib/mockData";

const STATUS_LABEL = {
  in_progress: { text: "В работе", color: "bg-accent/20 text-accent" },
  done: { text: "Завершён", color: "bg-emerald-500/20 text-emerald-400" },
  paused: { text: "На паузе", color: "bg-amber-500/20 text-amber-400" },
};

export default function ProjectsPage() {
  return (
    <>
      <Header title="Проекты" subtitle={`${PROJECTS.length} активных`} />
      <div className="px-4 space-y-3">
        {PROJECTS.map((p) => {
          const s = STATUS_LABEL[p.status];
          return (
            <div key={p.id} className="bg-card rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-semibold flex-1">{p.title}</h3>
                <span className={`text-[11px] px-2 py-1 rounded-full ${s.color} shrink-0`}>{s.text}</span>
              </div>
              <div className="flex items-center gap-1 mb-3">
                {p.agents.map((id) => {
                  const a = getAgent(id);
                  return a ? (
                    <span key={id} title={a.name} className="text-lg">{a.emoji}</span>
                  ) : null;
                })}
              </div>
              <div className="h-1.5 bg-bg rounded-full overflow-hidden mb-2">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${p.progress}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{p.progress}% • с {p.createdAt}</span>
                <button className="text-accent font-medium">Открыть →</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
