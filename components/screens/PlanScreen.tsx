"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getWeekPlan,
  updateDraft,
  peekProjects,
  type WeekPlanDTO,
  type PlanItemDTO,
  type ContentStatus,
} from "../../lib/api";
import { useFlow, useFlowActions } from "../../flow";
import { hapticImpact, hapticNotify } from "../../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const SUB_MUTED = "rgba(255,255,255,0.42)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const OK = "#5BD66B";

type Props = { onBack: () => void };

const TYPE_ICON: Record<string, string> = {
  reel: "🎬",
  carousel: "🖼",
  caption: "✏️",
  idea: "💡",
  post: "📝",
};

// Группы статусов → бейдж
function statusBadge(status: ContentStatus): { label: string; color: string; bg: string } {
  if (status === "published")
    return { label: "Опубликовано", color: OK, bg: "rgba(91,214,107,0.14)" };
  if (["ready_to_shoot", "shot", "ready_to_publish", "scheduled", "approved"].includes(status))
    return { label: "Готово к съёмке", color: YELLOW, bg: "rgba(245,231,10,0.14)" };
  return { label: "Черновик", color: MUTED, bg: "rgba(255,255,255,0.06)" };
}

function todayMonday(): string {
  const d = new Date();
  const msk = new Date(d.getTime() + 3 * 3600 * 1000);
  const day = msk.getUTCDay() || 7;
  const monday = new Date(msk.getTime() - (day - 1) * 86400000);
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, "0")}-${String(monday.getUTCDate()).padStart(2, "0")}`;
}

function shiftWeek(weekStart: string, weeks: number): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + weeks * 7));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function fmtDayNum(date: string): string {
  const [, , d] = date.split("-");
  return String(Number(d));
}

function fmtWeekRange(start: string, end: string): string {
  const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const [, sm, sd] = start.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  return `${Number(sd)} ${months[sm - 1]} — ${Number(ed)} ${months[em - 1]}`;
}

function isToday(date: string): boolean {
  const d = new Date();
  const msk = new Date(d.getTime() + 3 * 3600 * 1000);
  const today = `${msk.getUTCFullYear()}-${String(msk.getUTCMonth() + 1).padStart(2, "0")}-${String(msk.getUTCDate()).padStart(2, "0")}`;
  return date === today;
}

export default function PlanScreen({ onBack: _onBack }: Props) {
  const { state } = useFlow();
  const actions = useFlowActions();
  const projectId = state.projectId
    || peekProjects()?.projects[0]?.id
    || null;

  const [weekStart, setWeekStart] = useState(todayMonday());
  const [plan, setPlan] = useState<WeekPlanDTO | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeItem, setActiveItem] = useState<PlanItemDTO | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await getWeekPlan(projectId, weekStart);
      setPlan(r);
    } catch (e: any) {
      setErr(e?.message || "Не удалось загрузить план");
    } finally {
      setLoading(false);
    }
  }, [projectId, weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus(item: PlanItemDTO, status: ContentStatus) {
    hapticImpact("light");
    try {
      await updateDraft(item.id, { status });
      hapticNotify("success");
      setActiveItem(null);
      void load();
    } catch {
      hapticNotify("error");
    }
  }

  async function removeFromPlan(item: PlanItemDTO) {
    hapticImpact("light");
    try {
      await updateDraft(item.id, { planned_for_date: null });
      hapticNotify("success");
      setActiveItem(null);
      void load();
    } catch {
      hapticNotify("error");
    }
  }

  if (!projectId) {
    return (
      <ScreenWrap>
        <Header title="Контент-план" />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ textAlign: "center", color: MUTED, fontSize: 14, lineHeight: 1.5 }}>
            Сначала создай Instagram-проект —<br />и здесь появится твой план на неделю.
          </div>
        </div>
      </ScreenWrap>
    );
  }

  return (
    <ScreenWrap>
      <Header title="Контент-план" />

      {/* Переключатель недель */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <WeekNavBtn dir="prev" onClick={() => { hapticImpact("light"); setWeekStart(shiftWeek(weekStart, -1)); }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>
            {plan ? fmtWeekRange(plan.week_start, plan.week_end) : "—"}
          </div>
          {weekStart !== todayMonday() && (
            <button
              onClick={() => { hapticImpact("light"); setWeekStart(todayMonday()); }}
              style={{
                appearance: "none", background: "none", border: "none",
                color: YELLOW, fontSize: 11, cursor: "pointer", marginTop: 2, fontFamily: "inherit",
              }}
            >
              ← к текущей неделе
            </button>
          )}
        </div>
        <WeekNavBtn dir="next" onClick={() => { hapticImpact("light"); setWeekStart(shiftWeek(weekStart, 1)); }} />
      </div>

      {err && (
        <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,115,115,0.08)", border: "1px solid rgba(255,115,115,0.30)", fontSize: 12, color: "#FF8B8B", marginBottom: 12 }}>
          {err}
        </div>
      )}

      {/* Сводка недели */}
      {plan && <WeekSummary plan={plan} />}

      {/* Дни */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {plan?.days.map((day) => (
          <DayRow
            key={day.date}
            weekday={day.weekday}
            dayNum={fmtDayNum(day.date)}
            today={isToday(day.date)}
            items={day.items}
            onItemTap={(it) => { hapticImpact("light"); setActiveItem(it); }}
          />
        ))}
        {loading && !plan && (
          <div style={{ textAlign: "center", color: MUTED, fontSize: 13, padding: 20 }}>
            Загружаем план…
          </div>
        )}
      </div>

      {/* Подсказка как добавить */}
      {plan && plan.summary.total === 0 && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 14,
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            textAlign: "center",
            fontSize: 13,
            color: MUTED,
            lineHeight: 1.5,
          }}
        >
          На этой неделе пусто. Разбери Reels → создай сценарий →
          «Добавить в план» — и материал появится здесь.
        </div>
      )}

      {/* Bottom-sheet действий по материалу */}
      {activeItem && (
        <ActionSheet
          item={activeItem}
          onClose={() => setActiveItem(null)}
          onOpen={() => {
            // Открыть материал — пока ведём в проект
            actions.navigate("project");
          }}
          onStatus={changeStatus}
          onRemove={removeFromPlan}
        />
      )}
    </ScreenWrap>
  );
}

function WeekSummary({ plan }: { plan: WeekPlanDTO }) {
  const s = plan.summary;
  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(245,231,10,0.10) 0%, rgba(245,231,10,0.03) 100%)",
        border: "1px solid rgba(245,231,10,0.22)",
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>План на неделю</div>
        <div style={{ fontSize: 13, color: YELLOW, fontWeight: 700 }}>
          {s.ready + s.published} из {s.total} готовы
        </div>
      </div>

      {/* Прогресс-бар */}
      <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${s.progress_pct}%`,
            background: `linear-gradient(90deg, ${OK} 0%, ${YELLOW} 100%)`,
            transition: "width 0.4s ease",
            boxShadow: "0 0 12px rgba(245,231,10,0.4)",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
        <SummaryStat label="Запланировано" value={s.planned} />
        <SummaryStat label="Готово" value={s.ready} color={YELLOW} />
        <SummaryStat label="Опубликовано" value={s.published} color={OK} />
      </div>
    </div>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || INK }}>{value}</div>
      <div style={{ fontSize: 10, color: SUB_MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
    </div>
  );
}

