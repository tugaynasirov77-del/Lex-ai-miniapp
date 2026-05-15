"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../../../components/Header";
import { tgFetch, hapticImpact, hapticNotify } from "../../../lib/telegram";
import type { ProjectRow, ProjectBudgetRow, ProjectAgentRow, ProjectAgentRole } from "../../../lib/supabase";

type AnalyticsBlock = {
  snapshots: { subscribers: number; snapshot_at: string }[];
  latest_subscribers: number;
  growth_abs: number;
  growth_pct: number;
  top_posts: { message_id: number; text: string | null; views: number | null; published_at: string | null }[];
};

type PlanItem = { day: string; topic: string; hook: string; why: string; type: string };
type Plan = { id: string; week_start: string; items: PlanItem[]; summary: string | null; created_at: string; cost_usd: number };

type Draft = {
  id: string;
  title_variants: string[];
  body: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  cost_usd: number;
};

type ScoutSuggestion = {
  username: string;
  title: string | null;
  description: string | null;
  subscribers: number | null;
  relevance_score: number;
  reason: string | null;
};

type Competitor = {
  id: string;
  username: string;
  title: string | null;
  subscribers: number | null;
  posts_count: number;
  top_post_message_id: number | null;
  top_post_views: number | null;
  top_post_text: string | null;
  last_synced_at: string | null;
};

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
  const [analytics, setAnalytics] = useState<AnalyticsBlock | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [suggestions, setSuggestions] = useState<ScoutSuggestion[]>([]);
  const [scouting, setScouting] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [generating, setGenerating] = useState(false);
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planGenerating, setPlanGenerating] = useState(false);
  const [competitorInput, setCompetitorInput] = useState("");
  const [addingComp, setAddingComp] = useState(false);
  const [compError, setCompError] = useState<string | null>(null);
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
      setAnalytics(d.analytics ?? null);
      setCompetitors(d.competitors ?? []);
      setSuggestions(d.suggestions ?? []);
      setDrafts(d.drafts ?? []);
      setPlan(d.plan ?? null);
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

  const generatePlan = async () => {
    hapticImpact("medium");
    setPlanGenerating(true);
    try {
      const r = await tgFetch(`/api/projects/${id}/plan`, { method: "POST" });
      const d = await r.json();
      if (!r.ok || d.skipped) {
        hapticNotify("warning");
        if (d.skipped) setError(d.skipped);
        else setError(d.error || "не удалось");
        return;
      }
      hapticNotify("success");
      await load();
    } catch (e: any) {
      setError(e.message);
      hapticNotify("error");
    } finally {
      setPlanGenerating(false);
    }
  };

  const generateDraft = async () => {
    hapticImpact("medium");
    setGenerating(true);
    try {
      const r = await tgFetch(`/api/projects/${id}/drafts`, { method: "POST" });
      const d = await r.json();
      if (!r.ok || d.skipped) {
        hapticNotify("warning");
        if (d.skipped) setError(d.skipped);
        else setError(d.error || "не удалось");
        return;
      }
      hapticNotify("success");
      await load();
    } catch (e: any) {
      setError(e.message);
      hapticNotify("error");
    } finally {
      setGenerating(false);
    }
  };

  const decideDraft = async (draftId: string, status: "approved" | "rejected") => {
    hapticImpact(status === "approved" ? "medium" : "light");
    setDrafts((arr) => arr.filter((d) => d.id !== draftId));
    setExpandedDraft(null);
    try {
      await tgFetch(`/api/projects/${id}/drafts`, {
        method: "PATCH",
        body: JSON.stringify({ draft_id: draftId, status }),
      });
      hapticNotify("success");
    } catch {
      hapticNotify("error");
      await load();
    }
  };

  const runScout = async () => {
    hapticImpact("medium");
    setScouting(true);
    setError(null);
    try {
      const r = await tgFetch(`/api/projects/${id}/suggestions`, { method: "POST" });
      const d = await r.json();
      if (!r.ok || d.skipped) {
        hapticNotify("warning");
        if (d.skipped) setError(d.skipped);
        else setError(d.error || "не удалось");
        return;
      }
      hapticNotify("success");
      await load();
    } catch (e: any) {
      setError(e.message);
      hapticNotify("error");
    } finally {
      setScouting(false);
    }
  };

  const acceptSuggestion = async (username: string) => {
    hapticImpact("medium");
    setSuggestions((arr) => arr.filter((s) => s.username !== username));
    try {
      const r = await tgFetch(`/api/projects/${id}/suggestions`, {
        method: "PATCH",
        body: JSON.stringify({ username, action: "add" }),
      });
      const d = await r.json();
      if (r.ok && d.competitor) {
        setCompetitors((arr) =>
          [d.competitor, ...arr.filter((c) => c.username !== d.competitor.username)].sort(
            (a, b) => (b.subscribers ?? 0) - (a.subscribers ?? 0)
          )
        );
        hapticNotify("success");
      }
    } catch {
      hapticNotify("error");
      await load();
    }
  };

  const dismissSuggestion = async (username: string) => {
    hapticImpact("light");
    setSuggestions((arr) => arr.filter((s) => s.username !== username));
    try {
      await tgFetch(`/api/projects/${id}/suggestions`, {
        method: "PATCH",
        body: JSON.stringify({ username, action: "dismiss" }),
      });
    } catch {
      await load();
    }
  };

  const addCompetitor = async () => {
    if (!competitorInput.trim()) return;
    hapticImpact("medium");
    setAddingComp(true);
    setCompError(null);
    try {
      const r = await tgFetch(`/api/projects/${id}/competitors`, {
        method: "POST",
        body: JSON.stringify({ username: competitorInput.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "не получилось");
      hapticNotify("success");
      setCompetitorInput("");
      setCompetitors((arr) => {
        const filtered = arr.filter((c) => c.username !== d.competitor.username);
        return [d.competitor, ...filtered].sort((a, b) => (b.subscribers ?? 0) - (a.subscribers ?? 0));
      });
    } catch (e: any) {
      setCompError(e.message);
      hapticNotify("error");
    } finally {
      setAddingComp(false);
    }
  };

  const removeCompetitor = async (username: string) => {
    hapticImpact("light");
    try {
      await tgFetch(`/api/projects/${id}/competitors?username=${encodeURIComponent(username)}`, { method: "DELETE" });
      setCompetitors((arr) => arr.filter((c) => c.username !== username));
      hapticNotify("success");
    } catch {
      hapticNotify("error");
    }
  };

  const remove = async () => {
    if (!project) return;
    const ok = typeof window !== "undefined" && window.confirm(`Удалить проект «${project.title}»? Это действие не вернуть.`);
    if (!ok) return;
    hapticImpact("heavy");
    try {
      const r = await tgFetch(`/api/projects?id=${project.id}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "не удалось удалить");
      hapticNotify("success");
      router.push("/projects");
    } catch (e: any) {
      setError(e.message);
      hapticNotify("error");
    }
  };

  return (
    <>
      <div style={{ paddingTop: 16, paddingLeft: 22, paddingRight: 22, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={() => { hapticImpact("light"); router.back(); }}
          className="flex items-center gap-1 text-sm text-amber"
          style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          назад
        </button>
        {project && (
          <button
            onClick={remove}
            className="flex items-center gap-1 text-sm text-rose-400"
            style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}
            aria-label="Удалить проект"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>
            удалить
          </button>
        )}
      </div>
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

            {analytics && (
              <div className="glass rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">📊 Аналитика</h4>
                  <span className="text-[10px] text-muted uppercase tracking-wider">за 7 дней</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-muted uppercase tracking-wider mb-1">Подписчики</div>
                    <div className="text-xl font-semibold">{analytics.latest_subscribers.toLocaleString("ru-RU")}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted uppercase tracking-wider mb-1">Прирост</div>
                    <div
                      className="text-xl font-semibold"
                      style={{ color: analytics.growth_abs >= 0 ? "#22d3a5" : "#ef4444" }}
                    >
                      {analytics.growth_abs >= 0 ? "+" : ""}
                      {analytics.growth_abs.toLocaleString("ru-RU")}
                      <span className="text-xs text-muted ml-1">
                        ({analytics.growth_pct >= 0 ? "+" : ""}
                        {analytics.growth_pct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>

                {analytics.snapshots.length > 1 && (
                  <div className="flex items-end gap-0.5 h-8 mt-1">
                    {(() => {
                      const xs = analytics.snapshots.map((s) => s.subscribers);
                      const min = Math.min(...xs);
                      const max = Math.max(...xs);
                      const range = Math.max(1, max - min);
                      return xs.map((v, i) => {
                        const h = ((v - min) / range) * 100;
                        return (
                          <div
                            key={i}
                            style={{
                              flex: 1,
                              height: `${Math.max(8, h)}%`,
                              background: "linear-gradient(180deg, #F0A020, #D05020)",
                              borderRadius: 2,
                              opacity: 0.6 + (i / xs.length) * 0.4,
                            }}
                          />
                        );
                      });
                    })()}
                  </div>
                )}

                {analytics.top_posts.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] text-muted uppercase tracking-wider">Топ постов</div>
                    {analytics.top_posts.map((post) => {
                      const preview = (post.text || "(без текста)").replace(/\n+/g, " ").slice(0, 70);
                      return (
                        <a
                          key={post.message_id}
                          href={`https://t.me/${project!.channel_username}/${post.message_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-3 text-xs py-1.5 px-2 -mx-2 rounded-md hover:bg-white/5 active:bg-white/10"
                        >
                          <span className="truncate flex-1 text-ink/90">{preview}</span>
                          <span className="text-amber shrink-0 text-[11px]">👁 {(post.views ?? 0).toLocaleString("ru-RU")}</span>
                        </a>
                      );
                    })}
                  </div>
                )}

                {analytics.snapshots.length === 0 && (
                  <p className="text-xs text-muted leading-relaxed">
                    Аналитик подключён, первая сводка появится в течение суток (cron в 7:00 МСК).
                  </p>
                )}
              </div>
            )}

            <div className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">🔍 Конкуренты</h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={runScout}
                    disabled={scouting}
                    className="text-[11px] px-2 py-1 rounded-md font-medium disabled:opacity-40"
                    style={{ background: "rgba(240, 160, 32, 0.15)", color: "#F0A020" }}
                  >
                    {scouting ? "ищу…" : "🤖 разведка"}
                  </button>
                  <span className="text-[10px] text-muted uppercase tracking-wider">{competitors.length}</span>
                </div>
              </div>

              {suggestions.length > 0 && (
                <div className="rounded-lg border border-amber/30 bg-amber/5 p-3 space-y-2">
                  <div className="text-[11px] text-amber font-medium">Скаут нашёл {suggestions.length} канал{suggestions.length === 1 ? "" : "ов"} по теме:</div>
                  {suggestions.map((s) => (
                    <div key={s.username} className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <a
                            href={`https://t.me/${s.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-ink hover:text-amber"
                          >
                            {s.title || `@${s.username}`}
                          </a>
                          <div className="text-[10px] text-muted">@{s.username} • {(s.subscribers ?? 0).toLocaleString("ru-RU")} подп. • балл {s.relevance_score}/10</div>
                        </div>
                      </div>
                      {s.reason && <div className="text-[11px] text-muted/80 italic leading-snug">{s.reason}</div>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => acceptSuggestion(s.username)}
                          className="flex-1 text-[11px] py-1 rounded-md font-medium"
                          style={{ background: "rgba(34, 211, 165, 0.15)", color: "#22d3a5" }}
                        >
                          + добавить
                        </button>
                        <button
                          onClick={() => dismissSuggestion(s.username)}
                          className="text-[11px] py-1 px-3 rounded-md font-medium"
                          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={competitorInput}
                  onChange={(e) => setCompetitorInput(e.target.value)}
                  placeholder="@конкурент или t.me/..."
                  className="flex-1 bg-white/5 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted"
                  style={{ fontFamily: "'DM Sans', sans-serif", caretColor: "#F0A020" }}
                  onKeyDown={(e) => e.key === "Enter" && addCompetitor()}
                />
                <button
                  onClick={addCompetitor}
                  disabled={!competitorInput.trim() || addingComp}
                  className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #F0A020, #D05020)", color: "#0A0705" }}
                >
                  {addingComp ? "..." : "+"}
                </button>
              </div>
              {compError && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">{compError}</div>
              )}
              {competitors.length === 0 && !compError && (
                <p className="text-xs text-muted leading-relaxed">
                  Добавь канал-конкурента — будем следить за его ростом и топ-постами вместе с твоим.
                </p>
              )}
              {competitors.map((c) => {
                const mine = analytics?.latest_subscribers ?? 0;
                const diff = (c.subscribers ?? 0) - mine;
                return (
                  <div key={c.id} className="border-t border-white/5 pt-3 space-y-1.5 first:border-t-0 first:pt-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <a
                          href={`https://t.me/${c.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-sm text-ink hover:text-amber truncate block"
                        >
                          {c.title || `@${c.username}`}
                        </a>
                        <div className="text-[11px] text-muted">@{c.username}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base font-semibold">{(c.subscribers ?? 0).toLocaleString("ru-RU")}</div>
                        {mine > 0 && (
                          <div
                            className="text-[10px]"
                            style={{ color: diff > 0 ? "#ef4444" : "#22d3a5" }}
                          >
                            {diff > 0 ? "+" : ""}
                            {diff.toLocaleString("ru-RU")} к тебе
                          </div>
                        )}
                      </div>
                    </div>
                    {c.top_post_text && c.top_post_message_id && (
                      <a
                        href={`https://t.me/${c.username}/${c.top_post_message_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 text-[11px] py-1 px-2 rounded-md bg-white/[0.03] hover:bg-white/[0.06]"
                      >
                        <span className="truncate flex-1 text-ink/75">
                          ↑ {c.top_post_text.replace(/\n+/g, " ").slice(0, 60)}
                        </span>
                        <span className="text-amber shrink-0">👁 {(c.top_post_views ?? 0).toLocaleString("ru-RU")}</span>
                      </a>
                    )}
                    <button
                      onClick={() => removeCompetitor(c.username)}
                      className="text-[10px] text-rose-400/70 hover:text-rose-400"
                    >
                      убрать
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">✍️ Черновики</h4>
                <button
                  onClick={generateDraft}
                  disabled={generating}
                  className="text-xs px-3 py-1.5 rounded-md font-medium disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #F0A020, #D05020)", color: "#0A0705" }}
                >
                  {generating ? "генерю…" : "+ сгенерить"}
                </button>
              </div>
              {drafts.length === 0 && (
                <p className="text-xs text-muted leading-relaxed">
                  Контентщик создаст черновик автоматически (или нажми «сгенерить»). Sonnet 4.6 + Редактор Haiku 4.5, 3 A/B заголовка.
                </p>
              )}
              {drafts.map((draft) => {
                const isExpanded = expandedDraft === draft.id;
                return (
                  <div key={draft.id} className="border-t border-white/5 pt-3 first:border-t-0 first:pt-0">
                    <button
                      onClick={() => { hapticImpact("light"); setExpandedDraft(isExpanded ? null : draft.id); }}
                      className="w-full text-left"
                    >
                      <div className="text-sm font-medium mb-1">{draft.title_variants[0] ?? "(без заголовка)"}</div>
                      <div className="text-xs text-muted line-clamp-2">{draft.body.slice(0, 120)}{draft.body.length > 120 ? "…" : ""}</div>
                    </button>
                    {isExpanded && (
                      <div className="mt-3 space-y-2.5 pl-1">
                        <div>
                          <div className="text-[10px] text-muted uppercase tracking-wider mb-1">3 варианта заголовка</div>
                          <div className="space-y-1">
                            {draft.title_variants.map((t, i) => (
                              <div key={i} className="text-xs text-ink/90 flex gap-2">
                                <span className="text-amber">{i + 1}.</span>
                                <span className="flex-1">{t}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted uppercase tracking-wider mb-1">Текст</div>
                          <div className="text-xs whitespace-pre-wrap text-ink/90 leading-relaxed bg-white/[0.03] rounded-md p-2.5">
                            {draft.body}
                          </div>
                        </div>
                        <div className="text-[10px] text-muted">
                          цена генерации: ${Number(draft.cost_usd).toFixed(4)}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => decideDraft(draft.id, "approved")}
                            className="flex-1 text-xs py-2 rounded-md font-medium"
                            style={{ background: "rgba(34, 211, 165, 0.15)", color: "#22d3a5" }}
                          >
                            ✓ одобрить
                          </button>
                          <button
                            onClick={() => decideDraft(draft.id, "rejected")}
                            className="flex-1 text-xs py-2 rounded-md font-medium"
                            style={{ background: "rgba(239, 68, 68, 0.12)", color: "#ef4444" }}
                          >
                            ✕ отклонить
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">🧭 План на неделю</h4>
                <button
                  onClick={generatePlan}
                  disabled={planGenerating}
                  className="text-xs px-3 py-1.5 rounded-md font-medium disabled:opacity-40"
                  style={{ background: plan ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, #F0A020, #D05020)", color: plan ? "#F5EDD8" : "#0A0705" }}
                >
                  {planGenerating ? "думаю…" : plan ? "обновить" : "+ построить"}
                </button>
              </div>
              {!plan && (
                <p className="text-xs text-muted leading-relaxed">
                  Стратег предложит 7 тем на следующую неделю, основываясь на твоих топ-постах и конкурентах. По воскресеньям обновляется автоматически.
                </p>
              )}
              {plan && (
                <>
                  {plan.summary && (
                    <div className="text-xs text-ink/80 leading-relaxed bg-white/[0.03] rounded-md p-2.5 border-l-2 border-amber/50">
                      {plan.summary}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {plan.items.map((it, i) => (
                      <div key={i} className="flex gap-2 items-start text-xs">
                        <span className="text-amber font-medium uppercase shrink-0 w-7 pt-0.5">{it.day}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-ink/90">{it.topic}</div>
                          <div className="text-muted line-clamp-1">{it.hook}</div>
                          {it.why && <div className="text-[10px] text-muted/70 italic mt-0.5">{it.why}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-muted">
                    неделя с {new Date(plan.week_start).toLocaleDateString("ru-RU")} • $ {Number(plan.cost_usd).toFixed(4)}
                  </div>
                </>
              )}
            </div>

            <div className="glass rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">💬 Комьюнити</h4>
                <span className="text-[10px] text-muted">ожидает чат</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Привяжи к каналу обсуждение (Settings → Discussion). Когда чат подключён и @Lex_app_bot в нём админ — Комьюнити начнёт готовить черновики ответов на комментарии.
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

      </div>
    </>
  );
}
