import Link from "next/link";
import { PROJECTS, getAgent } from "../lib/mockData";
import Section from "./Section";

const STATUS: Record<string, { text: string; cls: string }> = {
  in_progress: { text: "В процессе", cls: "bg-warn/15 text-warn border-warn/30" },
  done: { text: "Готово", cls: "bg-success/15 text-success border-success/30" },
  paused: { text: "Пауза", cls: "bg-white/5 text-muted border-white/10" },
};

const ICONS: Record<string, { emoji: string; tint: string }> = {
  p1: { emoji: "🚀", tint: "bg-accent/15 border-accent/30" },
  p2: { emoji: "📚", tint: "bg-success/15 border-success/30" },
  p3: { emoji: "📊", tint: "bg-sky-500/15 border-sky-500/30" },
  p4: { emoji: "🌐", tint: "bg-pink-500/15 border-pink-500/30" },
  p5: { emoji: "⚙️", tint: "bg-warn/15 border-warn/30" },
};

function CalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="opacity-60">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

export default function RecentProjects() {
  const recent = PROJECTS.slice(0, 2);
  return (
    <Section
      number={4}
      title="Проекты"
      tone="orange"
      delay={260}
      right={<Link href="/projects" className="text-[12px] font-semibold text-warn">все →</Link>}
    >
      <div className="space-y-3">
        {recent.map((p, idx) => {
          const s = STATUS[p.status];
          const ic = ICONS[p.id] ?? { emoji: "📁", tint: "bg-white/5 border-white/10" };
          const shown = p.agents.slice(0, 3);
          const extra = p.agents.length - shown.length;
          return (
            <div key={p.id} className={idx > 0 ? "pt-3 border-t border-white/5" : ""}>
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-xl shrink-0 ${ic.tint}`}>{ic.emoji}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-semibold leading-snug">{p.title}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-[11px] font-semibold border rounded-full px-2 py-0.5 ${s.cls}`}>● {s.text}</span>
                    <span className="flex items-center gap-1 text-[11px] text-muted"><CalIcon /> {p.createdAt}</span>
                  </div>
                </div>
                <div className="flex -space-x-2 shrink-0 items-center">
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
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
