"use client";

import { useEffect, useState } from "react";
import { useFlowActions } from "../../flow";
import { hapticImpact, hapticNotify, hapticSelection } from "../../lib/telegram";
import { createProject } from "../../lib/api";
import { markOnboardingDone } from "../../lib/api";
import { ONBOARDING_LS_KEY } from "../../hooks/useWelcomeGate";

// ─── Гамма главной ───
const BG = "#0B0B11";
const INK = "#F4F4F8";
const MUTED = "#9A9AAB";
const SUB_MUTED = "#6B6B7B";
const CARD_BG = "#15151E";
const CARD_BORDER = "#262630";
const SOFT = "#1C1C26";
const IG_GRADIENT = "linear-gradient(95deg, #A24FD6 0%, #E84B91 50%, #F88A4A 100%)";
const PINK = "#E84B91";
const PURPLE = "#A24FD6";

const TOTAL_STEPS = 6;

type NicheKey = "business" | "marketing" | "fitness" | "psychology" | "lifestyle" | "other";

type NicheOpt = { key: NicheKey; label: string; icon: React.ReactNode };
const NICHE_OPTIONS: NicheOpt[] = [
  { key: "business", label: "Бизнес", icon: <BriefcaseIcon /> },
  { key: "marketing", label: "Маркетинг", icon: <MegaphoneIcon /> },
  { key: "fitness", label: "Фитнес", icon: <DumbbellIcon /> },
  { key: "psychology", label: "Психология", icon: <BrainIcon /> },
  { key: "lifestyle", label: "Lifestyle", icon: <PalmIcon /> },
  { key: "other", label: "Другое", icon: <DotsIcon /> },
];

type AudienceKey = "entrepreneurs" | "experts" | "beginners" | "bloggers" | "men_20_35" | "women_20_35";
type AudienceOpt = { key: AudienceKey; label: string; icon: React.ReactNode };
const AUDIENCE_OPTIONS: AudienceOpt[] = [
  { key: "entrepreneurs", label: "Предприниматели", icon: <BriefcaseIcon /> },
  { key: "experts", label: "Эксперты", icon: <GradCapIcon /> },
  { key: "beginners", label: "Новички", icon: <RocketIcon /> },
  { key: "bloggers", label: "Блогеры", icon: <ReelIcon /> },
  { key: "men_20_35", label: "Мужчины 20–35", icon: <ManIcon /> },
  { key: "women_20_35", label: "Женщины 20–35", icon: <WomanIcon /> },
];

type GoalKey = "views" | "subscribers" | "sales" | "personal_brand";
type GoalOpt = { key: GoalKey; label: string; description: string; icon: React.ReactNode };
const GOAL_OPTIONS: GoalOpt[] = [
  { key: "views", label: "Просмотры", description: "Максимальный viral potential", icon: <BarChartIcon /> },
  { key: "subscribers", label: "Подписчики", description: "Конвертация зрителей в аудиторию", icon: <UsersIcon /> },
  { key: "sales", label: "Продажи", description: "Контент, который продаёт", icon: <BagIcon /> },
  { key: "personal_brand", label: "Личный бренд", description: "Рост доверия и узнаваемости", icon: <StarIcon /> },
];

type StyleKey = "provocative" | "expert" | "friendly" | "premium" | "analytical" | "mix";
type StyleOpt = { key: StyleKey; label: string; description: string; icon: React.ReactNode };
const STYLE_OPTIONS: StyleOpt[] = [
  { key: "provocative", label: "Провокационный", description: "Ломаешь шаблоны, цепляешь с первых секунд", icon: <FlameIcon /> },
  { key: "expert", label: "Экспертный", description: "Умный, структурный, с авторитетом", icon: <GradCapIcon /> },
  { key: "friendly", label: "Дружелюбный", description: "Лёгкий, живой, conversational", icon: <SmileIcon /> },
  { key: "premium", label: "Premium", description: "Дорогой, уверенный, статусный", icon: <DiamondIcon /> },
  { key: "analytical", label: "Аналитический", description: "Через факты, логику и инсайты", icon: <BrainIcon /> },
  { key: "mix", label: "Микс", description: "AI комбинирует стили для лучшего результата", icon: <MasksIcon /> },
];

