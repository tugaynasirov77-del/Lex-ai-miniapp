"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../../../components/Header";
import { tgFetch, hapticImpact, hapticNotify } from "../../../lib/telegram";
import type { ProjectRow, ProjectBudgetRow, ProjectAgentRow, ProjectAgentRole } from "../../../lib/supabase";

const ROLE_LABEL: Record<ProjectAgentRole, { name: string; emoji: string; desc: string }> = {
  analyst: { name: "Аналитик", emoji: "📊", desc: "Статистика и рост канала, отчёты" },
  scout: { name: "Разведчик", emoji: "🔍", desc: "Конкуренты, тренды, темы" },
  writer: { name: "Контентщик", emoji: "✍️", desc: "Черновики постов по трендам" },
  editor: { name: "Редактор", emoji: "🪄", desc: "Грамотность, тон, заголовки" },
  strategist: { name: "Стратег", emoji: "🧭", desc: "План контента на неделю" },
  community: { name: "Комьюнити", emoji: "💬", desc: "Ответы на комменты" },
};

const STATUS_DOT: Record<ProjectAgentRow["status"], string> = {
  pending: "#6b6055",
  active: "#22d3a5",
  paused: "#f59e0b",
};

const STATUS_LABEL: Record<ProjectAgentRow["status"], string> = {
  pending: "скоро",
  active: "работает",
  paused: "пауза",
};

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<ProjectRow | null>(null);
  const [budget, setBudget] = useState<ProjectBudgetRow | null>(null);
  const [agents, setAgents] = useState<ProjectAgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [channelInput, setChannelInput] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await tgFetch(`/api/projects/${id}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "не удалось загрузить");
      setProject(d.project);
      setBudget(d.budget);
      setAgents(d.agents ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const attach = async () => {
    if (!channelInput.trim()) return;
    hapticImpact("medium");
    setAttaching(true);
    setHint(null);
    setError(null);
    try {
      const r = await tgFetch(`/api/projects/${id}/attach-channel`, {
        method: "POST",
        body: JSON.stringify({ channel: channelInput.trim() }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.error === "bot_not_admin" || d.error === "bot_not_in_channel") {
          setHint(d.message);
          hapticNotify("warning");
        } else {
          throw new Error(d.message || d.error || "не удалось привязать");
        }
        return;
      }
      hapticNotify("success");
      setChannelInput("");
      await load();
    } catch (e: any) {
      setError(e.message);
      hapticNotify("error");
    } finally {
      setAttaching(false);
    }
  };

  const channelAttached = project?.channel_username;
  const spent = budget?.spent_usd_current_month ?? 0;
  const cap = budget?.monthly_cap_usd ?? 1;
  const spentPct = Math.min(100, (spent / cap) * 100);

  return (
    <>
      <Header title={project?.title ?? "Проект"} subtitle={channelAttached ? `@${channelAttached}` : "без канала"} />
      <div className="pb-24 space-y-4" style={{ paddingLeft: 22, paddingRight: 22 }}>
        {loading && <p className="text-sm text-muted py-8 text-center">загрузка…</p>}

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>
        )}

        {!loading && project && !channelAttached && (
          <div className="glass rounded-xl p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-base mb-1">Привяжи канал</h3>
              <p className="text-xs text-muted leading-relaxed">
                Введи @username канала или ссылку. После этого подключится команда из 6 агентов и начнёт автоматизацию.
              </p>
            </div>
            <input
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              placeholder="@my_channel или t.me/my_channel"
              className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted"
              style={{ fontFamily: "'DM Sans', sans-serif", caretColor: "#F0A020" }}
              onKeyDown={(e) => e.key === "Enter" && attach()}
            />
            <button
              onClick={attach}
              disabled={!channelInput.trim() || attaching}
              className="w-full text-sm px-4 py-2.5 rounded-lg font-medium disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #F0A020, #D05020)", color: "#0A0705" }}
            >
              {attaching ? "проверяю…" : "Привязать"}
            </button>
            {hint && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 leading-relaxed">
                {hint}
                <button onClick={attach} className="ml-2 underline">проверить ещё раз</button>
              </div>
            )}
          </div>
        )}

        {!loading && channelAttached && (
          <>
            <div className="glass rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="font-semibold">{project!.channel_title}</h3>
                  <a
                    href={`https://t.me/${project!.channel_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-amber underline"
                  >
                    @{project!.channel_username}
                  </a>
                </div>
                <div className="text-right">
                  <div className="text-base font-semibold">
                    {(project!.channel_subscribers ?? 0).toLocaleString("ru-RU")}
                  </div>
                  <div className="text-[10px] text-muted uppercase tracking-wider">подписчиков</div>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Бюджет на месяц</h4>
                <span className="text-xs text-muted">
                  ${spent.toFixed(4)} / ${cap.toFixed(2)}
                </span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${spentPct}%`,
                    background: spentPct >= 90 ? "#ef4444" : "linear-gradient(90deg, #F0A020, #D05020)",
                  }}
                />
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                Автостоп при превышении. Резерв на 45 постов, ежедневную разведку, недельный AI-отчёт, A/B заголовки.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm px-1">Команда на канале</h4>
              {agents.map((a) => {
                const meta = ROLE_LABEL[a.role];
                return (
                  <div key={a.id} className="glass rounded-xl p-3 flex items-center gap-3">
                    <div className="text-2xl">{meta.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{meta.name}</span>
                        <span className="flex items-center gap-1 text-[10px] text-muted">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_DOT[a.status] }} />
                          {STATUS_LABEL[a.status]}
                        </span>
                      </div>
                      <div className="text-xs text-muted truncate">{meta.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <button
          onClick={() => router.back()}
          className="w-full text-xs text-muted py-3"
        >
          ← назад
        </button>
      </div>
    </>
  );
}
