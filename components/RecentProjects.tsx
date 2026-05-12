import { PROJECTS, getAgent } from "../lib/mockData";
import SectionLabel from "./SectionLabel";

const STATUS: Record<string, { text: string; cls: string; dot: string }> = {
  in_progress: { text: "В работе", cls: "bg-accent/15 text-accent border-accent/30", dot: "bg-accent" },
  done: { text: "Завершён", cls: "bg-success/15 text-success border-success/30", dot: "bg-success" },
  paused: { text: "Пауза", cls: "bg-warn/15 text-warn border-warn/30", dot: "bg-warn" },
};

const ICONS: Record<string, { emoji: string; tint: string }> = {
  p1: { emoji: "🚀", tint: "bg-accent/15 border-accent/30" },
  p2: { emoji: "📋", tint: "bg-success/15 border-success/30" },
  p3: { emoji: "📊", tint: "bg-sky-500/15 border-sky-500/30" },
  p4: { emoji: "🌐", tint: "bg-pink-500/15 border-pink-500/30" },
  p5: { emoji: "⚙️", tint: "bg-warn/15 border-warn/30" },
};

export default function RecentProjects() {
  const recent = PROJECTS.slice(0, 3);
  return (
    <section className="mt-8 animate-fade-up" style={{ animationDelay: "260ms" }}>
      <SectionLabel href="/projects">Последние проекты</SectionLabel>
      <div className="px-5 space-y-2">
        {recent.map((p) => {
          const s = STATUS[p.status];
          const ic = ICONS[p.id] ?? { emoji: "📁", tint: "bg-white/5 border-white/10" };
          const shown = p.agents.slice(0, 3);
          const extra = p.agents.length - shown.length;
          return (
            <div key={p.id} className="glass glass-hover rounded-2xl p-3.5 flex items-center gap-3">
              <div className={`w-11 h-11 rounded-full border flex items-center justify-center text-lg shrink-0 ${ic.tint}`}>{ic.emoji}</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-semibold truncate">{p.title}</h3>
                <p className="text-[11px] text-muted mt-0.5">{p.createdAt}</p>
              </div>
              <div className="flex -space-x-2 shrink-0">
                {shown.map((id) => {
                  const a = getAgent(id);
                  if (!a) return null;
                  return (
                    <div key={id} className="w-7 h-7 rounded-full overflow-hidden ring-2 ring-bg bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                    </div>
                  );
                })}
                {extra > 0 && (
                  <div className="w-7 h-7 rounded-full ring-2 ring-bg bg-surface flex items-center justify-center text-[10px] font-semibold text-muted">+{extra}</div>
                )}
              </div>
              <span className={`shrink-0 text-[10px] px-2 py-1 rounded-full font-semibold border flex items-center gap-1 ${s.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {s.text}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
