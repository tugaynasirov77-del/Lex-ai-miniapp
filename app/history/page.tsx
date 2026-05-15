"use client";

import { useEffect, useState } from "react";
import Header from "../../components/Header";
import {
  loadRecent,
  setFeedback,
  formatAgo,
  type RecentTaskEntry,
  type Feedback,
} from "../../lib/recentTasks";
import { getAgent } from "../../lib/mockData";

export default function HistoryPage() {
  const [list, setList] = useState<RecentTaskEntry[]>([]);

  useEffect(() => {
    setList(loadRecent());
  }, []);

  const onFeedback = (id: string, fb: Feedback) => {
    const current = list.find((t) => t.id === id)?.feedback ?? null;
    const next = current === fb ? null : fb;
    setList(setFeedback(id, next));
  };

  return (
    <>
      <Header title="История задач" subtitle={`${list.length} записей`} />
      <div className="px-4 space-y-2 pb-24">
        {list.length === 0 && (
          <p className="text-sm text-muted py-8 text-center">
            пока пусто — отправь первую задачу на главной
          </p>
        )}
        {list.map((t) => {
          const a = getAgent(t.agentId);
          return (
            <div key={t.id} className="glass rounded-2xl p-3 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-bg border border-white/10">
                {a ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl">🤖</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{t.agentName}</span>
                  <span className="text-[11px] text-muted shrink-0">{formatAgo(t.createdAt)}</span>
                </div>
                <p className="text-sm text-muted mt-0.5 line-clamp-2">{t.title}</p>
                {t.reply && (
                  <p className="text-[12px] text-muted/70 mt-1 line-clamp-3 whitespace-pre-wrap">
                    {t.reply}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => onFeedback(t.id, "up")}
                    className={`text-[14px] px-2 py-0.5 rounded-md transition ${
                      t.feedback === "up" ? "bg-emerald-500/20" : "bg-white/5 hover:bg-white/10"
                    }`}
                    aria-label="like"
                  >
                    👍
                  </button>
                  <button
                    onClick={() => onFeedback(t.id, "down")}
                    className={`text-[14px] px-2 py-0.5 rounded-md transition ${
                      t.feedback === "down" ? "bg-rose-500/20" : "bg-white/5 hover:bg-white/10"
                    }`}
                    aria-label="dislike"
                  >
                    👎
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
