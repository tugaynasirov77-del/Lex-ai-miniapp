type Tone = "purple" | "green" | "orange" | "pink" | "blue";

const TONE: Record<Tone, { bar: string; text: string; ring: string }> = {
  purple: { bar: "bg-accent", text: "text-accent", ring: "ring-accent/30" },
  green: { bar: "bg-success", text: "text-success", ring: "ring-success/30" },
  orange: { bar: "bg-warn", text: "text-warn", ring: "ring-warn/30" },
  pink: { bar: "bg-pink-500", text: "text-pink-400", ring: "ring-pink-500/30" },
  blue: { bar: "bg-sky-400", text: "text-sky-300", ring: "ring-sky-500/30" },
};

interface Props {
  number: number;
  title: string;
  tone: Tone;
  badge?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
}

export default function Section({ number, title, tone, badge, right, children, delay = 0 }: Props) {
  const t = TONE[tone];
  return (
    <section className="px-4 mt-4 animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="glass rounded-2xl p-4 ring-1 ring-inset ring-white/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className={`w-1 h-4 rounded-full ${t.bar}`} />
            <span className={`text-[12px] font-bold tracking-wider uppercase ${t.text}`}>
              {number}. {title}
            </span>
            {badge != null && (
              <span className={`text-[11px] font-bold ${t.text} bg-white/5 border border-white/10 rounded-full px-2 py-0.5 tnum`}>{badge}</span>
            )}
          </div>
          {right}
        </div>
        {children}
      </div>
    </section>
  );
}
