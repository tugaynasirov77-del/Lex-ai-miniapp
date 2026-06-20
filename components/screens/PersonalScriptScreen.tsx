"use client";

import { useEffect, useState } from "react";
import {
  generateReelScript,
  refineScriptBlock,
  saveScenarioDraft,
  setDraftPlannedDate,
  getProject,
  type AdaptedTopicDTO,
  type ReelScenarioData,
  type StoryboardScene,
  type ScriptRefineAction,
} from "../../lib/api";
import { hapticImpact, hapticNotify, hapticSelection } from "../../lib/telegram";
import { track } from "../../lib/analytics";
import StateBlock from "../StateBlock";

const INK = "#F4F4F8";
const MUTED = "#9A9AAB";
const SUB_MUTED = "#6B6B7B";
const CARD_BG = "#15151E";
const CARD_BORDER = "#262630";
const PINK = "#E84B91";
const IG_GRADIENT = "linear-gradient(135deg, #A24FD6 0%, #E84B91 50%, #F88A4A 100%)";
const ORANGE = "#F0944E";
const DANGER = "#FF8B8B";

type Props = {
  projectId: string;
  decodeId?: string;
  topic: AdaptedTopicDTO;
  onSaved?: (draftId: string) => void;
  onAddedToPlan?: (draftId: string, date: string) => void;
  onBack?: () => void;
};

const REFINE_ACTIONS: { label: string; action: ScriptRefineAction }[] = [
  { label: "Короче", action: "shorter" },
  { label: "Дерзче", action: "sharper" },
  { label: "Спокойнее", action: "calmer" },
  { label: "Экспертнее", action: "expert" },
  { label: "Проще", action: "simpler" },
  { label: "Другой вариант", action: "alternative" },
];

