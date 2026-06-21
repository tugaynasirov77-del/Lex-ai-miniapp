"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listProjectDrafts,
  type ContentDraftDTO,
  type ContentStatus,
} from "../lib/api";
import { hapticImpact, hapticSelection } from "../lib/telegram";
import StateBlock from "./StateBlock";

const YELLOW = "#E84B91";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const SUB_MUTED = "rgba(255,255,255,0.42)";
const GREEN = "#5BD66B";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.10)";

type Props = {
  projectId: string;
  onOpenItem?: (draftId: string) => void;
};

// --- Фильтры ---
type TypeFilter = "all" | "reel" | "carousel" | "caption" | "idea";
type StatusFilter = "all" | "draft" | "ready" | "published";
type StatusGroup = "draft" | "ready" | "published" | "archived";

const TYPE_OPTIONS: { label: string; value: TypeFilter }[] = [
  { label: "Все", value: "all" },
  { label: "Reels", value: "reel" },
  { label: "Карусели", value: "carousel" },
  { label: "Подписи", value: "caption" },
  { label: "Идеи", value: "idea" },
];

const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: "Все", value: "all" },
  { label: "Черновик", value: "draft" },
  { label: "Готово к съёмке", value: "ready" },
  { label: "Опубликовано", value: "published" },
];

function statusGroup(status: ContentStatus): StatusGroup {
  switch (status) {
    case "idea":
    case "draft":
    case "scenario_ready":
    // legacy posts из TG-эпохи — тоже черновики
    case "pending":
      return "draft";
    case "ready_to_shoot":
    case "shot":
    case "ready_to_publish":
    case "scheduled":
    case "approved":
      return "ready";
    case "published":
      return "published";
    default:
      return "archived";
  }
}

function statusBadge(group: StatusGroup): { label: string; color: string } {
  switch (group) {
    case "ready":
      return { label: "Готово к съёмке", color: YELLOW };
    case "published":
      return { label: "Опубликовано", color: GREEN };
    case "archived":
      return { label: "Архив", color: SUB_MUTED };
    default:
      return { label: "Черновик", color: MUTED };
  }
}


function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export default function ContentLibrary({ projectId, onOpenItem }: Props) {
  const [items, setItems] = useState<ContentDraftDTO[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [active, setActive] = useState<ContentDraftDTO | null>(null);

  // Грузим ВСЁ один раз, дальше фильтруем на клиенте.
  useEffect(() => {
    let alive = true;
    setItems(null);
    setLoadErr(false);
    listProjectDrafts(projectId, { status: "all" })
      .then((r) => {
        if (alive) setItems(r.drafts || []);
      })
      .catch(() => {
        if (alive) setLoadErr(true);
      });
    return () => {
      alive = false;
    };
  }, [projectId, reloadTick]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((it) => {
      if (typeFilter !== "all" && it.content_type !== typeFilter) return false;
      if (statusFilter !== "all" && statusGroup(it.status) !== statusFilter) return false;
      return true;
    });
  }, [items, typeFilter, statusFilter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Фильтры по типу */}
      <ChipRow
        options={TYPE_OPTIONS}
        value={typeFilter}
        onChange={(v) => {
          hapticSelection();
          setTypeFilter(v);
        }}
      />
      {/* Фильтры по статусу */}
      <ChipRow
        options={STATUS_OPTIONS}
        value={statusFilter}
        onChange={(v) => {
          hapticSelection();
          setStatusFilter(v);
        }}
      />

      {/* Контент */}
      {loadErr ? (
        <StateBlock
          tone="error"
          emoji="🔌"
          title="Не удалось загрузить материалы"
          body="Проверь интернет и попробуй снова."
          action={{ label: "Повторить", onClick: () => setReloadTick((t) => t + 1) }}
        />
      ) : items === null ? (
        <SkeletonList />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <NoMatch />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              fontSize: 11,
              color: MUTED,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              fontWeight: 700,
              paddingLeft: 4,
            }}
          >
            Материалы · {filtered.length}
          </div>
          {filtered.map((it) => (
            <LibraryCard
              key={it.id}
              item={it}
              onOpen={() => {
                hapticImpact("light");
                if (onOpenItem) onOpenItem(it.id);
                else setActive(it);
              }}
            />
          ))}
        </div>
      )}

      {active && <DraftDetailSheet item={active} onClose={() => setActive(null)} />}
    </div>
  );
}

// Имя материала: пробуем все источники, иначе по типу.
function draftTitle(it: ContentDraftDTO): string {
  const sd: any = it.scenario_data;
  const cand =
    (it.title && it.title.trim()) ||
    (sd?.title && String(sd.title).trim()) ||
    (it.source_topic && it.source_topic.trim()) ||
    (it.idea_text && it.idea_text.trim()) ||
    (sd?.hook && String(sd.hook).trim()) ||
    (it.body && it.body.trim().split("\n")[0]) ||
    (it.caption && it.caption.trim().split("\n")[0]) ||
    "";
  if (cand) return cand.length > 80 ? cand.slice(0, 80) + "…" : cand;
  const byType: Record<string, string> = {
    reel: "Сценарий Reels", carousel: "Карусель", caption: "Подпись", idea: "Идея", post: "Пост",
  };
  return byType[it.content_type] || "Материал";
}

