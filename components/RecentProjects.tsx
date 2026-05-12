import Link from "next/link";
import { PROJECTS, getAgent } from "../lib/mockData";
import Section from "./Section";

const STATUS: Record<string, { text: string; cls: string }> = {
  in_progress: { text: "В процессе", cls: "bg-warn/15 text-warn border-warn/30" },
  done: { text: "Готово", cls: "bg-success/15 text-success border-success/30" },
  paused: { text: "Пауза", cls: "bg-white/5 text-muted border-white/10" },
};

const ICONS: Record<string, { svg: React.ReactNode; bg: string; border: string; text: string }> = {
  p1: {
    bg: "bg-accent/15", border: "border-accent/30", text: "text-accent",
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2c3.5 3 5 6 5 10v4l-2 2h-6l-2-2v-4c0-4 1.5-7 5-10Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
        <circle cx="12" cy="10" r="1.8" fill="currentColor"/>
        <path d="M7 16l-3 3v2h3M17 16l3 3v2h-3" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      </svg>
    ),
  },
  p2: {
    bg: "bg-success/15", border: "border-success/30", text: "text-success",
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 5a2 2 0 0 1 2-2h11v17H6a2 2 0 0 1-2-2V5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M4 18a2 2 0 0 1 2-2h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M8 7h6M8 10h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  p3: {
    bg: "bg-sky-500/15", border: "border-sky-500/30", text: "text-sky-300",
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 19V5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M4 19h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <rect x="7" y="13" width="3" height="4" rx="0.6" fill="currentColor" opacity="0.55"/>
        <rect x="12" y="9" width="3" height="8" rx="0.6" fill="currentColor" opacity="0.8"/>
        <rect x="17" y="6" width="3" height="11" rx="0.6" fill="currentColor"/>
      </svg>
    ),
  },
  p4: {
    bg: "bg-pink-500/15", border: "border-pink-500/30", text: "text-pink-400",
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" stroke="currentColor" strokeWidth="1.6"/>
      </svg>
    ),
  },
  p5: {
    bg: "bg-warn/15", border: "border-warn/30", text: "text-warn",
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.6"/>
      </svg>
    ),
  },
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
          const ic = ICONS[p.id] ?? { svg: <span>📁</span>, bg: "bg-white/5", border: "border-white/10", text: "text-white/70" };
          const shown = p.agents.slice(0, 3);
          const extra = p.agents.length - shown.length;
          return (
            <div key={p.id} className={idx > 0 ? "pt-3 border-t border-white/5" : ""}>
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${ic.bg} ${ic.border} ${ic.text}`}>{ic.svg}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-semibold leading-snug">{p.title}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`whitespace-nowrap text-[11px] font-semibold border rounded-full px-2 py-0.5 ${s.cls}`}>● {s.text}</span>
                    <span className="flex items-center gap-1 text-[11px] text-muted whitespace-nowrap"><CalIcon /> {p.createdAt}</span>
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
