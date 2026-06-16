"use client";

import { useEffect, useRef, useState } from "react";
import { getInitData } from "../../lib/telegram";
import { useFlow, useFlowActions } from "../../flow";
import {
  lexWritePost,
  lexWriteCarousel,
  lexWriteReel,
  approveDraft,
  deleteDraft,
  getProject,
  ApiError,
  type LexPostVariant,
  type LexCarousel,
  type LexReelScript,
  type CarouselStyle,
} from "../../lib/api";
import { hapticImpact, hapticNotify } from "../../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.10)";

type Format = "post" | "carousel" | "reel";
type Phase = "form" | "loading" | "result" | "error" | "limit" | "done";

type DoneInfo = {
  variant: "publish_now" | "scheduled" | "deleted";
  scheduledAtIso?: string;
};

const FORMAT_LABEL: Record<Format, string> = {
  post: "Пост",
  carousel: "Карусель",
  reel: "Reels",
};

const STYLE_OPTIONS: { key: CarouselStyle; label: string }[] = [
  { key: "minimal", label: "Минимализм" },
  { key: "pop", label: "Поп / яркий" },
  { key: "editorial", label: "Editorial" },
  { key: "ai_tech", label: "AI / tech" },
  { key: "business", label: "Бизнес" },
];

const DURATION_OPTIONS: { key: 15 | 30 | 60; label: string }[] = [
  { key: 15, label: "15 сек" },
  { key: 30, label: "30 сек" },
  { key: 60, label: "60 сек" },
];

type Props = { onBack: () => void };

