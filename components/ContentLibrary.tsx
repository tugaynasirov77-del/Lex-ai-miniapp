"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listProjectDrafts,
  type ContentDraftDTO,
  type ContentStatus,
} from "../lib/api";
import { hapticImpact, hapticSelection } from "../lib/telegram";

const YELLOW = "#F5E70A";
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

const TYPE_ICON: Record<string, string> = {
  reel: "🎬",
  carousel: "🖼",
  caption: "✏️",
  idea: "💡",
  post: "📝",
};

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export default function ContentLibrary({ projectId, onOpenItem }: Props) {
  const [items, setItems] = useState<ContentDraftDTO[] | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Грузим ВСЁ один раз, дальше фильтруем на клиенте.
  useEffect(() => {
    let alive = true;
    setItems(null);
    listProjectDrafts(projectId, { status: "all" })
      .then((r) => {
        if (alive) setItems(r.drafts || []);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [projectId]);

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
      {items === null ? (
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
                onOpenItem?.(it.id);
              }}
            />
          ))}
        </div>
      )}
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
              background: active ? "rgba(245,231,10,0.10)" : "transparent",
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
  const icon = TYPE_ICON[item.content_type] || "📄";
  const title =
    (item.title && item.title.trim()) ||
    (item.source_topic && item.source_topic.trim()) ||
    "Без названия";
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
      <div style={{ fontSize: 22, lineHeight: 1.2, flexShrink: 0 }}>{icon}</div>

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
              background: "rgba(245,231,10,0.08)",
              border: "1px solid rgba(245,231,10,0.26)",
              borderRadius: 999,
              padding: "3px 10px",
            }}
          >
            📅 запланировано на {formatDate(item.planned_for_date)}
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
    <div
      style={{
        padding: 24,
        textAlign: "center",
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
        color: MUTED,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      Здесь будут все твои материалы.
      <br />
      Создай первый — разбери Reels или напиши сценарий.
    </div>
  );
}

function NoMatch() {
  return (
    <div
      style={{
        padding: 20,
        textAlign: "center",
        color: SUB_MUTED,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      Ничего не найдено по выбранным фильтрам.
    </div>
  );
}
