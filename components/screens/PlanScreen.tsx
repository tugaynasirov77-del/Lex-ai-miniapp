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
import { track } from "../../lib/analytics";
import StateBlock from "../StateBlock";

const BG = "#0B0B11";
const INK = "#F4F4F8";
const MUTED = "#9A9AAB";
const SUB_MUTED = "#6B6B7B";
const CARD_BG = "#15151E";
const CARD_BORDER = "#262630";
const PINK = "#E84B91";
const IG_GRADIENT = "linear-gradient(95deg, #A24FD6 0%, #E84B91 50%, #F88A4A 100%)";
const TINT_PINK = "rgba(232,75,145,0.12)";
const OK = "#4FD489";
const ORANGE = "#F0944E";

type Props = { onBack: () => void };

type IconProps = { size?: number; color?: string };

// Группы статусов → бейдж (зелёный — опубликовано, оранжевый — готово, серый — черновик)
function statusBadge(status: ContentStatus): { label: string; color: string; bg: string } {
  if (status === "published")
    return { label: "Опубликовано", color: OK, bg: "rgba(79,212,137,0.14)" };
  if (["ready_to_shoot", "shot", "ready_to_publish", "scheduled", "approved"].includes(status))
    return { label: "Готово к съёмке", color: ORANGE, bg: "rgba(240,148,78,0.14)" };
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
  const [postPublish, setPostPublish] = useState<PlanItemDTO | null>(null);

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

  useEffect(() => {
    track("plan_opened");
  }, []);

  async function changeStatus(item: PlanItemDTO, status: ContentStatus) {
    hapticImpact("light");
    try {
      await updateDraft(item.id, { status });
      hapticNotify("success");
      track("content_status_changed", { draft_id: item.id, status });
      setActiveItem(null);
      // После публикации → блок «Что делаем дальше?» (бриф р.20, продуктовый цикл)
      if (status === "published") {
        track("content_marked_published", { draft_id: item.id });
        setPostPublish(item);
      }
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

  async function rescheduleItem(item: PlanItemDTO, date: string) {
    hapticImpact("light");
    try {
      await updateDraft(item.id, { planned_for_date: date });
      hapticNotify("success");
      track("content_status_changed", { draft_id: item.id, status: "rescheduled" });
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
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <StateBlock
            emoji="🗓"
            title="Плана пока нет"
            body="Сначала создай Instagram-проект — и здесь появится твой план на неделю."
            action={{ label: "Создать проект", onClick: () => actions.navigate("create-project") }}
          />
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
                color: PINK, fontSize: 11, cursor: "pointer", marginTop: 2, fontFamily: "inherit",
              }}
            >
              ← к текущей неделе
            </button>
          )}
        </div>
        <WeekNavBtn dir="next" onClick={() => { hapticImpact("light"); setWeekStart(shiftWeek(weekStart, 1)); }} />
      </div>

      {/* Ошибка загрузки: если плана ещё нет — полноценный блок с retry,
          если план уже показан (устарел) — тонкая плашка. */}
      {err && !plan && (
        <StateBlock
          tone="error"
          emoji="🔌"
          title="Не удалось загрузить план"
          body="Проверь интернет и попробуй снова."
          action={{ label: "Повторить", onClick: () => void load() }}
        />
      )}
      {err && plan && (
        <div style={{ marginBottom: 12 }}>
          <StateBlock
            tone="error"
            compact
            emoji="⚠️"
            title="Не удалось обновить план"
            body="Показаны последние данные."
            action={{ label: "Обновить", onClick: () => void load() }}
          />
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

      {/* Пустая неделя — подсказка как наполнить */}
      {plan && plan.summary.total === 0 && (
        <div style={{ marginTop: 16 }}>
          <StateBlock
            emoji="🗓"
            title="На этой неделе пусто"
            body="Разбери Reels → создай сценарий → «Добавить в план» — и материал появится здесь."
            action={{ label: "Создать контент", onClick: () => actions.navigate("create-hub") }}
          />
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
          onReschedule={rescheduleItem}
        />
      )}

      {/* После публикации — «Что делаем дальше?» (бриф р.20) */}
      {postPublish && (
        <PostPublishSheet
          item={postPublish}
          onClose={() => setPostPublish(null)}
          onCreateNext={() => {
            setPostPublish(null);
            if (projectId) actions.setIds({ projectId });
            actions.setScreenMeta("projectInitialTab", "overview");
            actions.navigate("project");
          }}
          onAnalyzeNew={() => {
            setPostPublish(null);
            if (projectId) actions.setIds({ projectId });
            actions.setScreenMeta("projectInitialTab", "overview");
            actions.navigate("project");
          }}
        />
      )}
    </ScreenWrap>
  );
}

/**
 * Блок «Что делаем дальше?» после отметки материала опубликованным.
 * Замыкает продуктовый цикл (бриф р.20): продолжение / другой хук /
 * повторить механику / разобрать новый Reels.
 */
function PostPublishSheet({
  item,
  onClose,
  onCreateNext,
  onAnalyzeNew,
}: {
  item: PlanItemDTO;
  onClose: () => void;
  onCreateNext: () => void;
  onAnalyzeNew: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 55,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: CARD_BG,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          border: "1px solid rgba(91,214,107,0.22)",
          padding: "18px 18px max(calc(env(safe-area-inset-bottom) + 18px), 28px)",
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)", margin: "0 auto 16px" }} />

        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🚀</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: INK, letterSpacing: "-0.02em" }}>
            Опубликовано!
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 4, lineHeight: 1.45 }}>
            «{item.title}» вышел в свет. Что делаем дальше?
          </div>
        </div>

        <SheetBtn label="Создать продолжение темы" onClick={onCreateNext} />
        <SheetBtn label="Попробовать другой хук" onClick={onCreateNext} />
        <SheetBtn label="Повторить рабочую механику" onClick={onCreateNext} />
        <SheetBtn label="Разобрать новый Reels" onClick={onAnalyzeNew} />
        <SheetBtn label="Закрыть" onClick={onClose} subtle />
      </div>
    </div>
  );
}