// Собирает читаемый текст материала для просмотра/копирования.
function draftBodyText(it: ContentDraftDTO): string {
  const sd: any = it.scenario_data;
  if (sd) {
    const parts: string[] = [];
    if (sd.hook) parts.push(`Хук: ${sd.hook}`);
    const scenes = sd.storyboard || sd.scenes;
    if (Array.isArray(scenes) && scenes.length) {
      parts.push("\nРаскадровка:");
      scenes.forEach((s: any, i: number) => {
        const t = s.seconds || (s.start != null ? `${s.start}-${s.end}с` : `${i + 1}`);
        parts.push(`[${t}] ${s.action || s.text || ""}${s.on_screen ? `\n  на экране: ${s.on_screen}` : ""}`);
      });
    }
    if (sd.voice_over) parts.push(`\nОзвучка:\n${sd.voice_over}`);
    if (sd.cta) parts.push(`\nCTA: ${sd.cta}`);
    if (sd.caption || it.caption) parts.push(`\nПодпись:\n${sd.caption || it.caption}`);
    return parts.join("\n").trim();
  }
  return (it.body || it.caption || it.idea_text || "Содержимое недоступно").trim();
}

function DraftDetailSheet({ item, onClose }: { item: ContentDraftDTO; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = draftBodyText(item);
  const sl = statusBadge(statusGroup(item.status));
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#15151E",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          border: "1px solid rgba(255,255,255,0.10)",
          // Клиренс под нижний таб-бар (~78px) + safe-area.
          padding: "16px 18px max(calc(env(safe-area-inset-bottom) + 96px), 110px)",
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)", margin: "0 auto 14px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: sl.color, padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.06)" }}>{sl.label}</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: INK, marginBottom: 12, letterSpacing: "-0.01em" }}>{draftTitle(item)}</div>
        {/* Скролл-блок с явным max-height (не зависит от flex — надёжно в WebView) */}
        <div style={{ maxHeight: "50vh", overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", fontSize: 13.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.55, whiteSpace: "pre-wrap", marginBottom: 12 }}>
          {text}
        </div>
        <button
          onClick={() => { navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
          style={{ appearance: "none", width: "100%", padding: "13px 0", border: "none", borderRadius: 12, background: "linear-gradient(135deg, #A24FD6 0%, #E84B91 50%, #F88A4A 100%)", color: "#FFFFFF", fontFamily: "inherit", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
        >
          {copied ? "✓ Скопировано" : "Скопировать"}
        </button>
      </div>
    </div>
  );
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        paddingBottom: 2,
      }}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              appearance: "none",
              flex: "0 0 auto",
              padding: "7px 14px",
              borderRadius: 999,
              border: `1px solid ${active ? YELLOW : CARD_BORDER}`,
              background: active ? "rgba(232,75,145,0.10)" : "transparent",
              color: active ? YELLOW : INK,
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              whiteSpace: "nowrap",
              cursor: "pointer",
              transition: "border-color 200ms, background 200ms, color 200ms",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function LibraryCard({
  item,
  onOpen,
}: {
  item: ContentDraftDTO;
  onOpen: () => void;
}) {
  const title = draftTitle(item);
  const badge = statusBadge(statusGroup(item.status));
  const date = formatDate(item.created_at);

  return (
    <button
      onClick={onOpen}
      style={{
        appearance: "none",
        textAlign: "left",
        width: "100%",
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
        padding: 14,
        color: INK,
        fontFamily: "inherit",
        cursor: "pointer",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <div style={{ display: "inline-flex", color: MUTED, flexShrink: 0 }}><TypeIcon type={item.content_type} size={22} /></div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {title}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <StatusPill label={badge.label} color={badge.color} />
          {date && <span style={{ fontSize: 11, color: SUB_MUTED }}>{date}</span>}
        </div>

        {item.planned_for_date && (
          <div
            style={{
              marginTop: 8,
              display: "inline-flex",
              alignItems: "center",
              fontSize: 11,
              color: YELLOW,
              background: "rgba(232,75,145,0.08)",
              border: "1px solid rgba(232,75,145,0.26)",
              borderRadius: 999,
              padding: "3px 10px",
            }}
          >
            запланировано на {formatDate(item.planned_for_date)}
          </div>
        )}
      </div>

      <div style={{ color: MUTED, fontSize: 16, lineHeight: 1, flexShrink: 0, alignSelf: "center" }}>›</div>
    </button>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 999,
        border: `1px solid ${color}`,
        background: `${color}1a`,
        color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 999, background: color }} />
      {label}
    </span>
  );
}

function SkeletonList() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            height: 80,
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 14,
            opacity: 0.5 - i * 0.1,
          }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <StateBlock
      emoji="📭"
      title="Здесь будут все твои материалы"
      body="Создай первый — разбери Reels или напиши сценарий."
    />
  );
}

function NoMatch() {
  return (
    <StateBlock
      compact
      emoji="🔍"
      title="Ничего не найдено"
      body="По выбранным фильтрам материалов нет. Попробуй сбросить фильтры."
    />
  );
}


type _IconProps = { size?: number; color?: string };
function TypeIcon({ type, size = 16, color = "currentColor" }: _IconProps & { type: string }) {
  if (type === "reel")
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="4.5" stroke={color} strokeWidth="1.7" /><path d="M3.5 8.5h17" stroke={color} strokeWidth="1.5" /><path d="M10.5 11.8l3.8 2.4-3.8 2.4v-4.8z" fill={color} /></svg>);
  if (type === "carousel")
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="7" y="5" width="12" height="14" rx="2.5" stroke={color} strokeWidth="1.7" /><path d="M4 8v9a2 2 0 002 2h8" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></svg>);
  if (type === "idea")
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M9 17h6M10 20h4M12 3a6 6 0 014 10.5c-.6.6-1 1.2-1 2H9c0-.8-.4-1.4-1-2A6 6 0 0112 3z" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>);
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="3" stroke={color} strokeWidth="1.7" /><path d="M8 9h8M8 13h8M8 17h5" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></svg>);
}
