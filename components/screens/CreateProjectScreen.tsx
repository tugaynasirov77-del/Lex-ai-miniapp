"use client";

import { useEffect, useState } from "react";
import { useFlow, useFlowActions } from "../../flow";
import {
  ApiError,
  attachChannel,
  attachInstagram,
  createProject,
  listProjects,
  type ProjectDTO,
} from "../../lib/api";
import {
  hapticImpact,
  hapticNotify,
  hapticSelection,
  openTelegramLink,
} from "../../lib/telegram";
import {
  addBotToChannelLink,
  LEX_BOT_USERNAME,
} from "../../lib/telegramBot";
import TapToCopy from "../TapToCopy";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const WARN = "#F39B40";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const BOT_DISPLAY = `@${LEX_BOT_USERNAME}`;

type Props = { onBack: () => void };
type Platform = "telegram" | "instagram";
type Step = "platform" | "attach";

/**
 * Единый onboarding-экран.
 * Шаг 1 (platform) — выбор платформы + название → createProject.
 * Шаг 2 (attach)   — привязка канала/аккаунта прямо здесь, без ухода в Settings.
 *
 * Resume: если в FlowState уже есть projectId (восстановлено из localStorage),
 * на mount подтягиваем проект из listProjects и сразу прыгаем на шаг attach
 * с правильной платформой. Если проект уже привязан — уводим в /project.
 */