function WeekSummary({ plan }: { plan: WeekPlanDTO }) {
  const s = plan.summary;
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${TINT_PINK} 0%, rgba(162,79,214,0.05) 100%)`,
        border: `1px solid rgba(232,75,145,0.22)`,
        borderRadius: 18,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>План на неделю</div>
        <div style={{ fontSize: 13, color: PINK, fontWeight: 700 }}>
          {s.ready + s.published} из {s.total} готовы
        </div>
      </div>

      {/* Прогресс-бар */}
      <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${s.progress_pct}%`,
            background: IG_GRADIENT,
            transition: "width 0.4s ease",
            boxShadow: "0 0 12px rgba(232,75,145,0.4)",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
        <SummaryStat label="Запланировано" value={s.planned} />
        <SummaryStat label="Готово" value={s.ready} color={ORANGE} />
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
        background: today ? TINT_PINK : CARD_BG,
        border: `1px solid ${today ? "rgba(232,75,145,0.28)" : CARD_BORDER}`,
      }}
    >
      {/* Дата */}
      <div style={{ flexShrink: 0, width: 40, textAlign: "center", paddingTop: 2 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: today ? PINK : INK }}>{dayNum}</div>
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
                <span style={{ flexShrink: 0, color: MUTED, display: "inline-flex" }}>
                  <TypeIcon type={it.content_type} size={15} />
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
  onReschedule,
}: {
  item: PlanItemDTO;
  onClose: () => void;
  onOpen: () => void;
  onStatus: (it: PlanItemDTO, s: ContentStatus) => void;
  onRemove: (it: PlanItemDTO) => void;
  onReschedule: (it: PlanItemDTO, date: string) => void;
}) {
  const [pickDay, setPickDay] = useState(false);
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
          background: CARD_BG,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          border: "1px solid rgba(255,255,255,0.10)",
          padding: "18px 18px max(calc(env(safe-area-inset-bottom) + 18px), 28px)",
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)", margin: "0 auto 16px" }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: INK, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: MUTED, display: "inline-flex" }}><TypeIcon type={item.content_type} size={16} /></span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.title}
          </span>
        </div>

        {pickDay ? (
          <DayPicker
            onPick={(date) => onReschedule(item, date)}
            onCancel={() => setPickDay(false)}
          />
        ) : (
          <>
            <SheetBtn label="Открыть материал" onClick={onOpen} />
            <SheetBtn label="Перенести на другой день" onClick={() => { hapticImpact("light"); setPickDay(true); }} />
            <SheetBtn label="Отметить готовым к съёмке" onClick={() => onStatus(item, "ready_to_shoot")} />
            <SheetBtn label="Отметить опубликованным" onClick={() => onStatus(item, "published")} />
            <SheetBtn label="Вернуть в черновики" onClick={() => onStatus(item, "scenario_ready")} />
            <SheetBtn label="Убрать из плана" onClick={() => onRemove(item)} danger />
            <SheetBtn label="Отмена" onClick={onClose} subtle />
          </>
        )}
      </div>
    </div>
  );
}

// Инлайн-выбор дня для переноса материала (ближайшие 14 дней).
function DayPicker({ onPick, onCancel }: { onPick: (date: string) => void; onCancel: () => void }) {
  const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  const MO = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { iso, dayNum: d.getDate(), wd: WD[d.getDay()], mo: MO[d.getMonth()], isToday: i === 0, isTomorrow: i === 1 };
  });
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 12 }}>На какой день перенести?</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {days.map((d) => (
          <button
            key={d.iso}
            onClick={() => { hapticImpact("light"); onPick(d.iso); }}
            style={{
              appearance: "none", width: "calc(25% - 6px)", padding: "10px 0", borderRadius: 12,
              border: `1px solid ${CARD_BORDER}`, background: "rgba(255,255,255,0.04)",
              color: INK, fontFamily: "inherit", cursor: "pointer", textAlign: "center",
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 800, color: d.isToday ? PINK : INK }}>{d.dayNum}</div>
            <div style={{ fontSize: 9, color: SUB_MUTED, textTransform: "uppercase", marginTop: 1 }}>
              {d.isToday ? "сегодня" : d.isTomorrow ? "завтра" : `${d.wd} ${d.mo}`}
            </div>
          </button>
        ))}
      </div>
      <SheetBtn label="Назад" onClick={onCancel} subtle />
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

// Line-иконка типа материала (единый стиль с Home/Create).
function TypeIcon({ type, size = 16, color = "currentColor" }: IconProps & { type: string }) {
  if (type === "reel")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="4.5" stroke={color} strokeWidth="1.7" />
        <path d="M3.5 8.5h17" stroke={color} strokeWidth="1.5" />
        <path d="M10.5 11.8l3.8 2.4-3.8 2.4v-4.8z" fill={color} />
      </svg>
    );
  if (type === "carousel")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="7" y="5" width="12" height="14" rx="2.5" stroke={color} strokeWidth="1.7" />
        <path d="M4 8v9a2 2 0 002 2h8" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  if (type === "idea")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M9 17h6M10 20h4M12 3a6 6 0 014 10.5c-.6.6-1 1.2-1 2H9c0-.8-.4-1.4-1-2A6 6 0 0112 3z" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="3" stroke={color} strokeWidth="1.7" />
      <path d="M8 9h8M8 13h8M8 17h5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
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
        background: BG,
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
