"use client";

import { useEffect, useRef, useState } from "react";
import { decodeReel, type AdaptedTopicDTO, type ReelDecodeDTO, type ReelQuotaDTO } from "../lib/api";
import { hapticImpact, hapticNotify } from "../lib/telegram";
import { track } from "../lib/analytics";
import AdaptedTopicsBlock from "./AdaptedTopicsBlock";
import StateBlock from "./StateBlock";

// Человечная ошибка разбора: что произошло + что делать (бриф раздел 23).
type DecodeError = {
  emoji: string;
  title: string;
  body: string;
  primary: "retry" | "edit"; // retry — повторить тот же запрос; edit — поправить ссылку
};

const HINT_DISMISS_KEY = "lex_decode_hint_dismissed";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const SUB_MUTED = "rgba(255,255,255,0.42)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.10)";

type Props = {
  projectId: string;
  onDecoded?: () => void;
  /** Открывает экран персонального сценария по выбранной адаптированной теме. */
  onCreateScript?: (args: { decodeId: string; topic: AdaptedTopicDTO }) => void;
};

const PREFILL_URL_KEY = "lex_prefill_reel_url";

export default function ReelDecoderCard({ projectId, onDecoded, onCreateScript }: Props) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<DecodeError | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [decode, setDecode] = useState<ReelDecodeDTO | null>(null);
  const [quota, setQuota] = useState<ReelQuotaDTO | null>(null);
  const [cached, setCached] = useState(false);

  // Prefill: если юзер ввёл ссылку на Home («Что создаём сегодня?») —
  // подставляем её сюда и сразу запускаем разбор.
  useEffect(() => {
    let pending = "";
    try {
      pending = localStorage.getItem(PREFILL_URL_KEY) || "";
      if (pending) localStorage.removeItem(PREFILL_URL_KEY);
    } catch {}
    if (pending) {
      setUrl(pending);
      // запуск после установки url
      setTimeout(() => {
        const btn = document.getElementById("lex-decode-run-btn");
        btn?.click();
      }, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    if (!url.trim() || busy) return;
    setBusy(true);
    setErr(null);
    setDecode(null);
    hapticImpact("medium");
    track("reels_analysis_started", { project_id: projectId });
    try {
      const r = await decodeReel(projectId, url.trim());
      setDecode(r.decode);
      setCached(r.cached);
      if (r.quota) setQuota(r.quota);
      hapticNotify("success");
      track("reels_analysis_completed", { project_id: projectId, cached: r.cached });
      onDecoded?.();
    } catch (e: any) {
      hapticNotify("error");
      setErr(humanizeDecodeError(e));
      const raw = (e?.message || "не удалось разобрать").slice(0, 80);
      track("reels_analysis_failed", { project_id: projectId, error: raw });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 20,
        padding: 18,
        marginBottom: 14,
        overflow: "hidden",
        background:
          "radial-gradient(circle 220px at 100% 0%, rgba(245,133,41,0.30), transparent 60%)," +
          "radial-gradient(circle 240px at 0% 100%, rgba(129,52,175,0.28), transparent 60%)," +
          "radial-gradient(circle 200px at 80% 100%, rgba(221,42,123,0.30), transparent 60%)," +
          "linear-gradient(135deg, #1B0822 0%, #0A050C 100%)",
        border: `1px solid rgba(255,255,255,0.10)`,
        boxShadow: `0 18px 44px rgba(221,42,123,0.18)`,
      }}
    >
      {/* Hero */}
      <div
        style={{
          fontSize: 10,
          color: YELLOW,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 800,
        }}
      >
        Новое в IG
      </div>
      <h2
        style={{
          margin: "8px 0 6px",
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        Разбери любой Reels за минуту
      </h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
        Кидай ссылку — LEX разложит хук, структуру, таймкоды и метрики. Плюс готовый
        сценарий под твою нишу.
      </p>

      <HowToGetLink />

      {/* Input + button */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          ref={inputRef}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (err) setErr(null);
          }}
          placeholder="https://www.instagram.com/reel/..."
          style={{
            appearance: "none",
            width: "100%",
            padding: "12px 14px",
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 12,
            color: INK,
            fontFamily: "inherit",
            fontSize: 14,
            outline: "none",
          }}
          disabled={busy}
        />
        <button
          id="lex-decode-run-btn"
          onClick={run}
          disabled={busy || !url.trim()}
          style={{
            appearance: "none",
            width: "100%",
            padding: "14px 0",
            border: "none",
            borderRadius: 999,
            background: `linear-gradient(135deg, #FFF382 0%, ${YELLOW} 50%, #E5C500 100%)`,
            color: "#0A0608",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontFamily: "inherit",
            cursor: busy || !url.trim() ? "wait" : "pointer",
            opacity: busy || !url.trim() ? 0.55 : 1,
            boxShadow:
              busy || !url.trim()
                ? "none"
                : `0 14px 32px rgba(245,231,10,0.40), 0 0 0 1px rgba(255,255,255,0.16) inset`,
          }}
        >
          {busy ? "Разбираю…" : "🔍 Разобрать Reels"}
        </button>
      </div>

      {/* Quota */}
      {quota && (
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: SUB_MUTED,
            textAlign: "center",
          }}
        >
          Осталось разборов: {Math.max(0, quota.limit - quota.used)}/{quota.limit} · тариф {quota.tier.toUpperCase()}
        </div>
      )}

      {/* Loading state */}
      {busy && (
        <div style={{ marginTop: 14, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
          📥 Скачиваю видео из Instagram…<br />
          🎙 Транскрибирую речь…<br />
          🧠 Анализирую структуру…
        </div>
      )}

      {/* Error — человечное состояние с действием (бриф раздел 23) */}
      {err && (
        <div style={{ marginTop: 12 }}>
          <StateBlock
            tone="error"
            compact
            emoji={err.emoji}
            title={err.title}
            body={err.body}
            action={
              err.primary === "edit"
                ? {
                    label: "Вставить другую ссылку",
                    onClick: () => {
                      setUrl("");
                      setErr(null);
                      inputRef.current?.focus();
                    },
                  }
                : { label: "Попробовать снова", onClick: run }
            }
          />
        </div>
      )}

      {/* Result */}
      {decode && (
        <ResultBlock
          decode={decode}
          cached={cached}
          projectId={projectId}
          onCreateScript={onCreateScript}
        />
      )}

      {/* Upsell — после результата, если квота на нуле или близка */}
      {decode && quota && quota.tier === "free" && quota.used >= quota.limit - 1 && (
        <UpsellCard quota={quota} />
      )}
    </div>
  );
}

// ───────────── Result ─────────────
// Новый layout по брифу (раздел 4):
//  1. «Разбор готов» — заголовок
//  2. Карточка исходного Reels (метрики «нет данных» где null)
//  3. «Почему этот Reels цепляет» — 3-5 предложений (короткий summary)
//  4. «Главная механика ролика» — 3-5 ключевых элементов
//  5. «Что стоит взять в свой контент» — 3-5 рекомендаций
//  6. AdaptedTopicsBlock — 3 темы под проект + sticky CTA «Создать мой Reels»
//  7. Подробный анализ — все длинные блоки в аккордеонах ниже

function ResultBlock({
  decode,
  cached,
  projectId,
  onCreateScript,
}: {
  decode: ReelDecodeDTO;
  cached: boolean;
  projectId: string;
  onCreateScript?: (args: { decodeId: string; topic: AdaptedTopicDTO }) => void;
}) {
  const m = decode.metadata;
  const a = decode.analysis;

  // Короткое summary: первые 2-3 пункта why_works склеиваем в абзац.
  const shortSummary = (a.why_works || [])
    .slice(0, 3)
    .map((w) => clean(w).replace(/^[\-•·]\s*/, ""))
    .filter(Boolean)
    .join(" ");

  // Главная механика: тип хука + 3-4 engagement_triggers + cta как 5й элемент
  const mainMechanic: { label: string; text: string }[] = [];
  if (a.hook?.type) mainMechanic.push({ label: "Тип хука", text: clean(a.hook.type) });
  if (a.format) mainMechanic.push({ label: "Формат", text: clean(a.format) });
  (a.engagement_triggers || []).slice(0, 3).forEach((t) => {
    if (t) mainMechanic.push({ label: "Психотриггер", text: clean(t) });
  });
  if (a.cta) mainMechanic.push({ label: "CTA / удержание", text: clean(a.cta) });

  // Что стоит взять: первые 5 takeaways (если нет — first 3 shoot_yourself)
  const recommendations =
    (a.takeaways && a.takeaways.length > 0
      ? a.takeaways
      : a.shoot_yourself || []
    )
      .slice(0, 5)
      .map((t) => clean(t).replace(/^\d+\.\s*/, ""))
      .filter(Boolean);

  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {cached && (
        <div style={{ fontSize: 10, color: SUB_MUTED, textAlign: "center" }}>
          📦 из кэша — этот ролик уже разбирали недавно
        </div>
      )}

      {/* 1. Заголовок «Разбор готов» */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 2 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: INK,
          }}
        >
          ✅ Разбор готов
        </h3>
      </div>

      {/* 2. Карточка исходного Reels */}
      <SourceReelsCard decode={decode} />

      {/* 3. Почему этот Reels цепляет */}
      {shortSummary && (
        <ResultSection
          title="🎯 Почему этот Reels цепляет"
          accent="pink"
        >
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: INK }}>
            {shortSummary}
          </p>
        </ResultSection>
      )}

      {/* 4. Главная механика ролика */}
      {mainMechanic.length > 0 && (
        <ResultSection title="⚙️ Главная механика ролика" accent="cyan">
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {mainMechanic.map((it, i) => (
              <li
                key={i}
                style={{
                  fontSize: 13,
                  lineHeight: 1.45,
                  display: "flex",
                  gap: 8,
                  paddingLeft: 14,
                  position: "relative",
                }}
              >
                <span style={{ position: "absolute", left: 0, color: "#7AC8FF" }}>·</span>
                <span style={{ color: "#7AC8FF", fontWeight: 700, flexShrink: 0 }}>
                  {it.label}:
                </span>
                <span style={{ color: INK }}>{it.text}</span>
              </li>
            ))}
          </ul>
        </ResultSection>
      )}

      {/* 5. Что стоит взять в свой контент */}
      {recommendations.length > 0 && (
        <ResultSection title="🎁 Что стоит взять в свой контент" accent="green">
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {recommendations.map((t, i) => (
              <li
                key={i}
                style={{
                  fontSize: 13,
                  lineHeight: 1.45,
                  paddingLeft: 22,
                  position: "relative",
                  color: INK,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    color: "#5BD66B",
                    fontWeight: 800,
                  }}
                >
                  {i + 1}.
                </span>
                {t}
              </li>
            ))}
          </ul>
        </ResultSection>
      )}

      {/* 6. Адаптированные темы под проект + sticky CTA «Создать мой Reels» */}
      {decode.id && (
        <AdaptedTopicsBlock
          projectId={projectId}
          decodeId={decode.id}
          onCreateScript={(topic) => {
            if (onCreateScript) onCreateScript({ decodeId: decode.id!, topic });
            else hapticImpact("medium");
          }}
        />
      )}

      {/* 7. Подробный анализ — аккордеоны (по умолчанию закрыты) */}
      <DeepDiveAccordions decode={decode} />
    </div>
  );
}

