import Header from "../components/Header";
import { AGENTS } from "../lib/mockData";

export default function TeamPage() {
  return (
    <>
      <Header title="Команда" subtitle={`${AGENTS.length} AI-агентов на связи`} />
      <div className="px-4 space-y-3">
        {AGENTS.map((a) => (
          <div key={a.id} className="bg-card rounded-2xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-bg flex items-center justify-center text-2xl shrink-0">
              {a.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{a.name}</h3>
                <span className="text-xs">{a.status === "online" ? "🟢" : "🔴"}</span>
              </div>
              <p className="text-xs text-muted truncate">{a.role}</p>
              <p className="text-[11px] text-muted mt-0.5">{a.lastActive}</p>
            </div>
            <a
              href={`https://t.me/${a.botUsername}`}
              target="_blank"
              rel="noreferrer"
              className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-xl active:opacity-80 transition-opacity shrink-0"
            >
              Написать
            </a>
          </div>
        ))}
      </div>
    </>
  );
}
