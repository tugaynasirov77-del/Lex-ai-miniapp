const TILES = [
  { value: "47", label: "задач сегодня", bg: "linear-gradient(135deg, #EFF6FF, #E0F2FE)", text: "linear-gradient(90deg, #0EA5E9, #6366F1)", shadow: "0 8px 24px rgba(14,165,233,0.15)" },
  { value: "98%", label: "качество", bg: "linear-gradient(135deg, #F0FDF4, #DCFCE7)", text: "linear-gradient(90deg, #10B981, #0EA5E9)", shadow: "0 8px 24px rgba(16,185,129,0.15)" },
  { value: "12", label: "проектов", bg: "linear-gradient(135deg, #F5F3FF, #EDE9FE)", text: "linear-gradient(90deg, #8B5CF6, #6366F1)", shadow: "0 8px 24px rgba(139,92,246,0.15)" },
];

export default function MetricsRow() {
  return (
    <section className="px-4 mt-5 animate-fade-up" style={{ animationDelay: "260ms" }}>
      <div className="grid grid-cols-3 gap-2.5">
        {TILES.map((t) => (
          <div key={t.label} className="rounded-2xl p-3"
            style={{ background: t.bg, border: "1px solid rgba(0,0,0,0.04)", boxShadow: t.shadow }}>
            <p className="text-[28px] font-bold tnum leading-none grad-text" style={{ backgroundImage: t.text }}>{t.value}</p>
            <p className="text-[11px] text-muted mt-1.5 leading-tight">{t.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
