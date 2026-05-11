import { PROJECTS, getAgent } from "../lib/mockData";
import SectionLabel from "./SectionLabel";

const STATUS: Record<string, { text: string; cls: string }> = {
  in_progress: { text: "В работе", cls: "bg-accent/15 text-accent" },
  done: { text: "Завершён", cls: "bg-success/15 text-success" },
  paused: { text: "Пауза", cls: "bg-warn/15 text-warn" },
};

const PROJECT_ICONS: Record<string, string> = {
  p1: "🚀", p2: "🌐", p3: "📈", p4: "📅", p5: "⚙️",
};

export default function RecentProjects() {
  const recent = PROJECTS.slice(0, 3);
  return (
    <section className="mt-8 animate-fade-up" style={{ animationDelay: "260ms" }}>
      <SectionLabel href="/projects">Последние проекты</SectionLabel>
      <div className="px-5 space-y-2">
        {recent.map((p) => {
          const s = STATUS[p.status];
          const icon = PROJECT_ICONS[p.id] ?? "📁";
          const extra = p.agents.length - 3;
          return (
            <div key={p.id} className="glass glass-hover rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center text-lg shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[15px] font-semibold leading-snug">{p.title}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${s.cls}`}>{s.text}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex -space-x-2">
                      {p.agents.slice(0, 3).map((id) => {
                        const a = getAgent(id);
                        if (!a) return null;
                        return (
                          <div key={id} className="w-6 h-6 rounded-full overflow-hidden ring-2 ring-bg bg-surface">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                          </div>
                        );
                      })}
                      {extra > 0 && (
                        <div className="w-6 h-6 rounded-full ring-2 ring-bg bg-surface flex items-center justify-center text-[10px] font-semibold text-muted">+{extra}</div>
                      )}
                    </div>
                    <span className="text-[11px] text-muted tnum">{p.createdAt}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
