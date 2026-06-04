"use client";

import { useState } from "react";
import {
  useFlow,
  useFlowActions,
  type Audience,
  type Brief,
  type ContentFormat,
  type Goal,
  type Period,
  type Platform,
  type Tone,
} from "../../flow";
import { hapticImpact, hapticNotify, hapticSelection } from "../../lib/telegram";
import { useDraftBackup } from "../../hooks/useDraftBackup";
import {
  ApiError,
  createDraft,
  createWeeklyPlan,
  type DraftFormat,
} from "../../lib/api";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const SUBTLE = "rgba(255,255,255,0.42)";
const WARN = "#F39B40";

// --- Copy per format ---

const H1: Record<ContentFormat, [string, string]> = {
  reel: ["О чём этот Reel?", "Пара строк — соберём транскрипт и монтаж."],
  carousel: ["О чём карусель?", "Соберём цепляющий текст и структуру слайдов."],
  post: ["О чём пост?", "Соберём сильный текст под публикацию."],
  "weekly-plan": ["О чём ваш канал?", "Соберём 7 идей под аудиторию и тон."],
};

const TOPIC_PLACEHOLDER: Record<ContentFormat, string> = {
  reel: "Например: запуск курса по продюсированию для экспертов",
  carousel: "Например: 5 ошибок начинающего инвестора",
  post: "Например: почему я отказался от ИП в пользу самозанятого",
  "weekly-plan": "Например: канал про осознанные финансы для предпринимателей",
};

const CTA_LABEL: Record<ContentFormat, string> = {
  reel: "ЗАГРУЗИТЬ ВИДЕО →",
  carousel: "СОБРАТЬ КАРУСЕЛЬ",
  post: "СОБРАТЬ ПОСТ",
  "weekly-plan": "СОСТАВИТЬ ПЛАН",
};

const EXPAND_LABEL: Record<ContentFormat, string> = {
  reel: "Уточнить аудиторию",
  carousel: "Уточнить аудиторию и цель",
  post: "Уточнить аудиторию и цель",
  "weekly-plan": "Уточнить аудиторию и период",
};

const TONES: { value: Tone; label: string }[] = [
  { value: "confident", label: "Уверенный" },
  { value: "warm", label: "Душевный" },
  { value: "humor", label: "С юмором" },
  { value: "expert", label: "Экспертный" },
  { value: "calm", label: "Спокойный" },
];

const AUDIENCES: { value: Audience; label: string }[] = [
  { value: "entrepreneurs", label: "Предприниматели" },
  { value: "experts", label: "Эксперты-практики" },
  { value: "creators", label: "Креаторы" },
  { value: "youth", label: "Молодёжь 18–28" },
  { value: "mature", label: "Зрелая 35+" },
  { value: "general", label: "Без уточнения" },
];

const GOALS: { value: Goal; label: string }[] = [
  { value: "warm", label: "Прогреть" },
  { value: "sell", label: "Продать" },
  { value: "educate", label: "Просветить" },
  { value: "entertain", label: "Развлечь" },
];

const PERIODS: { value: Period; label: string }[] = [
  { value: "week", label: "7 дней" },
  { value: "biweek", label: "14 дней" },
];

function humanizeBriefError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("quota") || s.includes("limit") || s.includes("лимит")) {
    return "В прошлый раз упёрлись в лимит тарифа. Обновите тариф или дождитесь следующего месяца.";
  }
  if (s.includes("invalid json") || s.includes("writer")) {
    return "Прошлая попытка не получилась — попробуйте сформулировать тему конкретнее.";
  }
  if (s.includes("timeout") || s.includes("502") || s.includes("503")) {
    return "Сервер был перегружен. Попробуйте ещё раз.";
  }
  return raw.length > 100
    ? "Прошлая попытка не удалась. Попробуйте другую формулировку темы."
    : raw;
}