export default function CreateProjectScreen({ onBack: _onBack }: Props) {
  const { state } = useFlow();
  const actions = useFlowActions();

  const [step, setStep] = useState<Step>(state.projectId ? "attach" : "platform");
  const [platform, setPlatform] = useState<Platform | null>("instagram");
  const [title, setTitle] = useState("");
  const [resuming, setResuming] = useState<boolean>(!!state.projectId);

  // Resume: если projectId уже в стейте — узнаём платформу и факт привязки.
  useEffect(() => {
    if (!state.projectId) {
      setResuming(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await listProjects();
        const p = r.projects.find((x) => x.id === state.projectId);
        if (cancelled) return;
        if (!p) {
          // Проект удалён — чистим и начинаем сначала.
          actions.setIds({ projectId: null });
          setStep("platform");
          setResuming(false);
          return;
        }
        const alreadyAttached =
          (p.platform === "telegram" && !!p.channel_username) ||
          (p.platform === "instagram" && !!p.instagram_username);
        if (alreadyAttached) {
          // Привязка уже была — onboarding закончен, в проект.
          actions.navigate("project");
          return;
        }
        setPlatform(p.platform);
        setStep("attach");
        setResuming(false);
      } catch {
        // Сеть упала — пусть юзер хотя бы начнёт сначала.
        if (!cancelled) {
          actions.setIds({ projectId: null });
          setStep("platform");
          setResuming(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (resuming) {
    return (
      <ScreenWrap>
        <div style={{ flex: 1 }} />
        <div style={{ color: MUTED, fontSize: 13, textAlign: "center" }}>
          Восстанавливаем подключение…
        </div>
        <div style={{ flex: 1 }} />
      </ScreenWrap>
    );
  }

  if (step === "platform") {
    return (
      <PlatformStep
        title={title}
        onTitle={setTitle}
        onSubmit={async (setup) => {
          hapticImpact("medium");
          const { projectId } = await createProject({
            title: title.trim(),
            platform: "instagram",
            ...setup,
          });
          hapticNotify("success");
          actions.setIds({ projectId });
          setStep("attach");
        }}
      />
    );
  }

  // step === "attach"
  if (!platform || !state.projectId) {
    // Defensive — теоретически не должны попасть сюда.
    setStep("platform");
    return null;
  }

  return (
    <AttachStep
      platform={platform}
      projectId={state.projectId}
      onAttached={() => {
        hapticNotify("success");
        if (platform === "instagram") {
          // IG: ниша уже сохранена → сразу в рабочий экран
          actions.navigate("project");
          return;
        }
        // TG: ещё нужно добавить конкурентов
        actions.setScreenMeta("onboardingPlatform", platform);
        actions.navigate("add-competitors");
      }}
      onSkip={() => {
        hapticImpact("light");
        // Skip минует onboarding пайплайн — конкурентов добавить можно позже.
        actions.navigate("project");
      }}
      onChangePlatform={() => {
        hapticSelection();
        // Откатываем projectId — иначе resume снова прыгнет на attach.
        actions.setIds({ projectId: null });
        setPlatform(null);
        setStep("platform");
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// STEP 1: platform + title
// ---------------------------------------------------------------------------

type OnCamera = "yes" | "sometimes" | "no";

type QuickSetup = {
  niche: string;
  audience: string;
  content_goal: string;
  content_style: string;
  on_camera: OnCamera;
  what_sells: string;
  content_language: string;
};

const GOAL_OPTIONS: { label: string; value: string }[] = [
  { label: "Охваты", value: "Охваты" },
  { label: "Продажи", value: "Продажи" },
  { label: "Экспертность", value: "Экспертность" },
  { label: "Личный бренд", value: "Личный бренд" },
  { label: "Вовлечение", value: "Вовлечение" },
];

const STYLE_OPTIONS: { label: string; value: string }[] = [
  { label: "Экспертный", value: "Экспертный" },
  { label: "Разговорный", value: "Разговорный" },
  { label: "Дерзкий", value: "Дерзкий" },
  { label: "Спокойный", value: "Спокойный" },
  { label: "Юмористический", value: "Юмористический" },
  { label: "Вдохновляющий", value: "Вдохновляющий" },
];

const ON_CAMERA_OPTIONS: { label: string; value: OnCamera }[] = [
  { label: "Да", value: "yes" },
  { label: "Иногда", value: "sometimes" },
  { label: "Нет", value: "no" },
];

const LANGUAGE_OPTIONS: { label: string; value: string }[] = [
  { label: "Русский", value: "ru" },
  { label: "Английский", value: "en" },
  { label: "Другой", value: "other" },
];

function PlatformStep({
  title,
  onTitle,
  onSubmit,
}: {
  title: string;
  onTitle: (v: string) => void;
  onSubmit: (setup: QuickSetup) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");
  const [contentStyle, setContentStyle] = useState("");
  const [onCamera, setOnCamera] = useState<OnCamera | "">("");
  const [whatSells, setWhatSells] = useState("");
  const [language, setLanguage] = useState("ru"); // Русский по умолчанию

  const clearError = () => {
    if (error) setError(null);
  };

  const canSubmit =
    title.trim().length >= 2 &&
    niche.trim().length >= 2 &&
    audience.trim().length >= 2 &&
    goal !== "" &&
    contentStyle !== "" &&
    onCamera !== "" &&
    language !== "" &&
    !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        niche: niche.trim(),
        audience: audience.trim(),
        content_goal: goal,
        content_style: contentStyle,
        on_camera: onCamera,
        what_sells: whatSells.trim(),
        content_language: language,
      });
    } catch (e) {
      hapticNotify("error");
      setError(
        e instanceof ApiError
          ? e.status === 401
            ? "Сессия истекла. Перезапустите Mini App."
            : e.message
          : e instanceof Error
            ? e.message
            : "Не получилось. Попробуйте ещё раз.",
      );
      setBusy(false);
    }
  };

  return (
    <ScreenWrap>
      <StepBadge current={1} total={2} label="Проект" />
      <h1
        style={{
          margin: "10px 0 0",
          fontSize: 26,
          lineHeight: 1.1,
          fontWeight: 800,
          letterSpacing: "-0.02em",
        }}
      >
        Настроим LEX под твой блог
      </h1>
      <p style={{ margin: "10px 0 0", fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
        Ответь на пару вопросов — и LEX будет писать сценарии и идеи под твою
        нишу и стиль, а не шаблонные. Это займёт минуту.
      </p>

      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 20 }}>
        <Field label="Название проекта">
          <input
            value={title}
            onChange={(e) => {
              onTitle(e.target.value);
              clearError();
            }}
            maxLength={60}
            placeholder="Например: Мой блог про маркетинг"
            style={inputStyle}
          />
        </Field>

        <Field label="Тема / ниша блога">
          <input
            value={niche}
            onChange={(e) => {
              setNiche(e.target.value);
              clearError();
            }}
            maxLength={80}
            placeholder="Например: маркетинг для экспертов"
            style={inputStyle}
          />
        </Field>

        <Field label="Целевая аудитория">
          <input
            value={audience}
            onChange={(e) => {
              setAudience(e.target.value);
              clearError();
            }}
            maxLength={120}
            placeholder="Например: эксперты и предприниматели 25–45"
            style={inputStyle}
          />
        </Field>

        <Field label="Главная цель контента">
          <ChipGroup
            options={GOAL_OPTIONS}
            value={goal}
            onChange={(v) => {
              setGoal(v);
              clearError();
            }}
          />
        </Field>

        <Field label="Стиль подачи">
          <ChipGroup
            options={STYLE_OPTIONS}
            value={contentStyle}
            onChange={(v) => {
              setContentStyle(v);
              clearError();
            }}
          />
        </Field>

        <Field label="Готовы сниматься лицом?">
          <ChipGroup
            options={ON_CAMERA_OPTIONS}
            value={onCamera}
            onChange={(v) => {
              setOnCamera(v);
              clearError();
            }}
          />
        </Field>

        <Field label="Что продаёте / продвигаете (необязательно)">
          <input
            value={whatSells}
            onChange={(e) => {
              setWhatSells(e.target.value);
              clearError();
            }}
            maxLength={120}
            placeholder="Например: курс по продажам в Reels"
            style={inputStyle}
          />
        </Field>

        <Field label="Язык контента">
          <ChipGroup
            options={LANGUAGE_OPTIONS}
            value={language}
            onChange={(v) => {
              setLanguage(v);
              clearError();
            }}
          />
        </Field>
      </div>

      <div style={{ flex: 1, minHeight: 16 }} />

      {error && (
        <p
          style={{
            fontSize: 12,
            color: WARN,
            textAlign: "center",
            margin: "0 0 10px",
          }}
        >
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={!canSubmit}
        style={{
          ...primaryBtn,
          opacity: canSubmit ? 1 : 0.4,
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
      >
        {busy ? "СОЗДАЁМ…" : "ПРОДОЛЖИТЬ"}
      </button>
    </ScreenWrap>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T | "";
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              hapticImpact("light");
              onChange(o.value);
            }}
            style={{
              appearance: "none",
              padding: "8px 14px",
              borderRadius: 999,
              border: `1px solid ${active ? YELLOW : "rgba(255,255,255,0.10)"}`,
              background: active ? "rgba(245,231,10,0.10)" : "transparent",
              color: active ? YELLOW : INK,
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEP 2: attach (TG/IG inline, без ухода в Settings)
// ---------------------------------------------------------------------------

function AttachStep({
  platform,
  projectId,
  onAttached,
  onSkip,
  onChangePlatform,
}: {
  platform: Platform;
  projectId: string;
  onAttached: (p: ProjectDTO) => void;
  onSkip: () => void;
  onChangePlatform: () => void;
}) {
  return (
    <ScreenWrap>
      <StepBadge
        current={2}
        total={2}
        label={platform === "instagram" ? "Ниша" : "Подключение"}
      />
      <h1
        style={{
          margin: "10px 0 0",
          fontSize: 28,
          lineHeight: 1.05,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
        }}
      >
        {platform === "telegram" ? (
          <>
            Подключите
            <br />
            канал
          </>
        ) : (
          <>Выбери нишу</>
        )}
      </h1>
      {platform === "telegram" && (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
          Чтобы агенты публиковали посты — добавьте бота в канал админом и привяжите
          его здесь.
        </p>
      )}

      <div style={{ marginTop: 18 }}>
        {platform === "telegram" ? (
          <TgAttachInline projectId={projectId} onAttached={onAttached} />
        ) : (
          <IgAttachInline projectId={projectId} onAttached={onAttached} />
        )}
      </div>

      <div style={{ flex: 1 }} />

      <button
        onClick={onChangePlatform}
        style={{
          background: "transparent",
          border: "none",
          color: MUTED,
          fontSize: 12,
          fontFamily: "inherit",
          padding: "8px 0",
          cursor: "pointer",
          alignSelf: "center",
        }}
      >
        ← Изменить платформу
      </button>
      {/* Skip-кнопка только для TG (для IG в один тап выбираешь нишу) */}
      {platform === "telegram" && (
        <button
          onClick={onSkip}
          style={{
            background: "transparent",
            border: `1px solid ${CARD_BORDER}`,
            color: INK,
            fontSize: 13,
            fontFamily: "inherit",
            padding: "12px 0",
            borderRadius: 999,
            cursor: "pointer",
            marginTop: 6,
            marginBottom: 6,
          }}
        >
          ПРОПУСТИТЬ ПОКА
        </button>
      )}
    </ScreenWrap>
  );
}

function TgAttachInline({
  projectId,
  onAttached,
}: {
  projectId: string;
  onAttached: (p: ProjectDTO) => void;
}) {
  const [channel, setChannel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ message: string; needAdmin?: boolean } | null>(
    null,
  );

  const addBot = () => {
    hapticImpact("light");
    openTelegramLink(addBotToChannelLink());
  };

  const submit = async () => {
    const c = channel.trim();
    if (!c) return;
    setBusy(true);
    setErr(null);
    hapticImpact("light");
    try {
      const r = await attachChannel(projectId, { channel: c });
      const project = (r as { project?: ProjectDTO }).project;
      if (!project) throw new ApiError(500, "Не получили данные канала.");
      onAttached(project);
    } catch (e) {
      hapticNotify("error");
      if (e instanceof ApiError) {
        const message = e.message || "Не получилось подключить.";
        setErr({
          message,
          needAdmin: /админ|administrator|bot_not_in_channel|bot_not_admin/i.test(
            message,
          ),
        });
      } else {
        setErr({ message: e instanceof Error ? e.message : "Не получилось." });
      }
      setBusy(false);
    }
  };

  return (
    <div>
      {/* Инструкция: видна ДО submit. Primary путь — deep link
          (один тап → Telegram chooser → бот сразу админ с нужными правами).
          Fallback — ручной путь с tap-to-copy username для тех случаев,
          когда deep link не сработал. */}
      <div
        style={{
          background: "rgba(40,160,235,0.06)",
          border: `1px solid rgba(40,160,235,0.25)`,
          borderRadius: 14,
          padding: 14,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#28A0EB",
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          Шаг 1: добавьте бота в канал
        </div>
        <button
          onClick={addBot}
          style={{
            appearance: "none",
            width: "100%",
            padding: "12px 14px",
            border: "none",
            borderRadius: 12,
            background: "#28A0EB",
            color: "#FFFFFF",
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            cursor: "pointer",
            boxShadow: "0 8px 20px rgba(40,160,235,0.35)",
          }}
        >
          Добавить бота в канал →
        </button>
        <div
          style={{
            fontSize: 11,
            color: MUTED,
            marginTop: 8,
            lineHeight: 1.45,
          }}
        >
          Telegram откроет список ваших каналов — тапните нужный, бот сразу
          станет админом с правами на публикацию.
        </div>
        <details style={{ marginTop: 10, fontSize: 12, color: MUTED }}>
          <summary
            style={{
              cursor: "pointer",
              fontSize: 11,
              color: "#28A0EB",
              fontWeight: 700,
            }}
          >
            Не сработало? Добавить вручную
          </summary>
          <div style={{ marginTop: 8, lineHeight: 1.55 }}>
            Канал → «Управление» → «Администраторы» → «Добавить» → найдите{" "}
            <TapToCopy
              text={BOT_DISPLAY}
              display={BOT_DISPLAY}
              style={{
                background: "rgba(40,160,235,0.18)",
                border: "none",
                color: "#28A0EB",
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 6,
                cursor: "pointer",
              }}
            />
            . Дайте право «Публикация сообщений».
          </div>
        </details>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#28A0EB",
            fontWeight: 700,
            marginTop: 14,
            marginBottom: 0,
          }}
        >
          Шаг 2: введите @username канала ниже
        </div>
      </div>

      <Label>@username канала</Label>
      <input
        value={channel}
        onChange={(e) => {
          setChannel(e.target.value);
          if (err) setErr(null);
        }}
        placeholder="@my_channel"
        maxLength={80}
        style={inputStyle}
      />
      {err && (
        <div
          style={{
            marginTop: 8,
            padding: "10px 12px",
            background: "rgba(243,155,64,0.08)",
            border: `1px solid rgba(243,155,64,0.3)`,
            borderRadius: 12,
            fontSize: 12,
            color: WARN,
            lineHeight: 1.45,
          }}
        >
          {err.message}
          {err.needAdmin && (
            <div style={{ marginTop: 4, color: MUTED }}>
              Сделайте бота админом канала и нажмите «ПРОВЕРИТЬ ЕЩЁ РАЗ».
            </div>
          )}
        </div>
      )}
      <button
        onClick={submit}
        disabled={busy || !channel.trim()}
        style={{
          ...primaryBtn,
          marginTop: 14,
          opacity: busy || !channel.trim() ? 0.4 : 1,
        }}
      >
        {busy ? "ПРОВЕРЯЕМ…" : err ? "ПРОВЕРИТЬ ЕЩЁ РАЗ" : "ПОДКЛЮЧИТЬ КАНАЛ"}
      </button>
    </div>
  );
}

const IG_NICHES = [
  "Бизнес",
  "Личный бренд",
  "Эксперт",
  "Образование",
  "Лайфстайл",
  "Маркетинг",
  "Финансы",
  "Здоровье",
  "Мода",
  "Еда",
  "Психология",
  "Технологии",
];

function IgAttachInline({
  projectId,
  onAttached,
}: {
  projectId: string;
  onAttached: (p: ProjectDTO) => void;
}) {
  const [niche, setNiche] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = niche.length > 0;

  const submit = async () => {
    if (!niche) return;
    setBusy(true);
    setErr(null);
    hapticImpact("light");
    try {
      // Сохраняем нишу в brand_kit — LEX будет переписывать сценарии под неё
      const { saveBrandSetup, getProject } = await import("../../lib/api");
      await saveBrandSetup(projectId, {
        niche,
        description: niche,
        audience: "",
        tone: "",
      });
      const proj = await getProject(projectId);
      onAttached(proj.project);
    } catch (e) {
      hapticNotify("error");
      setErr(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Не получилось.",
      );
      setBusy(false);
    }
  };

  return (
    <div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
        LEX будет адаптировать сценарии разобранных Reels под твою тематику.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {IG_NICHES.map((n) => {
          const active = niche === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => {
                hapticImpact("light");
                setNiche(n);
              }}
              style={{
                appearance: "none",
                padding: "8px 14px",
                borderRadius: 999,
                border: `1px solid ${active ? YELLOW : "rgba(255,255,255,0.10)"}`,
                background: active ? "rgba(245,231,10,0.10)" : "transparent",
                color: active ? YELLOW : INK,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      {err && (
        <div
          style={{
            marginTop: 8,
            padding: "10px 12px",
            background: "rgba(243,155,64,0.08)",
            border: `1px solid rgba(243,155,64,0.3)`,
            borderRadius: 12,
            fontSize: 12,
            color: WARN,
          }}
        >
          {err}
        </div>
      )}
      <button
        onClick={submit}
        disabled={busy || !canSubmit}
        style={{
          ...primaryBtn,
          marginTop: 18,
          opacity: busy || !canSubmit ? 0.4 : 1,
        }}
      >
        {busy ? "СОХРАНЯЕМ…" : "ГОТОВО — НАЧАТЬ РАЗБОР REELS"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// shared bits
// ---------------------------------------------------------------------------

function StepBadge({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: MUTED,
        fontWeight: 600,
      }}
    >
      <span style={{ color: YELLOW }}>
        Шаг {current}/{total}
      </span>
      <span style={{ opacity: 0.5 }}>·</span>
      <span>{label}</span>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: MUTED,
        marginBottom: 8,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
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
          "max(calc(env(safe-area-inset-top) + 64px), 96px) 22px " +
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 14,
  color: INK,
  fontSize: 15,
  fontFamily: "inherit",
  padding: "14px 16px",
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  minHeight: 56,
  padding: "18px 0",
  border: "none",
  borderRadius: 999,
  background: YELLOW,
  color: "#0A0608",
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
  boxShadow: `0 20px 48px ${YELLOW}33, 0 0 0 1px rgba(255,255,255,0.12) inset`,
};
