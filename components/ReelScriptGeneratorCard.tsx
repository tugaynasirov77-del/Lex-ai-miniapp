"use client";

import { useState } from "react";
import { lexWriteReel, getDailyIdeas, refineIdeaStandalone, type LexReelScript, type DailyIdeaDTO, type AdaptedTopicDTO } from "../lib/api";
import { hapticImpact, hapticNotify, hapticSelection } from "../lib/telegram";
import PaywallSheet from "./PaywallSheet";

const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const SUB_MUTED = "rgba(255,255,255,0.42)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const ORANGE = "#FFC480";

type Props = { projectId: string };
type Duration = 15 | 30 | 60;

export default function ReelScriptGeneratorCard({ projectId }: Props) {
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState<Duration>(30);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [script, setScript] = useState<LexReelScript | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  // §14: доп. стиль подачи (мульти-выбор, дописывается в тему-промпт).
  const [styles, setStyles] = useState<string[]>([]);
  function toggleStyle(s: string) {
    hapticImpact("light");
    setStyles((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  // §14: «Мы усилили вашу идею» — refine сырой формулировки.
  const [refining, setRefining] = useState(false);
  const [refined, setRefined] = useState<AdaptedTopicDTO | null>(null);

  async function enhanceIdea() {
    if (topic.trim().length < 5 || refining || busy) return;
    setRefining(true);
    setErr(null);
    hapticImpact("light");
    try {
      const r = await refineIdeaStandalone(projectId, topic.trim());
      setRefined(r.topic);
      hapticNotify("success");
    } catch (e: any) {
      hapticNotify("error");
      setErr(e?.message || "Не получилось усилить идею");
    } finally {
      setRefining(false);
    }
  }

  // §14: вилка «есть тема / подскажи идею».
  const [mode, setMode] = useState<"own" | "suggest">("own");
  const [ideas, setIdeas] = useState<DailyIdeaDTO[] | null>(null);
  const [ideasLoading, setIdeasLoading] = useState(false);

  async function loadIdeas() {
    if (ideas || ideasLoading) return;
    setIdeasLoading(true);
    try {
      const r = await getDailyIdeas(projectId);
      setIdeas(r.ideas);
    } catch {
      setIdeas([]);
    } finally {
      setIdeasLoading(false);
    }
  }

  function pickIdea(idea: DailyIdeaDTO) {
    hapticSelection();
    setTopic(idea.hook || idea.title);
    setMode("own");
  }

  async function run() {
    if (topic.trim().length < 5 || busy) return;
    setBusy(true);
    setErr(null);
    setScript(null);
    hapticImpact("medium");
    try {
      const enriched = styles.length
        ? `${topic.trim()} (формат: ${styles.join(", ")})`
        : topic.trim();
      const r = await lexWriteReel(projectId, enriched, duration);
      setScript(r.script);
      hapticNotify("success");
    } catch (e: any) {
      hapticNotify("error");
      if (e?.status === 402) {
        setPaywallOpen(true);
        return;
      }
      setErr(e?.message || "Не получилось сгенерировать");
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
        marginTop: 18,
        overflow: "hidden",
        background:
          "radial-gradient(circle 200px at 100% 0%, rgba(255,196,128,0.16), transparent 60%)," +
          "radial-gradient(circle 200px at 0% 100%, rgba(240,160,48,0.18), transparent 60%)," +
          "linear-gradient(135deg, #160F08 0%, #0A0805 100%)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 18px 44px rgba(240,160,48,0.10)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: ORANGE,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 800,
        }}
      >
        AI · Сценарии Reels
      </div>
      <h2
        style={{
          margin: "8px 0 6px",
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
        }}
      >
        Сценарий Reels с нуля
      </h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
        Опиши тему и длительность — получи готовый сценарий с раскадровкой,
        хуком, подписью и подбором музыки.
      </p>

      {/* §14: выбор «есть тема / подскажи идею» */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {([["own", "У меня есть тема"], ["suggest", "Подскажи идею"]] as const).map(([m, label]) => (
          <button
            key={m}
            onClick={() => {
              hapticImpact("light");
              setMode(m);
              if (m === "suggest") void loadIdeas();
            }}
            disabled={busy}
            style={{
              appearance: "none", flex: 1, padding: "9px 0", borderRadius: 10,
              border: `1px solid ${mode === m ? ORANGE : CARD_BORDER}`,
              background: mode === m ? "rgba(240,160,48,0.12)" : "rgba(255,255,255,0.04)",
              color: mode === m ? ORANGE : MUTED, fontFamily: "inherit",
              fontSize: 12.5, fontWeight: mode === m ? 800 : 600, cursor: busy ? "wait" : "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "suggest" && (
        <div style={{ marginBottom: 12 }}>
          {ideasLoading && !ideas ? (
            <div style={{ fontSize: 12, color: MUTED, textAlign: "center", padding: 12 }}>
              Подбираю идеи под твою нишу…
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(ideas || []).map((idea, i) => (
                <button
                  key={i}
                  onClick={() => pickIdea(idea)}
                  style={{
                    appearance: "none", textAlign: "left", width: "100%", padding: "11px 12px",
                    borderRadius: 12, border: `1px solid ${CARD_BORDER}`, background: "rgba(255,255,255,0.04)",
                    color: INK, fontFamily: "inherit", cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>{idea.title}</div>
                  {idea.hook && (
                    <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3, lineHeight: 1.4 }}>«{idea.hook}»</div>
                  )}
                </button>
              ))}
              {ideas && ideas.length === 0 && (
                <div style={{ fontSize: 12, color: SUB_MUTED, textAlign: "center", padding: 8 }}>
                  Идеи не загрузились — введи тему вручную.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
            if (refined) setRefined(null);
            if (err) setErr(null);
          }}
          placeholder="Например: показываю 3 фишки макияжа за 30 секунд"
          rows={2}
          maxLength={500}
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
            resize: "vertical",
            minHeight: 60,
          }}
          disabled={busy}
        />

        {/* §14: усилить сырую формулировку */}
        {topic.trim().length >= 5 && !refined && (
          <button
            onClick={enhanceIdea}
            disabled={refining || busy}
            style={{
              appearance: "none", alignSelf: "flex-start", padding: "8px 14px", borderRadius: 999,
              border: `1px solid ${ORANGE}`, background: "rgba(240,160,48,0.10)", color: ORANGE,
              fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: refining ? "wait" : "pointer",
            }}
          >
            {refining ? "Усиливаю…" : "Усилить идею"}
          </button>
        )}

        {refined && (
          <div style={{ padding: 12, borderRadius: 14, background: "rgba(240,160,48,0.07)", border: `1px solid rgba(240,160,48,0.28)` }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: ORANGE, marginBottom: 8 }}>
              Мы усилили вашу идею
            </div>
            <div style={{ fontSize: 11, color: SUB_MUTED, marginBottom: 2 }}>Было</div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 8, lineHeight: 1.4 }}>{topic.trim()}</div>
            <div style={{ fontSize: 11, color: SUB_MUTED, marginBottom: 2 }}>Стало</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: INK, lineHeight: 1.35, marginBottom: 4 }}>{refined.title}</div>
            <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.4, marginBottom: 10 }}>«{refined.hook}»</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { hapticSelection(); setTopic(refined.hook || refined.title); setRefined(null); }}
                style={{ appearance: "none", flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #FFD58A 0%, #F0A030 50%, #C97D10 100%)", color: "#1A0E04", fontFamily: "inherit", fontSize: 13, fontWeight: 800, cursor: "pointer" }}
              >
                Использовать
              </button>
              <button
                onClick={() => { hapticImpact("light"); setRefined(null); }}
                style={{ appearance: "none", padding: "10px 16px", borderRadius: 10, border: `1px solid ${CARD_BORDER}`, background: "transparent", color: MUTED, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Оставить
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 6 }}>
          {([15, 30, 60] as Duration[]).map((d) => (
            <button
              key={d}
              onClick={() => {
                hapticImpact("light");
                setDuration(d);
              }}
              disabled={busy}
              style={{
                appearance: "none",
                flex: 1,
                padding: "10px 0",
                borderRadius: 12,
                border: `1px solid ${duration === d ? ORANGE : CARD_BORDER}`,
                background:
                  duration === d ? "rgba(240,160,48,0.12)" : "rgba(255,255,255,0.04)",
                color: duration === d ? ORANGE : MUTED,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: duration === d ? 800 : 600,
                cursor: busy ? "wait" : "pointer",
              }}
            >
              {d} сек
            </button>
          ))}
        </div>

        {/* §14: доп. формат подачи (опционально) */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {["разговорное", "voice-over", "без лица", "тренд", "экспертно", "storytelling"].map((s) => {
            const on = styles.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleStyle(s)}
                disabled={busy}
                style={{
                  appearance: "none", padding: "7px 12px", borderRadius: 999,
                  border: `1px solid ${on ? ORANGE : CARD_BORDER}`,
                  background: on ? "rgba(240,160,48,0.12)" : "rgba(255,255,255,0.04)",
                  color: on ? ORANGE : MUTED, fontFamily: "inherit",
                  fontSize: 12, fontWeight: on ? 800 : 600, cursor: busy ? "wait" : "pointer",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>

        <button
          onClick={run}
          disabled={busy || topic.trim().length < 5}
          style={{
            appearance: "none",
            width: "100%",
            padding: "13px 0",
            border: "none",
            borderRadius: 999,
            background:
              busy || topic.trim().length < 5
                ? "rgba(255,255,255,0.08)"
                : "linear-gradient(135deg, #FFD58A 0%, #F0A030 50%, #C97D10 100%)",
            color: busy || topic.trim().length < 5 ? MUTED : "#1A0E04",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontFamily: "inherit",
            cursor: busy || topic.trim().length < 5 ? "not-allowed" : "pointer",
            boxShadow:
              busy || topic.trim().length < 5
                ? "none"
                : "0 12px 28px rgba(240,160,48,0.36), 0 0 0 1px rgba(255,255,255,0.16) inset",
          }}
        >
          {busy ? "Пишу сценарий…" : "Сгенерировать сценарий"}
        </button>
      </div>

      {err && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 10,
            background: "rgba(255,115,115,0.08)",
            border: "1px solid rgba(255,115,115,0.30)",
            fontSize: 12,
            color: "#FF8B8B",
          }}
        >
          {err}
        </div>
      )}

      {script && <ScriptResult script={script} />}

      {paywallOpen && (
        <PaywallSheet variant="limit_reached" onClose={() => setPaywallOpen(false)} />
      )}
    </div>
  );
}

function ScriptResult({ script }: { script: LexReelScript }) {
  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Hook */}
      <div
        style={{
          padding: 14,
          borderRadius: 14,
          background: "rgba(240,160,48,0.10)",
          border: "1px solid rgba(240,160,48,0.30)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: ORANGE,
            fontWeight: 800,
            marginBottom: 6,
          }}
        >
          Hook · первые 2-3 сек
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
          {script.hook}
        </div>
      </div>

      {/* Scenes */}
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
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: ORANGE,
            fontWeight: 800,
            marginBottom: 10,
          }}
        >
          Раскадровка · {script.duration_sec} сек
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {script.scenes.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 10 }}>
              <div
                style={{
                  flexShrink: 0,
                  width: 56,
                  paddingTop: 2,
                  fontSize: 11,
                  color: ORANGE,
                  fontWeight: 800,
                }}
              >
                {s.seconds}
              </div>
              <div style={{ flex: 1, fontSize: 13, lineHeight: 1.45 }}>
                <div style={{ color: INK }}>{s.action}</div>
                {s.on_screen && (
                  <div style={{ marginTop: 2, color: MUTED, fontSize: 12 }}>
                    <span style={{ color: SUB_MUTED, fontWeight: 700 }}>На экране: </span>
                    {s.on_screen}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Music hint */}
      {script.music_hint && (
        <div
          style={{
            background: "rgba(122,200,255,0.06)",
            border: "1px solid rgba(122,200,255,0.22)",
            borderRadius: 14,
            padding: 14,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#7AC8FF",
              fontWeight: 800,
              marginBottom: 6,
            }}
          >
            Музыка
          </div>
          <div style={{ fontSize: 13, color: INK, lineHeight: 1.45 }}>
            {script.music_hint}
          </div>
        </div>
      )}

      {/* Caption */}
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
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: MUTED,
            fontWeight: 800,
            marginBottom: 8,
          }}
        >
          Подпись
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            color: INK,
          }}
        >
          {script.caption}
        </p>
        <CopyButton text={script.caption} label="Скопировать подпись" />
      </div>

      {/* Hashtags */}
      {script.hashtags && script.hashtags.length > 0 && (
        <div
          style={{
            background: "rgba(122,200,255,0.06)",
            border: "1px solid rgba(122,200,255,0.22)",
            borderRadius: 14,
            padding: 14,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#7AC8FF",
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            # Хештеги · {script.hashtags.length}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {script.hashtags.map((h) => (
              <span
                key={h}
                style={{
                  padding: "4px 9px",
                  borderRadius: 999,
                  background: "rgba(122,200,255,0.10)",
                  border: "1px solid rgba(122,200,255,0.28)",
                  fontSize: 11,
                  color: "#7AC8FF",
                  fontWeight: 600,
                }}
              >
                #{h.replace(/^#+/, "")}
              </span>
            ))}
          </div>
          <CopyButton
            text={script.hashtags.map((h) => `#${h.replace(/^#+/, "")}`).join(" ")}
            label="Скопировать хештеги"
            accent="cyan"
          />
        </div>
      )}

      {/* Полный сценарий — экспорт */}
      <CopyButton
        text={
          `Тема: ${script.topic}\nДлительность: ${script.duration_sec} сек\n\n` +
          `HOOK: ${script.hook}\n\n` +
          `РАСКАДРОВКА:\n` +
          script.scenes
            .map(
              (s) =>
                `${s.seconds} — ${s.action}${s.on_screen ? ` | на экране: ${s.on_screen}` : ""}`,
            )
            .join("\n") +
          (script.music_hint ? `\n\nМузыка: ${script.music_hint}` : "") +
          `\n\nПодпись:\n${script.caption}`
        }
        label="Скопировать весь сценарий"
        accent="orange"
      />
    </div>
  );
}

function CopyButton({
  text,
  label,
  accent = "orange",
}: {
  text: string;
  label: string;
  accent?: "orange" | "cyan";
}) {
  const [done, setDone] = useState(false);
  const color = accent === "cyan" ? "#7AC8FF" : ORANGE;
  const bg = accent === "cyan" ? "rgba(122,200,255,0.16)" : "rgba(240,160,48,0.16)";
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
        marginTop: 12,
        width: "100%",
        padding: "10px 14px",
        border: "none",
        borderRadius: 12,
        background: done ? "rgba(91,214,107,0.20)" : bg,
        color: done ? "#5BD66B" : color,
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      {done ? "✓ Скопировано" : label}
    </button>
  );
}
