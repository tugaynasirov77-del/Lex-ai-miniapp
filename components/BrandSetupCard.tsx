"use client";

import { useEffect, useState } from "react";
import { getBrandKit, saveBrandSetup, type BrandKit } from "../lib/api";
import { hapticImpact, hapticNotify } from "../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.10)";

const NICHES = [
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

const TONES = [
  "Экспертный",
  "Дружелюбный",
  "Провокационный",
  "Уютный",
  "Прямой",
  "С юмором",
];

type Props = {
  projectId: string;
  onSaved?: (brand: BrandKit) => void;
};

export default function BrandSetupCard({ projectId, onSaved }: Props) {
  const [niche, setNiche] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [inspirations, setInspirations] = useState("");
  const [referencePosts, setReferencePosts] = useState("");

  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // hasSavedKit = true если в БД уже есть профиль (после load или save).
  // dirty = юзер изменил что-то после load/save.
  const [hasSavedKit, setHasSavedKit] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let alive = true;
    getBrandKit(projectId)
      .then((r) => {
        if (!alive) return;
        const k = r.brand_kit;
        if (k && (k.niche || k.short_description)) {
          setNiche(k.niche || "");
          setDescription(k.short_description || "");
          setAudience(k.audience || "");
          setTone(k.voice || "");
          setInspirations((k.inspirations || []).map((h) => `@${h}`).join(", "));
          setReferencePosts(
            Array.isArray((k as any).reference_posts)
              ? ((k as any).reference_posts as string[]).join("\n\n---\n\n")
              : "",
          );
          setHasSavedKit(true);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Помечаем dirty при любом изменении формы
  function onChange<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  async function save() {
    setErr(null);
    if (!niche.trim() || !description.trim()) {
      setErr("Заполни нишу и описание бренда.");
      return;
    }
    setBusy(true);
    hapticImpact("medium");
    try {
      const insps = inspirations
        .split(/[,\s]+/)
        .map((s) => s.trim().replace(/^@/, ""))
        .filter((s) => s.length >= 2)
        .slice(0, 5);
      const refs = referencePosts
        .split(/\n\s*---\s*\n/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 30)
        .slice(0, 5);
      const r = await saveBrandSetup(projectId, {
        niche,
        description,
        audience,
        tone,
        inspirations: insps,
        reference_posts: refs,
      });
      hapticNotify("success");
      setHasSavedKit(true);
      setDirty(false);
      onSaved?.(r.brand_kit);
    } catch (e) {
      hapticNotify("error");
      setErr(e instanceof Error ? e.message : "Не получилось.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <div style={cardStyle}>
        <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>Загрузка...</p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
        Профиль бренда
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: MUTED, lineHeight: 1.45 }}>
        LEX AI использует эти данные для каждого поста, карусели и Reels.
        Чем точнее опишешь — тем лучше будет контент.
      </p>

      {/* Niche */}
      <Field label="Какая у тебя ниша?">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {NICHES.map((n) => {
            const active = niche === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(setNiche)(n)}
                style={{
                  ...pillStyle,
                  borderColor: active ? YELLOW : CARD_BORDER,
                  background: active ? `${YELLOW}1A` : "transparent",
                  color: active ? YELLOW : INK,
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
      </Field>

      {/* Description */}
      <Field label="Расскажи про бренд (1-2 предложения)">
        <textarea
          value={description}
          onChange={(e) => onChange(setDescription)(e.target.value)}
          rows={2}
          placeholder="Например: Помогаю предпринимателям внедрять AI в маркетинг."
          style={textareaStyle}
        />
      </Field>

      {/* Audience */}
      <Field label="Твоя аудитория">
        <textarea
          value={audience}
          onChange={(e) => onChange(setAudience)(e.target.value)}
          rows={2}
          placeholder="Например: Малый бизнес и SMM-щики 25-45 лет"
          style={textareaStyle}
        />
      </Field>

      {/* Tone */}
      <Field label="Тон общения">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {TONES.map((t) => {
            const active = tone === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onChange(setTone)(t)}
                style={{
                  ...pillStyle,
                  borderColor: active ? YELLOW : CARD_BORDER,
                  background: active ? `${YELLOW}1A` : "transparent",
                  color: active ? YELLOW : INK,
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </Field>

      {/* Reference posts — для копирования tone-of-voice */}
      <Field
        label="Твои лучшие посты (опционально)"
        hint="до 5 постов через '---' на отдельной строке. Каждый ≥30 символов. Помогает LEX AI писать твоим голосом."
      >
        <textarea
          value={referencePosts}
          onChange={(e) => onChange(setReferencePosts)(e.target.value)}
          rows={6}
          placeholder={"Текст первого поста...\n\n---\n\nТекст второго поста...\n\n---\n\nТекст третьего поста..."}
          style={textareaStyle}
        />
      </Field>

      {/* Inspirations */}
      <Field label="Вдохновение (опционально)" hint="до 5 IG-аккаунтов через запятую">
        <textarea
          value={inspirations}
          onChange={(e) => onChange(setInspirations)(e.target.value)}
          rows={1}
          placeholder="@nike, @gymshark"
          style={textareaStyle}
        />
      </Field>

      {err && (
        <p style={{ margin: "6px 0 0", color: "#FF7373", fontSize: 12 }}>{err}</p>
      )}

      {/* Статус: сохранено / есть изменения / новый */}
      {hasSavedKit && !dirty && !busy && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: "#5BD66B",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>✓</span>
          <span>Профиль сохранён. LEX AI использует его для всего контента.</span>
        </div>
      )}
      {hasSavedKit && dirty && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#F39B40", fontWeight: 600 }}>
          Изменения не сохранены
        </div>
      )}

      <button
        onClick={save}
        disabled={busy || (!dirty && hasSavedKit)}
        style={{
          marginTop: 10,
          width: "100%",
          minHeight: 48,
          background: !dirty && hasSavedKit ? "rgba(255,255,255,0.08)" : YELLOW,
          color: !dirty && hasSavedKit ? MUTED : "#0A0608",
          border: "none",
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          cursor: busy || (!dirty && hasSavedKit) ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy
          ? "LEX AI собирает playbook..."
          : !dirty && hasSavedKit
            ? "Профиль сохранён"
            : hasSavedKit
              ? "ОБНОВИТЬ ПРОФИЛЬ"
              : "СОХРАНИТЬ ПРОФИЛЬ"}
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: MUTED,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
      {hint && (
        <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>{hint}</div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 14,
  padding: 14,
};

const pillStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontFamily: "inherit",
  border: `1px solid ${CARD_BORDER}`,
  cursor: "pointer",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 10,
  padding: 10,
  color: INK,
  fontSize: 13,
  fontFamily: "inherit",
  resize: "vertical",
  minHeight: 50,
  outline: "none",
};
