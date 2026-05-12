const TILES = [
  { value: "47", label: "задач", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.25)", text: "linear-gradient(90deg, #3B82F6, #6366F1)" },
  { value: "98%", label: "качество", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)", text: "linear-gradient(90deg, #10B981, #3B82F6)" },
  { value: "12", label: "проектов", bg: "rgba(99,102,241,0.08)", border: "rgba(99,102,241,0.25)", text: "linear-gradient(90deg, #6366F1, #8B5CF6)" },
];

export default function MetricsRow() {
  return (
    <section className="px-4 mt-6 animate-fade-up" style={{ animationDelay: "320ms" }}>
      <div className="grid grid-cols-3 gap-2.5">
        {TILES.map((t) => (
          <div key={t.label} className="rounded-2xl p-3"
            style={{ background: t.bg, border: `1px solid ${t.border}` }}>
            <p className="text-[28px] font-bold tnum leading-none grad-text" style={{ backgroundImage: t.text }}>{t.value}</p>
            <p className="text-[11px] text-muted mt-1.5 leading-tight">{t.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