export default function OnboardingWizardScreen() {
  const actions = useFlowActions();
  const [step, setStep] = useState(1);
  const [niche, setNiche] = useState<NicheKey | null>(null);
  const [audience, setAudience] = useState<AudienceKey | null>(null);
  const [styleVoice, setStyleVoice] = useState<StyleKey | null>(null);
  const [goal, setGoal] = useState<GoalKey | null>(null);

  const progressPct = Math.round((step / TOTAL_STEPS) * 100);
  const canNext =
    step === 1 ? !!niche
    : step === 2 ? !!audience
    : step === 3 ? !!styleVoice
    : step === 4 ? !!goal
    : false;

  const hint =
    step === 1
      ? { title: "AI адаптируется под твою нишу", body: "Чем точнее ответишь, тем лучше будут сценарии." }
      : step === 2
      ? { title: "AI адаптирует сценарии", body: "Под язык, боли и интересы твоей аудитории." }
      : step === 3
      ? { title: "AI учит твой tone of voice", body: "Чем точнее стиль — тем естественнее сценарии." }
      : step === 4
      ? { title: "AI будет фокусироваться на твоей цели", body: "Чем точнее цель — тем лучше результат." }
      : { title: "AI адаптируется под твой ответ", body: "Чем точнее — тем лучше сценарии." };

  const onNext = () => {
    hapticImpact("medium");
    // TODO: остальные шаги (2-6) и финальный createProject.
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const onSkip = () => {
    hapticSelection();
    actions.navigate("home");
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: BG,
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding:
          "max(calc(env(safe-area-inset-top) + 56px), 88px) 18px " +
          "max(calc(env(safe-area-inset-bottom) + 12px), 18px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Хедер: пусто слева + «Пропустить» справа */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button
          onClick={onSkip}
          style={{
            appearance: "none", background: SOFT, border: `1px solid ${CARD_BORDER}`,
            borderRadius: 999, padding: "5px 11px", color: MUTED, fontFamily: "inherit",
            fontSize: 11.5, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <XIcon /> Пропустить
        </button>
      </div>

      {/* Прогресс */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ height: 5, borderRadius: 999, background: SOFT, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: IG_GRADIENT, transition: "width 320ms ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10.5, color: SUB_MUTED, fontWeight: 600, letterSpacing: "0.02em" }}>
          <span>Шаг {step} из {TOTAL_STEPS}</span>
          <span>
            {step === 5 ? "Завершаем настройку…" : step === 6 ? "Готово!" : `${progressPct}%`}
          </span>
        </div>
      </div>

      {/* spacer — толкает контент чуть вниз (на шагах 5/6 контент сам крупный) */}
      <div style={{ height: step === 5 || step === 6 ? 0 : 60 }} />

      {/* Заголовок шага */}
      {step === 1 && (
        <NicheStep
          niche={niche}
          onPick={(k) => { hapticSelection(); setNiche(k); }}
        />
      )}

      {step === 2 && (
        <AudienceStep
          audience={audience}
          onPick={(k) => { hapticSelection(); setAudience(k); }}
        />
      )}

      {step === 3 && (
        <StyleStep
          style={styleVoice}
          onPick={(k) => { hapticSelection(); setStyleVoice(k); }}
        />
      )}

      {step === 4 && (
        <GoalStep
          goal={goal}
          onPick={(k) => { hapticSelection(); setGoal(k); }}
        />
      )}

      {step === 5 && (
        <BuildingProfileStep onDone={() => setStep(6)} />
      )}

      {step === 6 && (
        <SuccessStep
          niche={niche}
          audience={audience}
          styleVoice={styleVoice}
          goal={goal}
          onFinish={async () => {
            hapticImpact("medium");
            try {
              const r = await createProject({
                title: niche ? `Блог · ${NICHE_LABEL[niche]}` : "Мой блог",
                platform: "instagram",
                niche: niche ? NICHE_LABEL[niche] : "",
                audience: audience ? AUDIENCE_LABEL[audience] : "",
                content_goal: goal ? GOAL_LABEL[goal] : "",
                content_style: styleVoice ? STYLE_LABEL[styleVoice] : "",
                on_camera: "sometimes",
                content_language: "ru",
              });
              actions.setIds({ projectId: r.projectId });
            } catch {
              /* без проекта тоже отпустим — анкета на крайний случай */
            }
            try { localStorage.setItem(ONBOARDING_LS_KEY, "1"); } catch {}
            markOnboardingDone().catch(() => {});
            hapticNotify("success");
            actions.navigate("home");
          }}
        />
      )}

      {/* AI-подсказка (на шаге 5 другая — внутри BuildingProfileStep) */}
      {step !== 5 && step !== 6 && (
        <div style={{
          marginTop: 12, marginBottom: 10,
          background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14,
          padding: 10, display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: IG_GRADIENT,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 6px 16px ${PINK}40`,
          }}>
            <SparkleIcon size={15} color="#FFFFFF" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: INK, lineHeight: 1.25 }}>
              {hint.title}
            </div>
            <div style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.3, marginTop: 2 }}>
              {hint.body}
            </div>
          </div>
        </div>
      )}

      {/* CTA (на шаге 5 авто — без кнопки) */}
      {step !== 5 && step !== 6 && (
        <button
          onClick={onNext}
          disabled={!canNext}
          style={{
            appearance: "none", width: "100%", padding: "13px 0", border: "none", borderRadius: 14,
            background: IG_GRADIENT, color: "#FFFFFF", fontSize: 14, fontWeight: 800,
            letterSpacing: "0.01em", fontFamily: "inherit",
            cursor: canNext ? "pointer" : "not-allowed",
            opacity: canNext ? 1 : 0.4,
            boxShadow: canNext ? `0 14px 32px ${PINK}50` : "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          Далее <ArrowIcon />
        </button>
      )}
    </div>
  );
}

// ───────── Шаг 1: ниша ─────────

function NicheStep({ niche, onPick }: { niche: NicheKey | null; onPick: (k: NicheKey) => void }) {
  return (
    <ChoiceGrid
      title="Какая у тебя ниша?"
      subtitle="Это поможет AI создавать сценарии, которые попадут в твою аудиторию."
      options={NICHE_OPTIONS}
      activeKey={niche}
      onPick={onPick}
    />
  );
}

// ───────── Шаг 2: аудитория ─────────

function AudienceStep({ audience, onPick }: { audience: AudienceKey | null; onPick: (k: AudienceKey) => void }) {
  return (
    <ChoiceGrid
      title="Для кого твой контент?"
      subtitle="Это поможет AI лучше понимать твою аудиторию и создавать более цепляющие сценарии."
      options={AUDIENCE_OPTIONS}
      activeKey={audience}
      onPick={onPick}
    />
  );
}

// ───────── Шаг 3: стиль подачи ─────────

function StyleStep({ style, onPick }: { style: StyleKey | null; onPick: (k: StyleKey) => void }) {
  return (
    <ChoiceGrid
      title="Какой у тебя стиль подачи?"
      subtitle="AI будет использовать этот tone of voice при переписывании сценариев."
      options={STYLE_OPTIONS}
      activeKey={style}
      onPick={onPick}
    />
  );
}

// ───────── Шаг 4: цель ─────────

function GoalStep({ goal, onPick }: { goal: GoalKey | null; onPick: (k: GoalKey) => void }) {
  return (
    <ChoiceGrid
      title="Что для тебя важнее?"
      subtitle="Это поможет AI делать сценарии с правильным CTA и фокусом."
      options={GOAL_OPTIONS}
      activeKey={goal}
      onPick={onPick}
    />
  );
}

// ───────── Шаг 5: сборка AI-профиля (loading) ─────────

const PROFILE_TASKS: { icon: React.ReactNode; title: string; body: string }[] = [
  { icon: <TargetIcon />, title: "Анализируем нишу", body: "Понимаем твой рынок и контекст" },
  { icon: <UsersIcon />, title: "Изучаем аудиторию", body: "Определяем, кто твоя целевая аудитория" },
  { icon: <ChatIcon />, title: "Настраиваем стиль и тон", body: "Обучаем AI твоему стилю подачи" },
  { icon: <BrainIcon />, title: "Подготавливаем AI-модель", body: "Адаптируем алгоритмы под твои цели" },
];

function BuildingProfileStep({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => {
      setPct((p) => {
        if (p >= 100) return 100;
        // лёгкое замедление к концу — UX-приём
        const step = p > 85 ? 0.7 : 1.5;
        return Math.min(100, p + step);
      });
    }, 80);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (pct >= 100) {
      const t = setTimeout(onDone, 700);
      return () => clearTimeout(t);
    }
  }, [pct, onDone]);

  const completed = Math.min(PROFILE_TASKS.length, Math.floor(pct / 25));

  return (
    <>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2, color: INK, textAlign: "center" }}>
        Создаём твой{" "}
        <span style={{ background: IG_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          AI-профиль…
        </span>
      </h1>
      <p style={{ margin: "6px auto 16px", fontSize: 12, color: MUTED, lineHeight: 1.4, textAlign: "center", maxWidth: 320 }}>
        AI анализирует твои ответы и настраивает персональную модель под твой контент.
      </p>

      {/* AI-орб */}
      <div style={{ display: "flex", justifyContent: "center", margin: "20px 0 28px", position: "relative" }}>
        <div style={{
          width: 110, height: 110, borderRadius: 999,
          background: IG_GRADIENT,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, fontWeight: 800, color: "#FFFFFF", letterSpacing: "0.04em",
          boxShadow: `0 0 60px ${PINK}55, 0 16px 40px ${PURPLE}50`,
          animation: "lex-orb-pulse 2s ease-in-out infinite",
          position: "relative",
        }}>
          AI
          <div style={{ position: "absolute", inset: -10, borderRadius: 999, border: `1px solid ${PURPLE}55`, animation: "lex-orb-ring 3s linear infinite" }} />
          <div style={{ position: "absolute", inset: -20, borderRadius: 999, border: `1px solid ${PINK}30`, animation: "lex-orb-ring 4s linear infinite reverse" }} />
        </div>
        <style>{`
          @keyframes lex-orb-pulse {
            0%,100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          @keyframes lex-orb-ring {
            0% { transform: rotate(0); opacity: 0.6; }
            50% { opacity: 1; }
            100% { transform: rotate(360deg); opacity: 0.6; }
          }
        `}</style>
      </div>

      {/* Задачи */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {PROFILE_TASKS.map((t, i) => {
          const state: "done" | "running" | "wait" =
            i < completed ? "done" : i === completed ? "running" : "wait";
          return (
            <ProfileTaskRow key={i} task={t} state={state} />
          );
        })}
      </div>

      {/* Прогресс-бар */}
      <div style={{ marginTop: 14 }}>
        <div style={{ textAlign: "center", fontSize: 11, color: MUTED, fontWeight: 600, marginBottom: 4 }}>Почти готово!</div>
        <div style={{ textAlign: "center", fontSize: 22, fontWeight: 800, background: IG_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 8 }}>
          {Math.floor(pct)}%
        </div>
        <div style={{ height: 6, borderRadius: 999, background: SOFT, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: IG_GRADIENT, transition: "width 80ms linear" }} />
        </div>
      </div>

      {/* Подсказка */}
      <div style={{
        marginTop: 12,
        background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14,
        padding: 10, display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: IG_GRADIENT,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 6px 16px ${PINK}40`,
        }}>
          <SparkleIcon size={15} color="#FFFFFF" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: INK, lineHeight: 1.25 }}>
            Каждый ответ делает AI умнее
          </div>
          <div style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.3, marginTop: 2 }}>
            Чем точнее данные — тем вируснее твои сценарии.
          </div>
        </div>
      </div>
    </>
  );
}

// ───────── Шаг 6: финал ─────────

const NICHE_LABEL: Record<NicheKey, string> = {
  business: "Бизнес", marketing: "Маркетинг", fitness: "Фитнес",
  psychology: "Психология", lifestyle: "Lifestyle", other: "Другое",
};
const AUDIENCE_LABEL: Record<AudienceKey, string> = {
  entrepreneurs: "Предприниматели", experts: "Эксперты", beginners: "Новички",
  bloggers: "Блогеры", men_20_35: "Мужчины 20–35", women_20_35: "Женщины 20–35",
};
const STYLE_LABEL: Record<StyleKey, string> = {
  provocative: "Провокационный", expert: "Экспертный", friendly: "Дружелюбный",
  premium: "Premium", analytical: "Аналитический", mix: "Микс",
};
const GOAL_LABEL: Record<GoalKey, string> = {
  views: "Просмотры", subscribers: "Подписчики", sales: "Продажи", personal_brand: "Личный бренд",
};

function SuccessStep({
  niche, audience, styleVoice, goal, onFinish,
}: {
  niche: NicheKey | null;
  audience: AudienceKey | null;
  styleVoice: StyleKey | null;
  goal: GoalKey | null;
  onFinish: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const rows: { label: string; value: string; icon: React.ReactNode }[] = [
    { label: "Ниша", value: niche ? NICHE_LABEL[niche] : "—", icon: <BriefcaseIcon /> },
    { label: "Аудитория", value: audience ? AUDIENCE_LABEL[audience] : "—", icon: <UsersIcon /> },
    { label: "Стиль подачи", value: styleVoice ? STYLE_LABEL[styleVoice] : "—", icon: <ChatIcon /> },
    { label: "Главная цель", value: goal ? GOAL_LABEL[goal] : "—", icon: <TargetIcon /> },
  ];

  return (
    <>
      {/* Большой чек */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14, position: "relative" }}>
        <div style={{
          width: 92, height: 92, borderRadius: 999,
          background: IG_GRADIENT,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 70px ${PINK}55, 0 16px 40px ${PURPLE}50`,
          animation: "lex-orb-pulse 2s ease-in-out infinite",
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5l5 5 9-11" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.18, color: INK, textAlign: "center" }}>
        Твой{" "}
        <span style={{ background: IG_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          AI-профиль
        </span>{" "}
        готов!
      </h1>
      <p style={{ margin: "6px auto 14px", fontSize: 12, color: MUTED, lineHeight: 1.4, textAlign: "center", maxWidth: 320 }}>
        Мы всё настроили. Теперь AI будет создавать сценарии, которые идеально подходят именно тебе.
      </p>

      {/* Сводка профиля */}
      <div style={{
        background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16,
        padding: 12, marginBottom: 12,
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: INK, marginBottom: 10 }}>Твой профиль</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 8, borderBottom: i < rows.length - 1 ? `1px solid ${CARD_BORDER}` : "none" }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: `linear-gradient(150deg, ${PURPLE}30, ${PURPLE}12)`,
                border: `1px solid ${PURPLE}3D`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#C78BEB",
              }}>
                {r.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 600, letterSpacing: "0.02em" }}>{r.label}</div>
                <div style={{ fontSize: 13, color: INK, fontWeight: 700, lineHeight: 1.25, marginTop: 1 }}>{r.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI-подсказка */}
      <div style={{
        background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14,
        padding: 10, display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: IG_GRADIENT,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 6px 16px ${PINK}40`,
        }}>
          <SparkleIcon size={15} color="#FFFFFF" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: INK, lineHeight: 1.25 }}>
            AI будет адаптировать вирусные Reels
          </div>
          <div style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.3, marginTop: 2 }}>
            и переписывать сценарии специально под твой контент и цели.
          </div>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={async () => { if (busy) return; setBusy(true); await onFinish(); }}
        disabled={busy}
        style={{
          appearance: "none", width: "100%", padding: "14px 0", border: "none", borderRadius: 14,
          background: IG_GRADIENT, color: "#FFFFFF", fontSize: 15, fontWeight: 800,
          letterSpacing: "0.01em", fontFamily: "inherit",
          cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1,
          boxShadow: `0 14px 32px ${PINK}50`,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        {busy ? "Создаём…" : <>Начать анализ <ArrowIcon /></>}
      </button>

      <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: MUTED, fontSize: 11, fontWeight: 600 }}>
        <AvatarStack />
        360+ авторов уже создают вирусный контент
      </div>
    </>
  );
}

