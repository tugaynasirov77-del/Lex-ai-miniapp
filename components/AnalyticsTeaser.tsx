import Section from "./Section";

const STATS = [
  {
    value: "47", label: "задач",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    value: "3", label: "проекта",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 7c0-1.1.9-2 2-2h4l2 2h8c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    value: "98%", label: "качество",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function AnalyticsTeaser() {
  return (
    <Section number={5} title="Аналитика" tone="pink" delay={320}>
      <div className="grid grid-cols-3 gap-2">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-2xl border border-pink-500/15 bg-pink-500/[0.04] p-3 flex flex-col items-start">
            <div className="w-9 h-9 rounded-xl bg-pink-500/15 border border-pink-500/25 text-pink-400 flex items-center justify-center shadow-[0_0_14px_rgba(236,72,153,0.25)]">
              {s.icon}
            </div>
            <div className="mt-3">
              <p className="text-[22px] font-bold tnum leading-none">{s.value}</p>
              <p className="text-[11px] text-muted mt-1">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