export default function LexCreateScreen({ onBack }: Props) {
  const { state } = useFlow();
  const actions = useFlowActions();
  const projectId = state.projectId;

  // Pre-fill из screenMeta (когда юзер пришёл с PlanIdeaCard «Собрать»)
  const prefillTopic = (state.screenMeta as any)?.lexTopic as string | undefined;
  const prefillFormat = (state.screenMeta as any)?.lexFormat as Format | undefined;

  const [format, setFormat] = useState<Format>(
    prefillFormat === "post" || prefillFormat === "carousel" || prefillFormat === "reel"
      ? prefillFormat
      : "post"
  );
  const [topic, setTopic] = useState(prefillTopic || "");

  // Очищаем screenMeta после первой подцепки чтобы при возврате не предзаполнялось снова
  useEffect(() => {
    if (prefillTopic || prefillFormat) {
      actions.setScreenMeta("lexTopic", undefined);
      actions.setScreenMeta("lexFormat", undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Подгружаем проект чтобы знать, есть ли подключённый TG-канал для автопостинга.
  // Если нет — для постов прячем «Опубликовать» и показываем «Скопировать».
  const [hasTgChannel, setHasTgChannel] = useState<boolean | null>(null);
  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    getProject(projectId)
      .then((r) => {
        if (!alive) return;
        const ch = (r.project as any)?.channel_id;
        setHasTgChannel(!!ch);
      })
      .catch(() => alive && setHasTgChannel(false));
    return () => {
      alive = false;
    };
  }, [projectId]);
  const [style, setStyle] = useState<CarouselStyle>("minimal");
  const [duration, setDuration] = useState<15 | 30 | 60>(30);

  const [phase, setPhase] = useState<Phase>("form");
  const [done, setDone] = useState<DoneInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [variants, setVariants] = useState<LexPostVariant[]>([]);
  const [pickedVariant, setPickedVariant] = useState<LexPostVariant | null>(null);
  const [carousel, setCarousel] = useState<LexCarousel | null>(null);
  const [reel, setReel] = useState<LexReelScript | null>(null);

  if (!projectId) {
    return (
      <Wrap>
        <h1 style={{ fontSize: 22, margin: 0 }}>Сначала выбери проект</h1>
        <button onClick={onBack} style={btnSecondary()}>Назад</button>
      </Wrap>
    );
  }

  async function submit() {
    if (!projectId || !topic.trim()) return;
    setPhase("loading");
    setError(null);
    hapticImpact("medium");
    try {
      if (format === "post") {
        const r = await lexWritePost(projectId, topic.trim());
        setDraftId(r.draftId);
        setVariants(r.variants);
      } else if (format === "carousel") {
        const r = await lexWriteCarousel(projectId, topic.trim(), style);
        setDraftId(r.draftId);
        setCarousel(r.carousel);
      } else {
        const r = await lexWriteReel(projectId, topic.trim(), duration);
        setDraftId(r.draftId);
        setReel(r.script);
      }
      setPhase("result");
      hapticNotify("success");
    } catch (e) {
      // 402 = квота — показываем upgrade prompt вместо ошибки
      if (e instanceof ApiError && e.status === 402) {
        setError(e.message);
        setPhase("limit");
        hapticNotify("warning");
        return;
      }
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Что-то пошло не так";
      setError(msg);
      setPhase("error");
      hapticNotify("error");
    }
  }

  // Шаг 1: юзер выбрал один из 3 вариантов — переходим на экран действий.
  async function pickPostVariant(v: LexPostVariant) {
    if (!draftId) return;
    hapticImpact("medium");
    setPickedVariant(v);
    // Заодно сохраним выбранный вариант как body в БД, чтобы публикация
    // взяла именно его.
    try {
      await fetch(`/api/drafts/${draftId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data":
            (window as any).Telegram?.WebApp?.initData || "",
        },
        body: JSON.stringify({ body: v.body, chosen_title: v.title }),
      });
    } catch {
      // не критично — body уже body[0] по умолчанию
    }
  }

  async function publishNow() {
    if (!draftId) return;
    hapticImpact("medium");
    try {
      const r = await approveDraft(draftId, { publish_now: true });
      hapticNotify("success");
      setDone({ variant: "publish_now", scheduledAtIso: r.scheduled_at });
      setPhase("done");
    } catch (e) {
      hapticNotify("error");
      setError(e instanceof Error ? e.message : "не получилось");
      setPhase("error");
    }
  }

  async function publishAt(iso: string) {
    if (!draftId) return;
    hapticImpact("medium");
    try {
      const r = await approveDraft(draftId, { scheduled_at: iso });
      hapticNotify("success");
      setDone({ variant: "scheduled", scheduledAtIso: r.scheduled_at });
      setPhase("done");
    } catch (e) {
      hapticNotify("error");
      setError(e instanceof Error ? e.message : "не получилось");
      setPhase("error");
    }
  }

  async function regenerate() {
    if (!draftId) return;
    hapticImpact("medium");
    // Удаляем текущий — лимит не накручиваем (DELETE его исключит из quota)
    try { await deleteDraft(draftId); } catch { /* ignore */ }
    setPickedVariant(null);
    await submit();
  }

  async function discard() {
    if (!draftId) return;
    hapticImpact("medium");
    try {
      await deleteDraft(draftId);
      hapticNotify("success");
      setDone({ variant: "deleted" });
      setPhase("done");
    } catch (e) {
      hapticNotify("error");
      setError(e instanceof Error ? e.message : "не получилось");
      setPhase("error");
    }
  }

  function copy(text: string, label?: string) {
    navigator.clipboard?.writeText(text).then(
      () => hapticNotify("success"),
      () => hapticNotify("error")
    );
    if (label) {
      // лёгкая визуальная обратная связь через alert опускаем — Mini App в Telegram alert уродлив
    }
  }

  function resetToForm() {
    setPhase("form");
    setVariants([]);
    setPickedVariant(null);
    setCarousel(null);
    setReel(null);
    setDraftId(null);
    setError(null);
  }

  // ──────── RENDER ────────

  return (
    <Wrap>
      <Header onBack={onBack} title="LEX AI" subtitle="Создание контента" />

      {phase === "form" && (
        <>
          <FormatPicker value={format} onChange={setFormat} />
          <TopicInput value={topic} onChange={setTopic} format={format} />

          {format === "carousel" && (
            <StylePicker value={style} onChange={setStyle} />
          )}
          {format === "reel" && (
            <DurationPicker value={duration} onChange={setDuration} />
          )}

          <button
            onClick={submit}
            disabled={!topic.trim()}
            style={btnPrimary(!topic.trim())}
          >
            СОЗДАТЬ
          </button>
        </>
      )}

      {phase === "loading" && (
        <LoadingBlock format={format} />
      )}

      {phase === "error" && (
        <ErrorBlock message={error || ""} onRetry={resetToForm} />
      )}

      {phase === "limit" && (
        <LimitBlock
          message={error || ""}
          onClose={resetToForm}
          onUpgrade={() => actions.navigate("billing")}
        />
      )}

      {phase === "done" && done && (
        <DoneBlock
          info={done}
          onProject={() => actions.navigate("project")}
          onNew={resetToForm}
        />
      )}

      {phase === "result" && format === "post" && !pickedVariant && (
        <PostResult variants={variants} onPick={pickPostVariant} onNew={resetToForm} />
      )}
      {phase === "result" && format === "post" && pickedVariant && (
        <PostActions
          variant={pickedVariant}
          hasTgChannel={hasTgChannel !== false}
          projectId={projectId}
          draftId={draftId}
          onPublishNow={publishNow}
          onPublishAt={publishAt}
          onRegenerate={regenerate}
          onDelete={discard}
          onCopy={copy}
          onBack={() => setPickedVariant(null)}
        />
      )}
      {phase === "result" && format === "carousel" && carousel && (
        <CarouselResult
          carousel={carousel}
          onCopy={copy}
          onNew={resetToForm}
          onRegenerate={regenerate}
          onDelete={discard}
        />
      )}
      {phase === "result" && format === "reel" && reel && (
        <ReelResult
          script={reel}
          onCopy={copy}
          onNew={resetToForm}
          onRegenerate={regenerate}
          onDelete={discard}
        />
      )}
    </Wrap>
  );
}

// ──────── Pieces ────────

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding:
          "max(calc(env(safe-area-inset-top) + 56px), 88px) 18px " +
          "max(calc(env(safe-area-inset-bottom) + 100px), 116px)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
      }}
    >
      {children}
    </div>
  );
}

function Header({
  onBack,
  title,
  subtitle,
}: {
  onBack: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <button onClick={onBack} style={{ ...btnGhost(), padding: "4px 0", marginBottom: 8 }}>
        ← Назад
      </button>
      <h1 style={{ margin: 0, fontSize: 28, letterSpacing: "-0.02em", fontWeight: 800 }}>
        {title}
      </h1>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: MUTED }}>{subtitle}</p>
    </div>
  );
}

function FormatPicker({
  value,
  onChange,
}: {
  value: Format;
  onChange: (f: Format) => void;
}) {
  const options: Format[] = ["post", "carousel", "reel"];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {options.map((f) => {
        const active = f === value;
        return (
          <button
            key={f}
            onClick={() => onChange(f)}
            style={{
              flex: 1,
              padding: "12px 6px",
              borderRadius: 12,
              border: active
                ? `1.5px solid ${YELLOW}`
                : `1px solid ${CARD_BORDER}`,
              background: active ? `${YELLOW}14` : CARD_BG,
              color: INK,
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              cursor: "pointer",
            }}
          >
            {FORMAT_LABEL[f]}
          </button>
        );
      })}
    </div>
  );
}

function TopicInput({
  value,
  onChange,
  format,
}: {
  value: string;
  onChange: (s: string) => void;
  format: Format;
}) {
  const placeholder =
    format === "post"
      ? "Например: 5 ошибок начинающих маркетологов"
      : format === "carousel"
        ? "Например: как удержать клиента после первой покупки"
        : "Например: 3 секрета вирусного reels";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: MUTED, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        Тема
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 12,
          padding: 12,
          color: INK,
          fontSize: 14,
          fontFamily: "inherit",
          resize: "vertical",
          minHeight: 72,
        }}
      />
    </div>
  );
}

function StylePicker({
  value,
  onChange,
}: {
  value: CarouselStyle;
  onChange: (s: CarouselStyle) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: MUTED, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        Визуальный стиль
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {STYLE_OPTIONS.map((s) => {
          const active = s.key === value;
          return (
            <button
              key={s.key}
              onClick={() => onChange(s.key)}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: active
                  ? `1.5px solid ${YELLOW}`
                  : `1px solid ${CARD_BORDER}`,
                background: active ? `${YELLOW}14` : "transparent",
                color: INK,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DurationPicker({
  value,
  onChange,
}: {
  value: 15 | 30 | 60;
  onChange: (d: 15 | 30 | 60) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: MUTED, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        Длительность
      </label>
      <div style={{ display: "flex", gap: 6 }}>
        {DURATION_OPTIONS.map((d) => {
          const active = d.key === value;
          return (
            <button
              key={d.key}
              onClick={() => onChange(d.key)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 12,
                border: active
                  ? `1.5px solid ${YELLOW}`
                  : `1px solid ${CARD_BORDER}`,
                background: active ? `${YELLOW}14` : CARD_BG,
                color: INK,
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {d.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LoadingBlock({ format }: { format: Format }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 999,
          background: YELLOW,
          boxShadow: `0 0 60px ${YELLOW}55`,
          animation: "lex-pulse-soft 1.4s ease-in-out infinite",
        }}
      />
      <p style={{ margin: 0, fontSize: 14, color: MUTED }}>
        LEX AI пишет {format === "reel" ? "сценарий" : format === "carousel" ? "карусель" : "3 варианта"}…
      </p>
      <style>{`
        @keyframes lex-pulse-soft {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.18); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

function LimitBlock({
  message,
  onClose,
  onUpgrade,
}: {
  message: string;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 999,
          background: `${YELLOW}1A`,
          border: `2px solid ${YELLOW}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: YELLOW,
          fontSize: 28,
          fontWeight: 900,
        }}
      >
        ⚡
      </div>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>
        Лимит на эту неделю
      </h2>
      <p style={{ margin: 0, fontSize: 13, color: MUTED, maxWidth: 300, lineHeight: 1.5 }}>
        {message}
      </p>
      <div
        style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 14,
          padding: 14,
          width: "100%",
          maxWidth: 340,
        }}
      >
        <div style={{ fontSize: 12, color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
          В Pro будет:
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
          {[
            "До 3 проектов",
            "60 постов в месяц",
            "30 каруселей в месяц",
            "30 сценариев Reels в месяц",
            "Приоритет в очереди",
          ].map((s) => (
            <li key={s} style={{ fontSize: 13, paddingLeft: 14, position: "relative" }}>
              <span style={{ position: "absolute", left: 0, color: YELLOW, fontWeight: 700 }}>·</span>
              {s}
            </li>
          ))}
        </ul>
      </div>
      <button onClick={onUpgrade} style={btnPrimary(false)}>
        ОТКРЫТЬ ПОДПИСКУ
      </button>
      <button onClick={onClose} style={btnGhost()}>
        ← Назад
      </button>
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 40 }}>⚠️</div>
      <h2 style={{ margin: 0, fontSize: 20 }}>Не получилось</h2>
      <p style={{ margin: 0, fontSize: 13, color: MUTED, maxWidth: 280 }}>{message}</p>
      <button onClick={onRetry} style={btnPrimary(false)}>
        ПОПРОБОВАТЬ ЕЩЁ
      </button>
    </div>
  );
}

function DoneBlock({
  info,
  onProject,
  onNew,
}: {
  info: DoneInfo;
  onProject: () => void;
  onNew: () => void;
}) {
  const title =
    info.variant === "publish_now"
      ? "Пост в очереди на публикацию"
      : info.variant === "scheduled"
        ? "Пост запланирован"
        : "Пост удалён";
  const subtitle =
    info.variant === "publish_now"
      ? "Опубликуется в канале в ближайшие 5 минут."
      : info.variant === "scheduled" && info.scheduledAtIso
        ? `Опубликуется ${formatRu(info.scheduledAtIso)}.`
        : info.variant === "deleted"
          ? "Можешь начать заново."
          : "";

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 999,
          background: YELLOW,
          boxShadow: `0 0 80px ${YELLOW}88`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#0A0608",
          fontSize: 36,
          fontWeight: 900,
        }}
      >
        ✓
      </div>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>
        {title}
      </h2>
      <p style={{ margin: 0, fontSize: 13, color: MUTED, maxWidth: 300, lineHeight: 1.5 }}>
        {subtitle}
      </p>
      <button onClick={onProject} style={btnPrimary(false)}>
        К ПРОЕКТУ
      </button>
      <button onClick={onNew} style={btnGhost()}>
        ← Создать ещё
      </button>
    </div>
  );
}

function formatRu(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const months = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const m = months[d.getMonth()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${m} в ${hh}:${mm}`;
}

function PostResult({
  variants,
  onPick,
  onNew,
}: {
  variants: LexPostVariant[];
  onPick: (v: LexPostVariant) => void;
  onNew: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
        Тапни вариант — следующий шаг: публикация или планирование.
      </p>
      {variants.map((v, i) => (
        <button
          key={i}
          onClick={() => onPick(v)}
          style={{
            textAlign: "left",
            padding: 14,
            borderRadius: 14,
            border: `1px solid ${CARD_BORDER}`,
            background: CARD_BG,
            color: INK,
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 6, letterSpacing: "0.06em" }}>
            ВАРИАНТ {i + 1}
          </div>
          <HtmlPostBody html={v.body} />
        </button>
      ))}
      <button onClick={onNew} style={btnSecondary()}>
        ← НОВАЯ ТЕМА
      </button>
    </div>
  );
}

// Рендерит body поста с поддержкой <b>, <i>, <blockquote> Telegram-разметки.
// Безопасно — стрипает все ОСТАЛЬНЫЕ теги, оставляя только whitelist.
function HtmlPostBody({ html }: { html: string }) {
  const safe = sanitizeTgHtml(html);
  return (
    <div
      className="lex-post-html"
      style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap" }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

const ALLOWED_TAGS = new Set(["b", "i", "u", "blockquote", "br"]);
function sanitizeTgHtml(html: string): string {
  // Стрипаем все теги кроме whitelist. Атрибуты не разрешаем вообще.
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g, (m, tag) => {
    const t = String(tag).toLowerCase();
    if (!ALLOWED_TAGS.has(t)) return "";
    return m.startsWith("</") ? `</${t}>` : `<${t}>`;
  });
}

function PostActions({
  variant,
  hasTgChannel,
  projectId,
  draftId,
  onPublishNow,
  onPublishAt,
  onRegenerate,
  onDelete,
  onCopy,
  onBack,
}: {
  variant: LexPostVariant;
  hasTgChannel: boolean;
  projectId: string;
  draftId: string | null;
  onPublishNow: () => void;
  onPublishAt: (iso: string) => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onCopy: (text: string, label?: string) => void;
  onBack: () => void;
}) {
  // Дефолт: завтра 10:00 по локали
  const now = new Date();
  const defaultDt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  defaultDt.setHours(10, 0, 0, 0);
  const defaultLocal = toLocalInput(defaultDt);

  const [scheduleMode, setScheduleMode] = useState(false);
  const [dt, setDt] = useState(defaultLocal);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function uploadPhoto(file: File) {
    if (!draftId) return;
    setPhotoBusy(true);
    setPhotoErr(null);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const r = await fetch(`/api/projects/${projectId}/drafts/${draftId}/photo`, {
        method: "POST",
        headers: { "x-telegram-init-data": getInitData() },
        body: fd,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "не удалось загрузить");
      setPhotoUrl(j.photo_url);
    } catch (e: any) {
      setPhotoErr(e?.message || "ошибка");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    if (!draftId) return;
    setPhotoBusy(true);
    try {
      await fetch(`/api/projects/${projectId}/drafts/${draftId}/photo`, {
        method: "DELETE",
        headers: { "x-telegram-init-data": getInitData() },
      });
      setPhotoUrl(null);
    } finally {
      setPhotoBusy(false);
    }
  }

  function tryPublishAt() {
    const local = new Date(dt);
    if (isNaN(local.getTime())) return;
    onPublishAt(local.toISOString());
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 14,
          padding: 14,
        }}
      >
        <div style={{ fontSize: 11, color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8, fontWeight: 700 }}>
          Выбранный пост
        </div>
        <HtmlPostBody html={variant.body} />
      </div>

      {hasTgChannel && draftId && (
        <div
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 14,
            padding: 14,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: MUTED,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 10,
              fontWeight: 700,
            }}
          >
            Фото к посту
          </div>
          {photoUrl ? (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt=""
                style={{
                  width: 88,
                  height: 88,
                  objectFit: "cover",
                  borderRadius: 12,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photoBusy}
                  style={{ ...btnSecondary(), fontSize: 12, padding: "8px 12px" }}
                >
                  {photoBusy ? "ЗАГРУЗКА…" : "ЗАМЕНИТЬ"}
                </button>
                <button
                  onClick={removePhoto}
                  disabled={photoBusy}
                  style={{
                    ...btnSecondary(),
                    fontSize: 12,
                    padding: "8px 12px",
                    color: "#FF7373",
                    border: "1px solid rgba(255,115,115,0.40)",
                  }}
                >
                  УБРАТЬ
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={photoBusy}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: "transparent",
                border: "1.5px dashed rgba(255,255,255,0.18)",
                borderRadius: 12,
                color: "rgba(255,255,255,0.75)",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              {photoBusy ? "ЗАГРУЗКА…" : "📎 Прикрепить фото"}
            </button>
          )}
          {photoErr && (
            <div style={{ marginTop: 6, fontSize: 11, color: "#FF7373" }}>{photoErr}</div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadPhoto(f);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {!scheduleMode && hasTgChannel && (
        <>
          <button onClick={onPublishNow} style={btnPrimary(false)}>
            ОПУБЛИКОВАТЬ СЕЙЧАС
          </button>
          <button onClick={() => setScheduleMode(true)} style={btnSecondary()}>
            ЗАПЛАНИРОВАТЬ НА ДАТУ
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onRegenerate} style={{ ...btnSecondary(), flex: 1 }}>
              ПЕРЕСОБРАТЬ
            </button>
            <button
              onClick={onDelete}
              style={{
                ...btnSecondary(),
                flex: 1,
                color: "#FF7373",
                border: "1px solid rgba(255,115,115,0.40)",
              }}
            >
              УДАЛИТЬ
            </button>
          </div>
          <button onClick={onBack} style={btnGhost()}>
            ← К вариантам
          </button>
        </>
      )}

      {!scheduleMode && !hasTgChannel && (
        <>
          <div
            style={{
              background: "rgba(243,155,64,0.10)",
              border: "1px solid rgba(243,155,64,0.40)",
              borderRadius: 12,
              padding: 10,
              fontSize: 12,
              color: "#F39B40",
              lineHeight: 1.45,
            }}
          >
            Автопубликация работает только для TG-каналов.
            Здесь — IG-проект, поэтому пост нужно скопировать и
            опубликовать вручную.
          </div>
          <button
            onClick={() => onCopy(variant.body, "Текст поста")}
            style={btnPrimary(false)}
          >
            СКОПИРОВАТЬ ТЕКСТ
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onRegenerate} style={{ ...btnSecondary(), flex: 1 }}>
              ПЕРЕСОБРАТЬ
            </button>
            <button
              onClick={onDelete}
              style={{
                ...btnSecondary(),
                flex: 1,
                color: "#FF7373",
                border: "1px solid rgba(255,115,115,0.40)",
              }}
            >
              УДАЛИТЬ
            </button>
          </div>
          <button onClick={onBack} style={btnGhost()}>
            ← К вариантам
          </button>
        </>
      )}

      {scheduleMode && (
        <div
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 14,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <label style={{ fontSize: 12, color: MUTED, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Дата и время публикации
          </label>
          <input
            type="datetime-local"
            value={dt}
            onChange={(e) => setDt(e.target.value)}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 10,
              padding: 12,
              color: INK,
              fontSize: 14,
              fontFamily: "inherit",
              colorScheme: "dark",
            }}
          />
          <button onClick={tryPublishAt} style={btnPrimary(false)}>
            ПОДТВЕРДИТЬ
          </button>
          <button onClick={() => setScheduleMode(false)} style={btnGhost()}>
            ← Отмена
          </button>
        </div>
      )}
    </div>
  );
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CarouselResult({
  carousel,
  onCopy,
  onNew,
  onRegenerate,
  onDelete,
}: {
  carousel: LexCarousel;
  onCopy: (text: string, label?: string) => void;
  onNew: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
}) {
  const slidesText = carousel.slides
    .map((s) => `Слайд ${s.num}: ${s.text}`)
    .join("\n\n");
  const captionFull = `${carousel.caption}\n\n${carousel.hashtags.join(" ")}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <CopyBlock
        label="Тема и Hook"
        text={`${carousel.topic}\n\n${carousel.hook}`}
        onCopy={onCopy}
      />
      <CopyBlock
        label="Промпт для картинок"
        hint="Вставь в Midjourney / Sora / DALL-E"
        text={carousel.image_prompt}
        onCopy={onCopy}
        mono
      />
      <CopyBlock label="Тексты слайдов" text={slidesText} onCopy={onCopy} />
      <CopyBlock label="Caption и хэштеги" text={captionFull} onCopy={onCopy} />
      <ResultActions onNew={onNew} onRegenerate={onRegenerate} onDelete={onDelete} />
    </div>
  );
}

function ReelResult({
  script,
  onCopy,
  onNew,
  onRegenerate,
  onDelete,
}: {
  script: LexReelScript;
  onCopy: (text: string, label?: string) => void;
  onNew: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
}) {
  const scenesText = script.scenes
    .map(
      (s) =>
        `[${s.seconds}] ${s.action}${s.on_screen ? `\n   в кадре: ${s.on_screen}` : ""}`
    )
    .join("\n\n");
  const fullScript = `${script.topic}\n\nHOOK: ${script.hook}\n\nРАСКАДРОВКА:\n${scenesText}\n\nМУЗЫКА: ${script.music_hint}`;
  const captionFull = `${script.caption}\n\n${script.hashtags.join(" ")}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <CopyBlock label="Полный сценарий и раскадровка" text={fullScript} onCopy={onCopy} />
      <CopyBlock label="Только HOOK" text={script.hook} onCopy={onCopy} />
      <CopyBlock label="Подсказка по музыке" text={script.music_hint} onCopy={onCopy} />
      <CopyBlock label="Caption и хэштеги" text={captionFull} onCopy={onCopy} />
      <ResultActions onNew={onNew} onRegenerate={onRegenerate} onDelete={onDelete} />
    </div>
  );
}

function ResultActions({
  onNew,
  onRegenerate,
  onDelete,
}: {
  onNew: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onRegenerate} style={{ ...btnSecondary(), flex: 1 }}>
          ПЕРЕСОБРАТЬ
        </button>
        <button
          onClick={onDelete}
          style={{
            ...btnSecondary(),
            flex: 1,
            color: "#FF7373",
            border: "1px solid rgba(255,115,115,0.40)",
          }}
        >
          УДАЛИТЬ
        </button>
      </div>
      <button onClick={onNew} style={btnGhost()}>
        ← Новая тема
      </button>
    </>
  );
}

function CopyBlock({
  label,
  text,
  hint,
  onCopy,
  mono,
}: {
  label: string;
  text: string;
  hint?: string;
  onCopy: (text: string, label?: string) => void;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontSize: 11,
              color: INK,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {label}
          </span>
          {hint && (
            <span style={{ fontSize: 10, color: MUTED, letterSpacing: "0.02em" }}>{hint}</span>
          )}
        </div>
        <button
          onClick={() => {
            onCopy(text, label);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          style={{
            background: copied ? YELLOW : "transparent",
            color: copied ? "#0A0608" : YELLOW,
            border: `1px solid ${YELLOW}`,
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            padding: "5px 10px",
            cursor: "pointer",
          }}
        >
          {copied ? "СКОПИРОВАНО ✓" : "КОПИРОВАТЬ"}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          fontSize: mono ? 11 : 13,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: mono ? "Menlo, monospace" : "inherit",
          color: "rgba(255,255,255,0.9)",
        }}
      >
        {text}
      </pre>
    </div>
  );
}

// ──────── Button styles ────────

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    minHeight: 52,
    padding: "16px 24px",
    border: "none",
    borderRadius: 999,
    background: disabled ? "rgba(255,255,255,0.12)" : YELLOW,
    color: disabled ? MUTED : "#0A0608",
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : `0 18px 40px ${YELLOW}33`,
    marginTop: 6,
  };
}

function btnSecondary(): React.CSSProperties {
  return {
    minHeight: 44,
    padding: "12px 18px",
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: 999,
    background: "transparent",
    color: INK,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.04em",
    cursor: "pointer",
    marginTop: 6,
  };
}

function btnGhost(): React.CSSProperties {
  return {
    background: "transparent",
    color: MUTED,
    border: "none",
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
  };
}