function AvatarStack() {
  const dots = [PURPLE, PINK, "#F0944E"];
  return (
    <div style={{ display: "flex" }}>
      {dots.map((c, i) => (
        <div key={i} style={{ width: 18, height: 18, borderRadius: 999, background: c, border: `2px solid ${BG}`, marginLeft: i === 0 ? 0 : -6 }} />
      ))}
    </div>
  );
}

function ProfileTaskRow({ task, state }: { task: typeof PROFILE_TASKS[number]; state: "done" | "running" | "wait" }) {
  const accentColor =
    state === "done" ? "#4FD489" : state === "running" ? PURPLE : SUB_MUTED;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 10px", borderRadius: 12,
      background: state === "running" ? `${PURPLE}14` : CARD_BG,
      border: `1px solid ${state === "running" ? PURPLE : CARD_BORDER}`,
      opacity: state === "wait" ? 0.55 : 1,
      transition: "background 240ms, border-color 240ms, opacity 240ms",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        background: `linear-gradient(150deg, ${PURPLE}30, ${PURPLE}12)`,
        border: `1px solid ${PURPLE}3D`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: state === "done" ? "#C78BEB" : "#C78BEB",
      }}>
        {task.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: INK, lineHeight: 1.25 }}>{task.title}</div>
        <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.3, marginTop: 1 }}>{task.body}</div>
      </div>
      <div style={{ flexShrink: 0, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {state === "done" && (
          <div style={{ width: 22, height: 22, borderRadius: 999, background: "#4FD489", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckIcon size={12} />
          </div>
        )}
        {state === "running" && <Spinner color={accentColor} />}
        {state === "wait" && (
          <div style={{ width: 14, height: 14, borderRadius: 999, border: `1.5px solid ${SUB_MUTED}` }} />
        )}
      </div>
    </div>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ animation: "lex-spin 0.9s linear infinite" }}>
      <circle cx="12" cy="12" r="9" stroke={color} strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M12 3a9 9 0 019 9" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <style>{`@keyframes lex-spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

// ───────── Универсальный grid выбора ─────────

type Choice<K extends string> = { key: K; label: string; description?: string; icon: React.ReactNode };

function ChoiceGrid<K extends string>({
  title, subtitle, options, activeKey, onPick,
}: {
  title: string;
  subtitle: string;
  options: Choice<K>[];
  activeKey: K | null;
  onPick: (k: K) => void;
}) {
  return (
    <>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2, color: INK, display: "flex", alignItems: "center", gap: 6 }}>
        <SparkleIcon size={18} color={PURPLE} />
        {title}
      </h1>
      <p style={{ margin: "6px 0 12px", fontSize: 12, color: MUTED, lineHeight: 1.4 }}>
        {subtitle}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {options.map((opt) => {
          const active = activeKey === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => onPick(opt.key)}
              style={{
                appearance: "none", textAlign: "center", padding: "10px 8px 9px",
                borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
                background: active ? `${PURPLE}1A` : CARD_BG,
                border: `1.5px solid ${active ? PURPLE : CARD_BORDER}`,
                color: INK, position: "relative",
                transition: "background 180ms, border-color 180ms",
              }}
            >
              {active && (
                <div style={{
                  position: "absolute", top: 6, right: 6,
                  width: 16, height: 16, borderRadius: 999, background: PURPLE,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <CheckIcon />
                </div>
              )}
              <div style={{
                width: 36, height: 36, margin: "0 auto 6px", borderRadius: 11,
                background: `linear-gradient(150deg, ${PURPLE}30, ${PURPLE}12)`,
                border: `1px solid ${PURPLE}3D`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: active ? "#D9B4F0" : "#C78BEB",
                boxShadow: active ? `0 6px 16px ${PURPLE}40` : "none",
              }}>
                {opt.icon}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginBottom: opt.description ? 3 : 0 }}>{opt.label}</div>
              {opt.description && (
                <div style={{ fontSize: 9.5, color: MUTED, lineHeight: 1.3 }}>{opt.description}</div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ───────── Иконки ─────────

type IconProps = { size?: number; color?: string };

function XIcon({ size = 12, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ size = 11, color = "#FFFFFF" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12l5 5 9-10" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkleIcon({ size = 18, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" fill={color} />
      <path d="M18 14l.8 2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-1L18 14z" fill={color} />
    </svg>
  );
}

function ArrowIcon({ size = 18, color = "#FFFFFF" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="7" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.4" />
      <rect x="10.2" y="11.2" width="3.6" height="1.6" rx="0.4" fill="currentColor" />
      <path d="M6 16h2M16 16h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function MegaphoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 10v4a1 1 0 001 1h2l8 4V5l-8 4H5a1 1 0 00-1 1z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M7 15v3.5a1.5 1.5 0 003 0V17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M18 8.5a4 4 0 010 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M20.5 6.5a7 7 0 010 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
      <circle cx="9" cy="12" r="0.9" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

function DumbbellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="8" width="3" height="8" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="19" y="8" width="3" height="8" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="5" y="10" width="3" height="4" rx="0.8" fill="currentColor" />
      <rect x="16" y="10" width="3" height="4" rx="0.8" fill="currentColor" />
      <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M0.5 11v2M23.5 11v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M9 4.5a3 3 0 00-3 3 2.5 2.5 0 00-2 2.5c0 .9.4 1.7 1.1 2.2A2.6 2.6 0 005 14.8 3 3 0 008 18a3 3 0 003 1.5v-15a3 3 0 00-2 0z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M15 4.5a3 3 0 013 3 2.5 2.5 0 012 2.5c0 .9-.4 1.7-1.1 2.2A2.6 2.6 0 0119 14.8 3 3 0 0116 18a3 3 0 01-3 1.5v-15a3 3 0 012 0z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 9c.5.6 1.2.9 2 .9M15 9c-.5.6-1.2.9-2 .9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <path d="M9 14c.6-.6 1.4-.9 2.2-.9M15 14c-.6-.6-1.4-.9-2.2-.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function PalmIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 9v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11.6 12c-.3 1.5-1 2.7-2 3.5M12.4 12c.3 1.5 1 2.7 2 3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <path d="M12 9c-2.5-2.8-5.5-3-7-1.5.6-.4 2-.5 3 .2M12 9c2.5-2.8 5.5-3 7-1.5-.6-.4-2-.5-3 .2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9c-3-1.2-5 0-6 3 .5-1.2 1.5-1.8 3-1.5M12 9c3-1.2 5 0 6 3-.5-1.2-1.5-1.8-3-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="8.5" r="1.4" fill="currentColor" />
      <path d="M3 22h18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
      <circle cx="6" cy="21" r="0.6" fill="currentColor" opacity="0.6" />
      <circle cx="18" cy="21" r="0.6" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" opacity="0.5" />
      <circle cx="7" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="17" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}

function GradCapIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M2 10l10-4 10 4-10 4-10-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M6 12v4c0 1.5 2.7 3 6 3s6-1.5 6-3v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M21 10.5v4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M21 15.5c-.4 1-.4 1.7 0 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      <path d="M12 11l-4-1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <circle cx="12" cy="10" r="0.8" fill="currentColor" />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M14.5 3c3.5.4 5.6 2.5 6 6-1 1.5-2.4 3-4 4.5l-2.3 2.3-4-4 2.3-2.3C13.8 7.7 14.4 5.5 14.5 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="15" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 15.5L7.7 18.3a2 2 0 01-2.8-2.8l2.8-2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 20.5c-1 .7-2.4.9-3.5.5.4-1.1.6-2.5 1.3-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
      <path d="M19 7l1.5.5M20 5l-.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function ReelIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 8.5h17" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />
      <path d="M7.5 4.2l1.8 4.1M12.5 4.2l1.8 4.1M17.5 4.2l1.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
      <circle cx="12" cy="14" r="3.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.8 12.4l3.2 1.6-3.2 1.6v-3.2z" fill="currentColor" />
    </svg>
  );
}

function ManIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 21c0-3.8 3.1-6.5 7-6.5s7 2.7 7 6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8.6 6.4c.6-1.2 2-2 3.4-2s2.8.8 3.4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10.5 10.2c.6.5 1.4.5 2 0M10.5 8.5h.01M13.5 8.5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9 18.5L9 21M15 18.5L15 21" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12.5 2c.4 2.8 2.3 4.3 3.6 5.9C17.6 9.7 18.5 11.6 18.5 14a6.5 6.5 0 11-13 0c0-2.3 1.1-4 2.3-5.4.3 1.1.9 1.9 1.8 2.4C8.7 8 10 5.4 12.5 2z" fill="currentColor" opacity="0.85" />
      <path d="M12 13c.7.8 1 1.8.6 2.7-.4.9-1.4 1.4-2.4 1.2 0 1.5 1.2 2.5 2.8 2.5 1.5 0 2.8-1.2 2.8-2.7 0-1.5-1-2.8-1.6-3.5-.3.5-.8.8-1.4.5-.3-.2-.5-.4-.8-.7z" fill="#15151E" opacity="0.85" />
    </svg>
  );
}

function SmileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 14c1 1.5 2.4 2.3 4 2.3s3-.8 4-2.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="9" cy="10" r="1.1" fill="currentColor" />
      <circle cx="15" cy="10" r="1.1" fill="currentColor" />
      <path d="M7 8.5c.8-.8 1.8-1 2.5-.8M17 8.5c-.8-.8-1.8-1-2.5-.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function DiamondIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M6 4h12l3 5-9 11L3 9l3-5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3 9h18M9 4l3 16M15 4l-3 16M6 4l3 5M18 4l-3 5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" opacity="0.55" />
      <path d="M10 6.5l1 1M14 6.5l-1 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function MasksIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3.5 7c1-1.5 4-2 6.5-1.5C12.5 6 13 9 12 12c-1 3-3.5 4-5.5 3-2-.8-3.8-3-3.8-5.5 0-1 .3-1.8.8-2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="6.5" cy="9" r="0.8" fill="currentColor" />
      <circle cx="9.5" cy="9" r="0.8" fill="currentColor" />
      <path d="M7 12c.7.5 1.7.5 2.4 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20.5 9c-1-1.5-4-2-6.5-1.5C11.5 8 11 11 12 14c1 3 3.5 4 5.5 3 2-.8 3.8-3 3.8-5.5 0-1-.3-1.8-.8-2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.85" />
      <circle cx="14.5" cy="11" r="0.8" fill="currentColor" opacity="0.85" />
      <circle cx="17.5" cy="11" r="0.8" fill="currentColor" opacity="0.85" />
      <path d="M15 14c.7.5 1.7.5 2.4 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <path d="M12 1.5v2.5M12 20v2.5M1.5 12h2.5M20 12h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v8a2.5 2.5 0 01-2.5 2.5H10l-4 3.5V17H6.5A2.5 2.5 0 014 14.5v-8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="9" cy="10.5" r="1" fill="currentColor" />
      <circle cx="12" cy="10.5" r="1" fill="currentColor" />
      <circle cx="15" cy="10.5" r="1" fill="currentColor" />
    </svg>
  );
}

function BarChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 21h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="5" y="13" width="3.2" height="8" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="10.4" y="9" width="3.2" height="12" rx="1" fill="currentColor" />
      <rect x="15.8" y="5" width="3.2" height="16" rx="1" fill="currentColor" opacity="0.85" />
      <path d="M5 11l5-4 4 2 6-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      <path d="M18 4h2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8.5" r="3.3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 19.5c0-3.2 2.9-5.5 6.5-5.5s6.5 2.3 6.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16.5" cy="7.5" r="2.6" stroke="currentColor" strokeWidth="1.5" opacity="0.85" />
      <path d="M16 13.5c2.6.2 4.5 1.9 5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M5 8h14l-1.2 11a2 2 0 01-2 1.8H8.2a2 2 0 01-2-1.8L5 8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.5 8V6a3.5 3.5 0 117 0v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 13c.5 1 1.5 1.5 3 1.5s2.5-.5 3-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l2.6 5.5 6 .9-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.9L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="currentColor" fillOpacity="0.18" />
      <path d="M12 7l1.4 3 3.3.5-2.4 2.2.6 3.2L12 14.4l-2.9 1.5.6-3.2-2.4-2.2 3.3-.5L12 7z" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

function WomanIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7.5 6.5c.3-2.3 2.2-3.5 4.5-3.5s4.2 1.2 4.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.5 8c-.4 1.8.2 3.5 1.5 4.5M15.5 8c.4 1.8-.2 3.5-1.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      <path d="M10.5 10.2c.6.5 1.4.5 2 0M10.5 8.5h.01M13.5 8.5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5 21c0-3.8 3.1-6.5 7-6.5s7 2.7 7 6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.7" fill="currentColor" opacity="0.7" />
      <circle cx="16" cy="11.5" r="0.7" fill="currentColor" opacity="0.7" />
    </svg>
  );
}