export default function PersonalScriptScreen({
  projectId,
  decodeId,
  topic,
  onSaved,
  onAddedToPlan,
  onBack,
}: Props) {
  const [scenario, setScenario] = useState<ReelScenarioData | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [reloadTick, setReloadTick] = useState(0);

  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  // Загружаем имя проекта (для подзаголовка) — best-effort, не блокирует.
  useEffect(() => {
    let alive = true;
    getProject(projectId)
      .then((r) => alive && setProjectName(r.project.title || ""))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Генерация сценария на mount / retry.
  useEffect(() => {
    let alive = true;
    setScenario(null);
    setGenError(null);
    generateReelScript(projectId, topic, decodeId)
      .then((r) => alive && setScenario(r.scenario))
      .catch((e: any) => alive && setGenError(e?.message || "Не получилось сгенерировать сценарий"));
    return () => {
      alive = false;
    };
  }, [projectId, decodeId, topic, reloadTick]);

  // --- helpers для редактирования полей ---
  function patch<K extends keyof ReelScenarioData>(key: K, value: ReelScenarioData[K]) {
    setScenario((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateScene(i: number, key: keyof StoryboardScene, value: string) {
    setScenario((prev) => {
      if (!prev) return prev;
      const storyboard = prev.storyboard.map((s, idx) =>
        idx === i ? { ...s, [key]: value } : s,
      );
      return { ...prev, storyboard };
    });
  }

  async function ensureSaved(): Promise<string | null> {
    if (savedDraftId) return savedDraftId;
    if (!scenario) return null;
    const { id } = await saveScenarioDraft(projectId, {
      content_type: "reel",
      status: "scenario_ready",
      title: scenario.title,
      source_decode_id: decodeId,
      source_topic: topic.title,
      scenario_data: scenario,
      body: scenario.caption,
      caption: scenario.caption,
    });
    setSavedDraftId(id);
    return id;
  }

  async function handleSave() {
    if (!scenario || saving) return;
    setSaving(true);
    hapticImpact("medium");
    try {
      const id = await ensureSaved();
      if (!id) throw new Error("save failed");
      hapticNotify("success");
      track("script_saved", { project_id: projectId, draft_id: id });
      onSaved?.(id);
    } catch (e: any) {
      hapticNotify("error");
      setGenError(e?.message || "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    if (!scenario) return;
    hapticSelection();
    const text = scenarioToText(scenario);
    track("script_copied", { project_id: projectId });
    navigator.clipboard?.writeText(text).then(
      () => hapticNotify("success"),
      () => hapticNotify("error"),
    );
  }

  async function handlePlanPick(date: string | null) {
    if (!scenario) return;
    setPlanOpen(false);
    hapticImpact("light");
    try {
      const id = await ensureSaved();
      if (!id) throw new Error("save failed");
      if (date) await setDraftPlannedDate(id, date);
      hapticNotify("success");
      track("script_added_to_plan", { project_id: projectId, draft_id: id, date: date || "none" });
      onAddedToPlan?.(id, date || "");
    } catch (e: any) {
      hapticNotify("error");
      setGenError(e?.message || "Не удалось добавить в план");
    }
  }

  // --- AI-action на конкретный блок ---
  const [refiningBlock, setRefiningBlock] = useState<string | null>(null);

  async function runRefine(
    blockName: string,
    field: "hook" | "voice_over" | "editing_hints" | "cta" | "caption",
    action: ScriptRefineAction,
  ) {
    if (!scenario || refiningBlock) return;
    setRefiningBlock(field);
    hapticImpact("light");
    try {
      const r = await refineScriptBlock(projectId, {
        block_name: blockName,
        current_text: scenario[field],
        action,
      });
      patch(field, r.text);
      hapticNotify("success");
    } catch {
      hapticNotify("error");
    } finally {
      setRefiningBlock(null);
    }
  }

  // === RENDER ===

  if (genError && !scenario) {
    return (
      <Wrap>
        <TopHeader projectName={projectName} duration={null} onBack={onBack} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: 8 }}>
          <StateBlock
            tone="error"
            emoji="⚠️"
            title="Не удалось собрать сценарий"
            body="LEX не смог сгенерировать сценарий по этой теме. Попробуй ещё раз — обычно помогает."
            action={{ label: "Попробовать снова", onClick: () => setReloadTick((t) => t + 1) }}
          />
        </div>
      </Wrap>
    );
  }

  if (!scenario) {
    return (
      <Wrap>
        <TopHeader projectName={projectName} duration={null} onBack={onBack} />
        <SkeletonBody />
      </Wrap>
    );
  }

  return (
    <Wrap>
      <TopHeader projectName={projectName} duration={scenario.duration_sec} onBack={onBack} />

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
        <Block n={1} label="Название">
          <TextField value={scenario.title} onChange={(v) => patch("title", v)} />
        </Block>

        <Block n={2} label="Цель ролика">
          <TextField value={scenario.goal} onChange={(v) => patch("goal", v)} />
        </Block>

        <Block n={3} label="Хук · первые 1–3 сек">
          <TextArea value={scenario.hook} onChange={(v) => patch("hook", v)} rows={2} />
          <AiActions
            busy={refiningBlock === "hook"}
            onAction={(a) => runRefine("hook", "hook", a)}
          />
        </Block>

        <Block n={4} label="Текст на экране">
          <TextArea value={scenario.on_screen_text} onChange={(v) => patch("on_screen_text", v)} rows={2} />
        </Block>

        <Block n={5} label="Полный текст озвучки">
          <TextArea value={scenario.voice_over} onChange={(v) => patch("voice_over", v)} rows={6} />
          <AiActions
            busy={refiningBlock === "voice_over"}
            onAction={(a) => runRefine("voice_over", "voice_over", a)}
          />
        </Block>

        <Block n={6} label="Раскадровка по сценам">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {scenario.storyboard.map((s, i) => (
              <div
                key={i}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${CARD_BORDER}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: PINK }}>Сцена {s.scene}</span>
                  <input
                    value={s.seconds}
                    onChange={(e) => updateScene(i, "seconds", e.target.value)}
                    style={{ ...inlineInput, width: 88 }}
                    placeholder="0-3"
                  />
                  <span style={{ fontSize: 11, color: SUB_MUTED }}>сек</span>
                </div>
                <FieldLabel>Действие в кадре</FieldLabel>
                <TextArea value={s.action} onChange={(v) => updateScene(i, "action", v)} rows={2} />
                <div style={{ height: 8 }} />
                <FieldLabel>Текст на экране</FieldLabel>
                <TextField
                  value={s.on_screen || ""}
                  onChange={(v) => updateScene(i, "on_screen", v)}
                  placeholder="—"
                />
              </div>
            ))}
          </div>
        </Block>

        <Block n={8} label="Что в кадре">
          <TextField value={scenario.in_frame} onChange={(v) => patch("in_frame", v)} />
        </Block>

        <Block n={9} label="Ракурс">
          <TextField value={scenario.angle} onChange={(v) => patch("angle", v)} />
        </Block>

        <Block n={10} label="Фон">
          <TextField value={scenario.background} onChange={(v) => patch("background", v)} />
        </Block>

        <Block n={11} label="Свет">
          <TextField value={scenario.light} onChange={(v) => patch("light", v)} />
        </Block>

        <Block n={12} label="Подсказки по монтажу">
          <TextArea value={scenario.editing_hints} onChange={(v) => patch("editing_hints", v)} rows={3} />
          <AiActions
            busy={refiningBlock === "editing_hints"}
            onAction={(a) => runRefine("editing_hints", "editing_hints", a)}
          />
        </Block>

        <Block n={13} label="Текстовые вставки">
          <ArrayField
            items={scenario.text_overlays}
            onChange={(arr) => patch("text_overlays", arr)}
            placeholder="Короткая вставка"
          />
        </Block>

        <Block n={14} label="Музыка / звук">
          <TextField value={scenario.music_hint} onChange={(v) => patch("music_hint", v)} />
        </Block>

        <Block n={15} label="Финальный CTA">
          <TextArea value={scenario.cta} onChange={(v) => patch("cta", v)} rows={2} />
          <AiActions
            busy={refiningBlock === "cta"}
            onAction={(a) => runRefine("cta", "cta", a)}
          />
        </Block>

        <Block n={16} label="Подпись к публикации">
          <TextArea value={scenario.caption} onChange={(v) => patch("caption", v)} rows={4} />
          <AiActions
            busy={refiningBlock === "caption"}
            onAction={(a) => runRefine("caption", "caption", a)}
          />
        </Block>

        <Block n={17} label="Хештеги">
          <ArrayField
            items={scenario.hashtags}
            onChange={(arr) => patch("hashtags", arr)}
            placeholder="#хэштег"
          />
        </Block>

        {/* 18. Риски — жёлтый блок */}
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            background: "rgba(240,148,78,0.07)",
            border: `1px solid rgba(240,148,78,0.28)`,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: ORANGE, marginBottom: 10 }}>
            Что может пойти не так
          </div>
          <ArrayField
            items={scenario.risks}
            onChange={(arr) => patch("risks", arr)}
            placeholder="Возможный риск"
          />
        </div>

        {/* 19. Альтернативные хуки */}
        <Block n={19} label="Альтернативные варианты хука">
          <ArrayField
            items={scenario.alt_hooks}
            onChange={(arr) => patch("alt_hooks", arr)}
            placeholder="Альтернативный хук"
          />
        </Block>

        {/* 20. Альтернативный CTA */}
        <Block n={20} label="Альтернативный CTA">
          <TextArea value={scenario.alt_cta} onChange={(v) => patch("alt_cta", v)} rows={2} />
        </Block>
      </div>

      {genError && (
        <div style={{ marginTop: 12, fontSize: 12, color: DANGER, textAlign: "center" }}>{genError}</div>
      )}

      {/* спейсер под sticky bar */}
      <div style={{ height: 8 }} />

      <StickyBar
        saving={saving}
        saved={!!savedDraftId}
        onSave={handleSave}
        onPlan={() => { hapticImpact("light"); setPlanOpen(true); }}
        onCopy={handleCopy}
      />

      {planOpen && (
        <PlanModal onClose={() => setPlanOpen(false)} onPick={handlePlanPick} />
      )}
    </Wrap>
  );
}

// ===================================================================
// Header
// ===================================================================

function TopHeader({
  projectName,
  duration,
  onBack,
}: {
  projectName: string;
  duration: number | null;
  onBack?: () => void;
}) {
  return (
    <div>
      {onBack && (
        <button
          onClick={() => { hapticSelection(); onBack(); }}
          style={{
            appearance: "none",
            background: "transparent",
            border: "none",
            color: MUTED,
            fontSize: 13,
            fontFamily: "inherit",
            padding: "0 0 8px",
            cursor: "pointer",
          }}
        >
          ← Назад
        </button>
      )}
      <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800, color: PINK }}>
        Персональный сценарий
      </div>
      <h1 style={{ margin: "8px 0 6px", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.12 }}>
        Ваш Reels готов
      </h1>
      <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
        Сценарий адаптирован под проект{projectName ? ` «${projectName}»` : ""}
      </p>
      <div
        style={{
          marginTop: 10,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          fontWeight: 700,
          color: "#5BD66B",
          background: "rgba(91,214,107,0.10)",
          border: "1px solid rgba(91,214,107,0.3)",
          padding: "5px 10px",
          borderRadius: 999,
        }}
      >
        ✓ Готово к съёмке{duration ? ` · около ${duration} секунд` : ""}
      </div>
    </div>
  );
}