/** Компактная карточка исходного Reels: автор, метрики с «нет данных», длительность. */
function SourceReelsCard({ decode }: { decode: ReelDecodeDTO }) {
  const m = decode.metadata;
  const fmtCount = (n: number) =>
    !n || n <= 0
      ? "нет данных"
      : n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}K`
      : String(n);

  const hasViews = m.view_count > 0;
  const engagementRate =
    hasViews ? ((m.like_count + m.comment_count) / m.view_count) * 100 : 0;
  const erLabel =
    engagementRate >= 6
      ? "🔥 топ"
      : engagementRate >= 3
      ? "сильно"
      : engagementRate >= 1
      ? "средне"
      : "слабо";

  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>
          @{m.author_username || "автор"}
        </span>
        <span style={{ fontSize: 11, color: SUB_MUTED }}>
          {Math.round(m.duration_sec)} сек
        </span>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <Stat label="Просмотры" value={fmtCount(m.view_count)} dim={!hasViews} />
        <Stat label="Лайки" value={fmtCount(m.like_count)} dim={!m.like_count} />
        <Stat label="Коммент." value={fmtCount(m.comment_count)} dim={!m.comment_count} />
      </div>

      {hasViews && (
        <div
          style={{
            borderTop: `1px solid ${CARD_BORDER}`,
            marginTop: 12,
            paddingTop: 12,
            display: "flex",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: SUB_MUTED,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Engagement Rate
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
              <span
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: YELLOW,
                  letterSpacing: "-0.02em",
                }}
              >
                {engagementRate.toFixed(2)}%
              </span>
              <span style={{ fontSize: 11, color: MUTED }}>· {erLabel}</span>
            </div>
          </div>
        </div>
      )}

      {!hasViews && (
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: SUB_MUTED,
            lineHeight: 1.5,
          }}
        >
          Instagram передаёт не все публичные данные. Анализ структуры ролика при этом доступен полностью.
        </div>
      )}
    </div>
  );
}

/** Однотонная карточка-секция результата с акцентом и пастельным фоном. */
function ResultSection({
  title,
  children,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  accent: "pink" | "cyan" | "green";
}) {
  const palette = {
    pink: { bg: "rgba(221,42,123,0.08)", border: "rgba(221,42,123,0.28)", title: "#F58AC0" },
    cyan: { bg: "rgba(122,200,255,0.06)", border: "rgba(122,200,255,0.28)", title: "#7AC8FF" },
    green: { bg: "rgba(91,214,107,0.06)", border: "rgba(91,214,107,0.28)", title: "#5BD66B" },
  }[accent];
  return (
    <div
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: palette.title,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

/** Подробный анализ — все длинные блоки в аккордеонах (по умолчанию закрыты). */
function DeepDiveAccordions({ decode }: { decode: ReelDecodeDTO }) {
  const a = decode.analysis;
  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: MUTED,
          fontWeight: 700,
          paddingLeft: 4,
          marginBottom: 2,
        }}
      >
        Подробный анализ
      </div>

      <Accordion title="🎯 Хук и первые секунды">
        <HookQuote hook={a.hook} />
      </Accordion>

      {a.storyboard && a.storyboard.length > 0 ? (
        <Accordion title="🎬 Раскадровка по сценам">
          <Storyboard scenes={a.storyboard} />
        </Accordion>
      ) : (
        <Accordion title="📐 Структура ролика">
          <Section title="" accent="cyan">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {a.structure.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 10 }}>
                  <div
                    style={{
                      flexShrink: 0,
                      fontSize: 10,
                      color: "#7AC8FF",
                      fontWeight: 700,
                      width: 50,
                      paddingTop: 2,
                    }}
                  >
                    {fmtTime(s.start)}–{fmtTime(s.end)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.45 }}>
                      {s.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </Accordion>
      )}

      {a.engagement_triggers && a.engagement_triggers.length > 0 && (
        <Accordion title="🧲 Психологические триггеры">
          <Section title="" accent="orange">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {a.engagement_triggers.map((t, i) => (
                <span
                  key={i}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 999,
                    background: "rgba(240,160,48,0.10)",
                    border: "1px solid rgba(240,160,48,0.35)",
                    fontSize: 12,
                    color: "#FFC480",
                    fontWeight: 600,
                  }}
                >
                  {clean(t)}
                </span>
              ))}
            </div>
          </Section>
        </Accordion>
      )}

      <Accordion title="🔥 Почему ролик сработал">
        <Section title="" accent="orange">
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {a.why_works.map((w, i) => (
              <li
                key={i}
                style={{
                  fontSize: 13,
                  lineHeight: 1.45,
                  paddingLeft: 14,
                  position: "relative",
                }}
              >
                <span style={{ position: "absolute", left: 0, color: "#FFC480" }}>·</span>
                {clean(w)}
              </li>
            ))}
          </ul>
        </Section>
      </Accordion>

      {a.takeaways && a.takeaways.length > 0 && (
        <Accordion title="🎯 Что взять в свой контент (полностью)">
          <Section title="" accent="green">
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {a.takeaways.map((t, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: 13,
                    lineHeight: 1.45,
                    paddingLeft: 22,
                    position: "relative",
                  }}
                >
                  <span
                    style={{ position: "absolute", left: 0, color: "#5BD66B", fontWeight: 800 }}
                  >
                    {i + 1}.
                  </span>
                  {clean(t)}
                </li>
              ))}
            </ul>
          </Section>
        </Accordion>
      )}

      {a.shoot_yourself && a.shoot_yourself.length > 0 && (
        <Accordion title="🎬 Как снять похожий формат">
          <Section title="" accent="cyan">
            <ol
              style={{
                margin: 0,
                paddingLeft: 18,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {a.shoot_yourself.map((s, i) => (
                <li key={i} style={{ fontSize: 13, lineHeight: 1.45, color: INK }}>
                  {clean(s.replace(/^\d+\.\s*/, ""))}
                </li>
              ))}
            </ol>
          </Section>
        </Accordion>
      )}

      {a.adapt_to_brand && (
        <Accordion title="✨ Старый сценарий под нишу (legacy)">
          <Section title="" highlight>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
              {a.adapt_to_brand}
            </p>
            <CopyButton text={a.adapt_to_brand} />
          </Section>
        </Accordion>
      )}

      {decode.transcript && (
        <Accordion title="📝 Оригинальный транскрипт">
          <div
            style={{
              fontSize: 12,
              color: MUTED,
              lineHeight: 1.55,
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 12,
              padding: 12,
              whiteSpace: "pre-wrap",
            }}
          >
            {decode.transcript}
          </div>
        </Accordion>
      )}
    </div>
  );
}

/** Простой аккордеон с заголовком — по умолчанию закрыт. */
function Accordion({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => {
          hapticImpact("light");
          setOpen((v) => !v);
        }}
        style={{
          appearance: "none",
          width: "100%",
          background: "transparent",
          border: "none",
          color: INK,
          fontFamily: "inherit",
          padding: "12px 14px",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span style={{ flex: 1 }}>{title}</span>
        <span
          style={{
            color: MUTED,
            fontSize: 13,
            transition: "transform 200ms",
            transform: open ? "rotate(90deg)" : "none",
          }}
        >
          ›
        </span>
      </button>
      {open && <div style={{ padding: "0 14px 14px" }}>{children}</div>}
    </div>
  );
}

function HookQuote({ hook }: { hook: ReelDecodeDTO["analysis"]["hook"] }) {
  const quote = clean(hook.verbatim_quote || hook.text);
  const desc = clean(hook.text);
  return (
    <div
      style={{
        background:
          "linear-gradient(135deg, rgba(221,42,123,0.10) 0%, rgba(221,42,123,0.03) 100%)",
        border: "1px solid rgba(221,42,123,0.30)",
        borderRadius: 16,
        padding: 16,
        position: "relative",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#F58AC0",
          marginBottom: 10,
        }}
      >
        🎯 Hook · {hook.type}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div
          style={{
            flexShrink: 0,
            width: 4,
            background: `linear-gradient(180deg, #F58529 0%, #DD2A7B 100%)`,
            borderRadius: 4,
          }}
        />
        <div style={{ flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1.3,
              letterSpacing: "-0.01em",
              color: INK,
            }}
          >
            «{quote}»
          </p>
          {hook.verbatim_quote && desc && desc !== quote && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.4 }}>
              {desc}
            </p>
          )}
          <div style={{ marginTop: 8, fontSize: 11, color: SUB_MUTED }}>
            Первые {hook.seconds} сек
          </div>
        </div>
      </div>
    </div>
  );
}

