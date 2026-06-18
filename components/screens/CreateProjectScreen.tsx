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
        platform={platform}
        title={title}
        onPlatform={(p) => {
          hapticSelection();
          setPlatform(p);
        }}
        onTitle={setTitle}
        onSubmit={async () => {
          if (!platform) return;
          hapticImpact("medium");
          const { projectId } = await createProject({
            title: title.trim(),
            platform,
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

function PlatformStep({
  platform,
  title,
  onPlatform,
  onTitle,
  onSubmit,
}: {
  platform: Platform | null;
  title: string;
  onPlatform: (p: Platform) => void;
  onTitle: (v: string) => void;
  onSubmit: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!platform && title.trim().length >= 2 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit();
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
          fontSize: 28,
          lineHeight: 1.05,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
        }}
      >
        Создаём
        <br />
        Instagram-проект
      </h1>
      <p style={{ margin: "10px 0 0", fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
        Один проект = один аккаунт Instagram.
      </p>

      <div
        style={{
          marginTop: 20,
          padding: "16px 14px",
          borderRadius: 18,
          border: `1.5px solid ${YELLOW}`,
          background: "rgba(245,231,10,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            flexShrink: 0,
            borderRadius: 14,
            background: "linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 22px rgba(221,42,123,0.36), 0 0 0 1px rgba(255,255,255,0.14) inset",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="#FFFFFF" strokeWidth="1.9" />
            <circle cx="12" cy="12" r="4" stroke="#FFFFFF" strokeWidth="1.9" />
            <circle cx="17.2" cy="6.8" r="1.2" fill="#FFFFFF" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Instagram</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
            Разборы Reels, сценарии, карусели, подписи
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <Label>Название проекта</Label>
        <input
          value={title}
          onChange={(e) => {
            onTitle(e.target.value);
            if (error) setError(null);
          }}
          maxLength={60}
          placeholder="Например: Мой канал про маркетинг"
          style={inputStyle}
        />
      </div>

      <div style={{ flex: 1 }} />

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
        {busy ? "СОЗДАЁМ…" : "ДАЛЬШЕ"}
      </button>
    </ScreenWrap>
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