// ===================================================================
// Reusable bits
// ===================================================================

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: "#0B0B11",
        color: INK,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding:
          "max(calc(env(safe-area-inset-top) + 64px), 96px) 18px " +
          "max(calc(env(safe-area-inset-bottom) + 150px), 168px)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
      }}
    >
      {children}
    </div>
  );
}

function Block({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 16,
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
        border: `1px solid ${CARD_BORDER}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: SUB_MUTED,
            minWidth: 18,
          }}
        >
          {String(n).padStart(2, "0")}
        </span>
        <span
          style={{
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: MUTED,
            fontWeight: 700,
          }}
        >
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: SUB_MUTED, marginBottom: 6, fontWeight: 600 }}>
      {children}
    </div>
  );
}

function TextField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={fieldStyle}
    />
  );
}

function TextArea({
  value,
  onChange,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      style={{ ...fieldStyle, resize: "vertical", minHeight: rows * 22, lineHeight: 1.5 }}
    />
  );
}

/** Редактируемый список строк: каждая строка — input, плюс «+ добавить». */
function ArrayField({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (arr: string[]) => void;
  placeholder?: string;
}) {
  const set = (i: number, v: string) => onChange(items.map((x, idx) => (idx === i ? v : x)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, ""]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input value={it} onChange={(e) => set(i, e.target.value)} placeholder={placeholder} style={{ ...fieldStyle, flex: 1 }} />
          <button
            onClick={() => { hapticSelection(); remove(i); }}
            style={{
              appearance: "none",
              width: 34,
              height: 34,
              flexShrink: 0,
              borderRadius: 10,
              border: `1px solid ${CARD_BORDER}`,
              background: "transparent",
              color: MUTED,
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
            }}
            aria-label="Удалить"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={() => { hapticSelection(); add(); }}
        style={{
          appearance: "none",
          alignSelf: "flex-start",
          padding: "6px 12px",
          borderRadius: 999,
          border: `1px dashed ${CARD_BORDER}`,
          background: "transparent",
          color: MUTED,
          fontFamily: "inherit",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        + добавить
      </button>
    </div>
  );
}

function AiActions({
  busy,
  onAction,
}: {
  busy: boolean;
  onAction: (a: ScriptRefineAction) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        marginTop: 10,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        paddingBottom: 2,
        opacity: busy ? 0.5 : 1,
      }}
    >
      {busy && (
        <span style={{ fontSize: 11, color: PINK, alignSelf: "center", whiteSpace: "nowrap", paddingRight: 4 }}>
          LEX переписывает…
        </span>
      )}
      {!busy &&
        REFINE_ACTIONS.map((a) => (
          <button
            key={a.action}
            onClick={() => onAction(a.action)}
            style={{
              appearance: "none",
              flex: "0 0 auto",
              padding: "6px 12px",
              borderRadius: 999,
              border: `1px solid ${CARD_BORDER}`,
              background: "rgba(255,255,255,0.04)",
              color: INK,
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {a.label}
          </button>
        ))}
    </div>
  );
}

function SkeletonBody() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            height: 90,
            borderRadius: 16,
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            opacity: 0.7 - i * 0.1,
          }}
        />
      ))}
      <div style={{ textAlign: "center", fontSize: 12, color: MUTED, marginTop: 4 }}>
        LEX пишет ваш сценарий…
      </div>
    </div>
  );
}

// ===================================================================
// Sticky bar + Plan modal
// ===================================================================

function StickyBar({
  saving,
  saved,
  onSave,
  onPlan,
  onCopy,
}: {
  saving: boolean;
  saved: boolean;
  onSave: () => void;
  onPlan: () => void;
  onCopy: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: "max(calc(env(safe-area-inset-bottom) + 88px), 96px)",
        zIndex: 40,
        padding: 12,
        borderRadius: 22,
        background: "rgba(21,21,30,0.82)",
        backdropFilter: "blur(28px) saturate(160%)",
        WebkitBackdropFilter: "blur(28px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            appearance: "none",
            flex: 1,
            minHeight: 50,
            border: "none",
            borderRadius: 999,
            background: IG_GRADIENT,
            color: "#FFFFFF",
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.02em",
            cursor: saving ? "wait" : "pointer",
            boxShadow: `0 12px 28px rgba(232,75,145,0.33), 0 0 0 1px rgba(255,255,255,0.16) inset`,
          }}
        >
          {saving ? "Сохраняю…" : saved ? "✓ Сохранено" : "Сохранить в проект"}
        </button>
        <button
          onClick={onPlan}
          style={{
            appearance: "none",
            flex: "0 0 auto",
            minHeight: 50,
            padding: "0 16px",
            borderRadius: 999,
            border: `1px solid ${CARD_BORDER}`,
            background: "rgba(255,255,255,0.05)",
            color: INK,
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          В план
        </button>
      </div>
      <button
        onClick={onCopy}
        style={{
          appearance: "none",
          width: "100%",
          marginTop: 8,
          background: "transparent",
          border: "none",
          color: MUTED,
          fontFamily: "inherit",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          padding: "2px 0",
        }}
      >
        Скопировать сценарий
      </button>
    </div>
  );
}

function PlanModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (date: string | null) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [date, setDate] = useState("");

  const today = isoDay(0);
  const tomorrow = isoDay(1);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#15151E",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          border: "1px solid rgba(255,255,255,0.10)",
          padding: "20px 18px max(calc(env(safe-area-inset-bottom) + 20px), 28px)",
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.2)", margin: "0 auto 16px" }} />
        <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800 }}>Когда снять / опубликовать?</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: MUTED }}>
          Материал попадёт в контент-план проекта.
        </p>

        {!showPicker ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <PlanOption label="Сегодня" onClick={() => onPick(today)} />
            <PlanOption label="Завтра" onClick={() => onPick(tomorrow)} />
            <PlanOption label="Выбрать дату" onClick={() => setShowPicker(true)} />
            <PlanOption label="Пока не знаю" muted onClick={() => onPick(null)} />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
              style={fieldStyle}
            />
            <button
              onClick={() => date && onPick(date)}
              disabled={!date}
              style={{ ...primaryBtn, opacity: date ? 1 : 0.4 }}
            >
              Добавить в план
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanOption({ label, muted, onClick }: { label: string; muted?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={() => { hapticSelection(); onClick(); }}
      style={{
        appearance: "none",
        width: "100%",
        textAlign: "left",
        padding: "14px 16px",
        borderRadius: 14,
        border: `1px solid ${CARD_BORDER}`,
        background: muted ? "transparent" : "rgba(255,255,255,0.04)",
        color: muted ? MUTED : INK,
        fontFamily: "inherit",
        fontSize: 15,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// ===================================================================
// helpers
// ===================================================================

function isoDay(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function scenarioToText(s: ReelScenarioData): string {
  const scenes = s.storyboard
    .map((sc) => `[${sc.seconds}] ${sc.action}${sc.on_screen ? `\n   на экране: ${sc.on_screen}` : ""}`)
    .join("\n");
  return [
    `${s.title}`,
    `Цель: ${s.goal}`,
    "",
    `ХУК: ${s.hook}`,
    `Текст на экране: ${s.on_screen_text}`,
    "",
    "ОЗВУЧКА:",
    s.voice_over,
    "",
    "РАСКАДРОВКА:",
    scenes,
    "",
    `В кадре: ${s.in_frame}`,
    `Ракурс: ${s.angle}`,
    `Фон: ${s.background}`,
    `Свет: ${s.light}`,
    `Монтаж: ${s.editing_hints}`,
    `Вставки: ${s.text_overlays.join(" · ")}`,
    `Музыка: ${s.music_hint}`,
    "",
    `CTA: ${s.cta}`,
    "",
    "ПОДПИСЬ:",
    s.caption,
    s.hashtags.join(" "),
  ].join("\n");
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 12,
  color: INK,
  fontSize: 14,
  fontFamily: "inherit",
  padding: "11px 13px",
  outline: "none",
};

const inlineInput: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 8,
  color: INK,
  fontSize: 12,
  fontFamily: "inherit",
  padding: "5px 8px",
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
  appearance: "none",
  width: "100%",
  minHeight: 52,
  border: "none",
  borderRadius: 999,
  background: IG_GRADIENT,
  color: "#FFFFFF",
  fontFamily: "inherit",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: `0 12px 28px rgba(232,75,145,0.33), 0 0 0 1px rgba(255,255,255,0.16) inset`,
};
