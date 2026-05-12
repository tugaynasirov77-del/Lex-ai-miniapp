type Tone = "sky" | "emerald" | "amber" | "indigo" | "red" | "purple" | "blue" | "green" | "orange" | "pink";

const COLOR: Record<Tone, string> = {
  sky: "#0EA5E9", emerald: "#10B981", amber: "#F59E0B", indigo: "#6366F1", red: "#EF4444",
  // legacy aliases mapped onto the light palette
  purple: "#0EA5E9", blue: "#10B981", green: "#F59E0B", orange: "#6366F1", pink: "#EF4444",
};

interface Props {
  tone: Tone;
  caption?: string;
  badge?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
  /** kept for back-compat; ignored when caption is provided directly */
  number?: number;
  title?: string;
}

export default function Section({ tone, caption, badge, right, children, delay = 0, number, title }: Props) {
  const color = COLOR[tone];
  const labelText = caption ?? (title ? (number != null ? `${number}. ${title}` : title) : undefined);
  return (
    <section className="px-4 mt-4 animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="card p-4 relative overflow-hidden">
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: color }} />
        {(labelText || right) && (
          <div className="flex items-center justify-between mb-3">
            {labelText && (
              <div className="flex items-center gap-2">
                <span className="caption" style={{ color }}>{labelText}</span>
                {badge != null && (
                  <span className="text-[11px] font-bold tnum rounded-full px-2 py-0.5" style={{ color, background: `${color}1A` }}>{badge}</span>
                )}
              </div>
            )}
            {right}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