function DayRow({
  weekday,
  dayNum,
  today,
  items,
  onItemTap,
}: {
  weekday: string;
  dayNum: string;
  today: boolean;
  items: PlanItemDTO[];
  onItemTap: (it: PlanItemDTO) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: 12,
        borderRadius: 14,
        background: today ? "rgba(245,231,10,0.06)" : CARD_BG,
        border: `1px solid ${today ? "rgba(245,231,10,0.28)" : CARD_BORDER}`,
      }}
    >
      {/* Дата */}
      <div style={{ flexShrink: 0, width: 40, textAlign: "center", paddingTop: 2 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: today ? YELLOW : INK }}>{dayNum}</div>
        <div style={{ fontSize: 10, color: SUB_MUTED, textTransform: "uppercase" }}>{weekday}</div>
      </div>

      {/* Материалы дня */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 12, color: SUB_MUTED, paddingTop: 6 }}>Пусто</div>
        ) : (
          items.map((it) => {
            const badge = statusBadge(it.status);
            return (
              <button
                key={it.id}
                onClick={() => onItemTap(it)}
                style={{
                  appearance: "none",
                  textAlign: "left",
                  border: `1px solid ${CARD_BORDER}`,
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 10,
                  padding: "8px 10px",
                  cursor: "pointer",
                  color: INK,
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>
                  {TYPE_ICON[it.content_type] || "📄"}
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {it.title}
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "3px 7px",
                    borderRadius: 6,
                    background: badge.bg,
                    color: badge.color,
                  }}
                >
                  {badge.label}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function ActionSheet({
  item,
  onClose,
  onOpen,
  onStatus,
  onRemove,
}: {
  item: PlanItemDTO;
  onClose: () => void;
  onOpen: () => void;
  onStatus: (it: PlanItemDTO, s: ContentStatus) => void;
  onRemove: (it: PlanItemDTO) => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#15110A",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          border: "1px solid rgba(255,255,255,0.10)",
          padding: "18px 18px max(calc(env(safe-area-inset-bottom) + 18px), 28px)",
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)", margin: "0 auto 16px" }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: INK, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{TYPE_ICON[item.content_type] || "📄"}</span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.title}
          </span>
        </div>

        <SheetBtn label="📂 Открыть материал" onClick={onOpen} />
        <SheetBtn label="✅ Отметить готовым к съёмке" onClick={() => onStatus(item, "ready_to_shoot")} />
        <SheetBtn label="🚀 Отметить опубликованным" onClick={() => onStatus(item, "published")} />
        <SheetBtn label="↩️ Вернуть в черновики" onClick={() => onStatus(item, "scenario_ready")} />
        <SheetBtn label="🗑 Убрать из плана" onClick={() => onRemove(item)} danger />
        <SheetBtn label="Отмена" onClick={onClose} subtle />
      </div>
    </div>
  );
}

function SheetBtn({
  label,
  onClick,
  danger,
  subtle,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  subtle?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: "none",
        width: "100%",
        padding: "13px 14px",
        marginBottom: 8,
        borderRadius: 12,
        border: `1px solid ${CARD_BORDER}`,
        background: subtle ? "transparent" : "rgba(255,255,255,0.04)",
        color: danger ? "#FF8B8B" : subtle ? MUTED : INK,
        fontFamily: "inherit",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {label}
    </button>
  );
}

function WeekNavBtn({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: "none",
        width: 40,
        height: 40,
        borderRadius: 12,
        border: `1px solid ${CARD_BORDER}`,
        background: CARD_BG,
        color: INK,
        fontSize: 18,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {dir === "prev" ? "‹" : "›"}
    </button>
  );
}

function Header({ title }: { title: string }) {
  return (
    <h1
      style={{
        margin: "0 0 16px",
        fontSize: 26,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        color: INK,
      }}
    >
      {title}
    </h1>
  );
}

function ScreenWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding:
          "max(calc(env(safe-area-inset-top) + 56px), 88px) 18px " +
          "max(calc(env(safe-area-inset-bottom) + 96px), 110px)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {children}
    </div>
  );
}