function Storyboard({ scenes }: { scenes: NonNullable<ReelDecodeDTO["analysis"]["storyboard"]> }) {
  return (
    <Section title="🎬 Раскадровка" accent="cyan">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {scenes.map((s) => (
          <div key={s.scene} style={{ display: "flex", gap: 12 }}>
            <div
              style={{
                flexShrink: 0,
                width: 56,
                paddingTop: 2,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: "#7AC8FF" }}>
                Сцена {s.scene}
              </div>
              <div style={{ fontSize: 10, color: SUB_MUTED }}>
                {fmtTime(s.start)}–{fmtTime(s.end)}
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              {s.what_in_frame && (
                <div style={{ fontSize: 12, lineHeight: 1.45 }}>
                  <span style={{ color: "#7AC8FF", fontWeight: 700 }}>В кадре: </span>
                  <span>{clean(s.what_in_frame)}</span>
                </div>
              )}
              {s.what_said && (
                <div style={{ fontSize: 12, lineHeight: 1.45 }}>
                  <span style={{ color: "#7AC8FF", fontWeight: 700 }}>Говорит: </span>
                  <span style={{ color: INK }}>{clean(s.what_said)}</span>
                </div>
              )}
              {s.effect && (
                <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.45 }}>
                  <span style={{ fontWeight: 700, color: SUB_MUTED }}>Эффект: </span>
                  {clean(s.effect)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Stat({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div style={{ flex: 1 }}>
      <div
        style={{
          fontSize: dim ? 12 : 16,
          fontWeight: dim ? 600 : 800,
          color: dim ? SUB_MUTED : INK,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 10, color: SUB_MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
    </div>
  );
}

type Accent = "yellow" | "cyan" | "orange" | "green" | "pink";

const ACCENT_COLORS: Record<Accent, { bg: string; border: string; title: string }> = {
  yellow: { bg: "rgba(245,231,10,0.08)", border: "rgba(245,231,10,0.30)", title: "#F5E70A" },
  cyan: { bg: "rgba(122,200,255,0.06)", border: "rgba(122,200,255,0.28)", title: "#7AC8FF" },
  orange: { bg: "rgba(240,160,48,0.06)", border: "rgba(240,160,48,0.28)", title: "#FFC480" },
  green: { bg: "rgba(91,214,107,0.06)", border: "rgba(91,214,107,0.28)", title: "#5BD66B" },
  pink: { bg: "rgba(221,42,123,0.08)", border: "rgba(221,42,123,0.28)", title: "#F58AC0" },
};

function Section({
  title,
  children,
  highlight,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  highlight?: boolean;
  accent?: Accent;
}) {
  const palette = accent ? ACCENT_COLORS[accent] : null;
  const isHighlight = highlight || accent === "yellow";
  return (
    <div
      style={{
        background: isHighlight
          ? `linear-gradient(135deg, rgba(245,231,10,0.08) 0%, rgba(245,231,10,0.02) 100%)`
          : palette
          ? palette.bg
          : CARD_BG,
        border: isHighlight
          ? `1px solid rgba(245,231,10,0.30)`
          : palette
          ? `1px solid ${palette.border}`
          : `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: isHighlight ? YELLOW : palette ? palette.title : MUTED,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function TranscriptToggle({ transcript }: { transcript: string }) {
  const [open, setOpen] = useState(false);
  if (!transcript) return null;
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          color: MUTED,
          fontSize: 11,
          padding: "8px 0",
          cursor: "pointer",
          fontFamily: "inherit",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {open ? "▲ скрыть транскрипт" : "▼ показать транскрипт"}
      </button>
      {open && (
        <div
          style={{
            fontSize: 12,
            color: MUTED,
            lineHeight: 1.55,
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 12,
            padding: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {transcript}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            hapticNotify("success");
            setDone(true);
            setTimeout(() => setDone(false), 1800);
          },
          () => hapticNotify("error"),
        );
      }}
      style={{
        marginTop: 10,
        width: "100%",
        padding: "10px 14px",
        border: "none",
        borderRadius: 12,
        background: done ? "rgba(91,214,107,0.18)" : "rgba(245,231,10,0.16)",
        color: done ? "#5BD66B" : YELLOW,
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      {done ? "✓ Скопировано" : "📋 Скопировать сценарий"}
    </button>
  );
}

// Чистим строки от лишних кавычек/символов в начале и конце.
// Claude часто возвращает 'строка' или "строка" — снимаем эти обёртки.
function clean(s: string): string {
  if (!s) return "";
  let r = String(s).trim();
  // Убираем парные кавычки в начале и конце (одинарные, двойные, ёлочки)
  const pairs: [string, string][] = [
    ["«", "»"],
    ['"', '"'],
    ["'", "'"],
    ["“", "”"],
    ["‘", "’"],
    ["`", "`"],
  ];
  for (const [a, b] of pairs) {
    if (r.startsWith(a) && r.endsWith(b) && r.length > 2) {
      r = r.slice(a.length, -b.length).trim();
    }
  }
  // Снимаем висящие точку или запятую в самом начале (если AI странно вернул)
  r = r.replace(/^[.,;:]\s*/, "");
  return r;
}

function UpsellCard({ quota }: { quota: ReelQuotaDTO }) {
  const left = Math.max(0, quota.limit - quota.used);
  const headline =
    left === 0
      ? "Это был последний бесплатный разбор"
      : "Остался 1 бесплатный разбор";
  const sub =
    left === 0
      ? "На Pro ты получишь ещё 30 разборов в этом месяце — и сможешь сравнивать формулы Reels десятками."
      : "Сразу прокачайся на Pro: 30 разборов в месяц, безлимит постов и приоритет в генерации.";
  return (
    <div
      style={{
        marginTop: 16,
        padding: 18,
        borderRadius: 18,
        background:
          "linear-gradient(135deg, rgba(221,42,123,0.16) 0%, rgba(245,133,41,0.14) 50%, rgba(245,231,10,0.10) 100%)",
        border: "1px solid rgba(245,231,10,0.30)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 800,
          color: YELLOW,
          marginBottom: 8,
        }}
      >
        🚀 Прокачайся до Pro
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.25, marginBottom: 6 }}>
        {headline}
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
        {sub}
      </p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: YELLOW, letterSpacing: "-0.02em" }}>
          490 ₽
        </span>
        <span style={{ fontSize: 12, color: SUB_MUTED }}>/ мес · отмена в один клик</span>
      </div>
      <a
        href="/billing"
        onClick={() => hapticImpact("medium")}
        style={{
          display: "block",
          textAlign: "center",
          padding: "14px 0",
          borderRadius: 999,
          background: `linear-gradient(135deg, #FFF382 0%, ${YELLOW} 50%, #E5C500 100%)`,
          color: "#0A0608",
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          textDecoration: "none",
          boxShadow: `0 14px 32px rgba(245,231,10,0.40), 0 0 0 1px rgba(255,255,255,0.16) inset`,
        }}
      >
        Получить 30 разборов →
      </a>
    </div>
  );
}

function HowToGetLink() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(HINT_DISMISS_KEY) === "1"); } catch {}
  }, []);

  if (dismissed) return null;

  return (
    <div
      style={{
        marginBottom: 12,
        background: "rgba(122,200,255,0.06)",
        border: "1px solid rgba(122,200,255,0.22)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => { hapticImpact("light"); setOpen((v) => !v); }}
        style={{
          appearance: "none",
          width: "100%",
          background: "transparent",
          border: "none",
          color: INK,
          fontFamily: "inherit",
          padding: "10px 12px",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
        }}
      >
        <span style={{ fontSize: 14 }}>🎬</span>
        <span style={{ flex: 1, fontWeight: 600 }}>
          Как взять ссылку на Reels
        </span>
        <span style={{ color: MUTED, fontSize: 12, transition: "transform 200ms", transform: open ? "rotate(90deg)" : "none" }}>›</span>
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px", fontSize: 12, color: MUTED, lineHeight: 1.55 }}>
          <ol style={{ margin: "0 0 10px", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            <li>Открой нужный Reels в Instagram (свой или чужой — любой публичный)</li>
            <li>Нажми меню <b style={{ color: INK }}>⋯</b> в правом верхнем углу видео</li>
            <li>Выбери <b style={{ color: INK }}>«Копировать ссылку»</b></li>
            <li>Вставь её в поле ниже</li>
          </ol>
          <div style={{ fontSize: 11, color: SUB_MUTED, marginBottom: 8 }}>
            💡 Подойдёт любой Reels: конкурента, лидера ниши, вирусный — LEX покажет почему он работает.
          </div>
          <button
            onClick={() => {
              try { localStorage.setItem(HINT_DISMISS_KEY, "1"); } catch {}
              setDismissed(true);
            }}
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              color: SUB_MUTED,
              fontFamily: "inherit",
              fontSize: 11,
              padding: 0,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Понятно, больше не показывать
          </button>
        </div>
      )}
    </div>
  );
}

function fmtTime(sec: number): string {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * Превращает техническую ошибку разбора в человечное состояние: что
 * случилось + что делать (бриф раздел 23). НЕ обрабатывает квоту — ветка
 * лимита/paywall живёт отдельно.
 */
function humanizeDecodeError(e: any): DecodeError {
  const msg = String(e?.message || "").toLowerCase();
  const status: number | undefined = typeof e?.status === "number" ? e.status : undefined;

  // Нет сети: fetch упал без ответа сервера.
  if (
    e?.name === "TypeError" ||
    /failed to fetch|networkerror|network request failed|load failed/.test(msg)
  ) {
    return {
      emoji: "🔌",
      title: "Нет связи",
      body: "Проверь интернет и повтори — LEX не смог отправить запрос.",
      primary: "retry",
    };
  }

  // Некорректная ссылка.
  if (
    status === 400 ||
    /распознать ссылку|распознать instagram|url required|формат instagram/.test(msg)
  ) {
    return {
      emoji: "🔗",
      title: "Не похоже на ссылку Reels",
      body: "Нужен формат instagram.com/reel/… Скопируй ссылку прямо из Instagram и вставь снова.",
      primary: "edit",
    };
  }

  // Статичный пост вместо видео.
  if (/статичный пост|не reels|не видео/.test(msg)) {
    return {
      emoji: "🖼",
      title: "Это не Reels, а пост",
      body: "Похоже, ссылка ведёт на фото-пост. Нужна ссылка именно на видео-Reels.",
      primary: "edit",
    };
  }

  // Приватный/недоступный/удалённый ролик.
  if (/публичный|без логина|скачать видео|not found|404|private|приват|закрыт|удал/.test(msg)) {
    return {
      emoji: "🔒",
      title: "Не удалось получить этот Reels",
      body: "Возможно, аккаунт закрыт или публикация удалена. Попробуй другую ссылку.",
      primary: "edit",
    };
  }

  // Всё остальное — временный сбой обработки (RapidAPI/Whisper/Claude/5xx).
  return {
    emoji: "⚠️",
    title: "Не получилось разобрать ролик",
    body: "LEX не смог обработать это видео. Попробуй ещё раз или другую ссылку.",
    primary: "retry",
  };
}