function mapErrorToHuman(e: ApiError): string {
  if (e.status === 402 || e.status === 403) return "Лимит тарифа исчерпан.";
  if (e.status === 401) return "Не удалось авторизоваться. Откройте через @Lex_app_bot.";
  if (e.status >= 500) return "Сервер временно недоступен. Попробуйте через минуту.";
  if (e.status === 404) return "Маршрут не найден. Обновите Mini App.";
  return e.message || "Не получилось. Попробуйте ещё раз.";
}

function defaultPlatformFor(format: ContentFormat): Platform {
  return format === "carousel" ? "instagram" : "telegram";
}

function defaultBriefFor(format: ContentFormat): Brief {
  return {
    topic: "",
    tone: "confident",
    platform: format === "reel" ? undefined : defaultPlatformFor(format),
    audience: "general",
    goal: format === "carousel" || format === "post" ? "educate" : undefined,
    period: format === "weekly-plan" ? "week" : undefined,
  };
}

// --- Component ---

type Props = {
  onSubmit: () => void;
  onBack: () => void;
};

export default function ProjectBriefScreen({ onSubmit, onBack: _onBack }: Props) {
  const { state } = useFlow();
  const actions = useFlowActions();
  // Если как-то попали без format — fallback на "post". Не должно случаться при штатном flow.
  const format: ContentFormat = state.format ?? "post";

  const [brief, setBrief] = useState<Brief>(state.brief ?? defaultBriefFor(format));
  const [expanded, setExpanded] = useState(false);
  const [shake, setShake] = useState(false);
  const [showHelperError, setShowHelperError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Context-banner: пришёл из недельного плана.
  const ideaCtx = state.screenMeta.fromPlanIdea as
    | { topic: string; hook: string | null; format: string }
    | undefined;
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const showIdeaBanner = !!ideaCtx?.topic && !bannerDismissed;

  // Retry-banner: пришёл из failed карточки.
  const retryCtx = state.screenMeta.retryContext as
    | { kind: string; preview: string | null; error: string | null }
    | undefined;
  const showRetryBanner = !!retryCtx && retryCtx.kind !== "reel";

  // Backup brief в localStorage с debounce — back/close не теряет ввод.
  useDraftBackup(`lex.brief.${format}`, brief);

  const patch = <K extends keyof Brief>(key: K, value: Brief[K]) => {
    setBrief((b) => ({ ...b, [key]: value }));
    if (serverError) setServerError(null);
  };

  const persistAndNavigate = async (finalBrief: Brief) => {
    setSubmitting(true);
    setServerError(null);
    try {
      if (format === "weekly-plan") {
        const { planId, projectId } = await createWeeklyPlan({
          brief: finalBrief,
          projectId: state.projectId ?? undefined,
        });
        actions.setIds({ projectId, weeklyPlanId: planId });
      } else if (format === "carousel" || format === "post") {
        const { draftId, projectId } = await createDraft({
          format: format as DraftFormat,
          brief: finalBrief,
          projectId: state.projectId ?? undefined,
        });
        actions.setIds({ projectId, draftId });
      }
      // Reel сюда не попадает (skip brief), но если попадёт — просто навигейтим.
      hapticNotify("success");
      onSubmit();
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? mapErrorToHuman(e)
          : "Не дозвонились до сервера. Проверьте интернет.";
      setServerError(msg);
      hapticImpact("rigid");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (submitting) return;
    const trimmed = brief.topic.trim();
    if (trimmed.length < 8) {
      hapticImpact("rigid");
      setShake(true);
      setShowHelperError(true);
      setTimeout(() => setShake(false), 320);
      return;
    }
    hapticImpact("medium");
    const finalBrief: Brief = { ...brief, topic: trimmed };
    actions.setBrief(finalBrief);
    persistAndNavigate(finalBrief);
  };

  const handleSkip = () => {
    if (submitting) return;
    hapticSelection();
    const skipped: Brief = {
      ...defaultBriefFor(format),
      topic: "auto: соберите по умолчанию",
    };
    actions.setBrief(skipped);
    persistAndNavigate(skipped);
  };

  const [h1, subtitle] = H1[format];
  const showPlatform = format !== "reel";
  const platformOptions: { value: Platform; label: string }[] =
    format === "carousel"
      ? [
          { value: "instagram", label: "Instagram" },
          { value: "telegram", label: "Telegram" },
          { value: "both", label: "И туда, и туда" },
        ]
      : [
          { value: "telegram", label: "Telegram" },
          { value: "instagram", label: "Instagram" },
          { value: "both", label: "Оба" },
        ];

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        padding:
          "max(calc(env(safe-area-inset-top) + 64px), 96px) 22px " +
          "max(calc(env(safe-area-inset-bottom) + 24px), 40px)",
      }}
    >
      {/* TOP ROW: step badge + skip */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: SUBTLE,
          }}
        >
          ШАГ 2
        </span>
        <button
          onClick={handleSkip}
          style={{
            background: "transparent",
            border: "none",
            padding: "6px 0",
            fontSize: 12,
            color: "rgba(245,231,10,0.85)",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Пропустить →
        </button>
      </div>

      {showRetryBanner && !showIdeaBanner && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            background: "rgba(243,155,64,0.08)",
            border: "1px solid rgba(243,155,64,0.35)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#F39B40",
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            ⚠ Попробуем ещё раз
          </div>
          <div style={{ fontSize: 12, color: INK, lineHeight: 1.4 }}>
            {retryCtx!.error
              ? humanizeBriefError(retryCtx!.error)
              : "Прошлая попытка не удалась. Попробуйте другую формулировку темы."}
          </div>
        </div>
      )}

      {showIdeaBanner && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 14,
            background: "rgba(245,231,10,0.08)",
            border: "1px solid rgba(245,231,10,0.35)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(245,231,10,0.9)",
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            ✨ Идея из недельного плана
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: INK,
              lineHeight: 1.4,
              marginBottom: 4,
            }}
          >
            {ideaCtx!.topic}
          </div>
          {ideaCtx!.hook && (
            <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.4 }}>
              Hook: {ideaCtx!.hook}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={() => {
                if (submitting) return;
                handleSubmit();
              }}
              disabled={submitting}
              style={{
                appearance: "none",
                flex: 1,
                padding: "10px 14px",
                borderRadius: 999,
                border: "none",
                background: "#F5E70A",
                color: "#0A0608",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: submitting ? "default" : "pointer",
                fontFamily: "inherit",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "СОБИРАЕМ…" : "Собрать сразу"}
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              disabled={submitting}
              style={{
                appearance: "none",
                padding: "10px 14px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "transparent",
                color: INK,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Редактировать
            </button>
          </div>
        </div>
      )}

      {/* HEADING */}
      <h1
        style={{
          margin: "12px 0 0",
          fontSize: 30,
          lineHeight: 1.02,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
          transform: shake ? "translateX(-4px)" : undefined,
          transition: shake ? "transform 80ms ease-out" : undefined,
        }}
      >
        {h1}
      </h1>
      <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.4, color: MUTED }}>
        {subtitle}
      </p>

      {/* ТЕМА */}
      <Field
        label="ТЕМА"
        helper={
          showHelperError
            ? "Слишком коротко — добавьте пару слов для качества."
            : "Чем конкретнее — тем точнее результат."
        }
        helperWarn={showHelperError}
      >
        <textarea
          value={brief.topic}
          onChange={(e) => {
            patch("topic", e.target.value);
            if (showHelperError) setShowHelperError(false);
          }}
          placeholder={TOPIC_PLACEHOLDER[format]}
          rows={3}
          maxLength={280}
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "rgba(255,255,255,0.04)",
            color: INK,
            border: `1px solid ${
              showHelperError ? "rgba(245,80,80,0.5)" : "rgba(255,255,255,0.10)"
            }`,
            borderRadius: 16,
            padding: "12px 14px",
            fontFamily: "inherit",
            fontSize: 15,
            lineHeight: 1.4,
            outline: "none",
            resize: "none",
          }}
        />
      </Field>

      {/* PLATFORM (только не для Reel) */}
      {showPlatform && (
        <Field label="ПЛАТФОРМА">
          <Chips
            options={platformOptions}
            value={brief.platform ?? defaultPlatformFor(format)}
            onChange={(v) => patch("platform", v as Platform)}
          />
        </Field>
      )}

      {/* TONE */}
      <Field label="ТОН">
        <Chips
          options={TONES}
          value={brief.tone}
          onChange={(v) => patch("tone", v as Tone)}
          wrap
        />
      </Field>

      {/* EXPAND */}
      <button
        onClick={() => {
          hapticSelection();
          setExpanded((x) => !x);
        }}
        style={{
          marginTop: 18,
          padding: "8px 0",
          background: "transparent",
          border: "none",
          textAlign: "left",
          color: MUTED,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {expanded ? "– Свернуть" : `+ ${EXPAND_LABEL[format]}`}
      </button>

      {expanded && (
        <>
          <Field label="АУДИТОРИЯ">
            <Chips
              options={AUDIENCES}
              value={brief.audience ?? "general"}
              onChange={(v) => patch("audience", v as Audience)}
              wrap
            />
          </Field>
          {(format === "carousel" || format === "post") && (
            <Field label="ЦЕЛЬ ПОСТА">
              <Chips
                options={GOALS}
                value={brief.goal ?? "educate"}
                onChange={(v) => patch("goal", v as Goal)}
                wrap
              />
            </Field>
          )}
          {format === "weekly-plan" && (
            <Field label="ПЕРИОД">
              <Chips
                options={PERIODS}
                value={brief.period ?? "week"}
                onChange={(v) => patch("period", v as Period)}
              />
            </Field>
          )}
        </>
      )}

      {/* SPACER → CTA прижата вниз */}
      <div style={{ flex: 1, minHeight: 28 }} />

      {/* Server error (inline) */}
      {serverError && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: 14,
            background: "rgba(245,80,80,0.08)",
            border: "1px solid rgba(245,80,80,0.25)",
            color: "#F39B40",
            fontSize: 13,
            lineHeight: 1.35,
          }}
        >
          {serverError}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        style={{
          width: "100%",
          minHeight: 56,
          padding: "18px 0",
          border: "none",
          borderRadius: 999,
          background: YELLOW,
          color: "#0A0608",
          fontSize: 17,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          boxShadow:
            "0 22px 52px rgba(245,231,10,0.30), 0 0 0 1px rgba(255,255,255,0.12) inset",
          cursor: submitting ? "default" : "pointer",
          opacity: submitting ? 0.7 : 1,
          transition: "opacity 160ms ease",
        }}
      >
        {submitting ? "СОБИРАЕМ…" : CTA_LABEL[format]}
      </button>
    </div>
  );
}

// --- Inline UI primitives (пока не нужны в других экранах — живут здесь) ---

function Field({
  label,
  helper,
  helperWarn,
  children,
}: {
  label: string;
  helper?: string;
  helperWarn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.14em",
          color: SUBTLE,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {children}
      {helper && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: helperWarn ? WARN : "rgba(255,255,255,0.42)",
            lineHeight: 1.35,
          }}
        >
          {helper}
        </div>
      )}
    </div>
  );
}

function Chips({
  options,
  value,
  onChange,
  wrap,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  wrap?: boolean;
}) {
  return (
    <div
      className={!wrap ? "no-scrollbar" : undefined}
      style={{
        display: "flex",
        gap: 8,
        flexWrap: wrap ? "wrap" : undefined,
        overflowX: wrap ? undefined : "auto",
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => {
              hapticSelection();
              onChange(opt.value);
            }}
            style={{
              flex: "0 0 auto",
              padding: "9px 14px",
              borderRadius: 999,
              background: active ? YELLOW : "rgba(255,255,255,0.045)",
              color: active ? "#0A0608" : INK,
              border: `1px solid ${active ? YELLOW : "rgba(255,255,255,0.10)"}`,
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
