"use client";

import { useState } from "react";
import { lexWriteReel, type LexReelScript } from "../lib/api";
import { hapticImpact, hapticNotify } from "../lib/telegram";

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

  async function run() {
    if (topic.trim().length < 5 || busy) return;
    setBusy(true);
    setErr(null);
    setScript(null);
    hapticImpact("medium");
    try {
      const r = await lexWriteReel(projectId, topic.trim(), duration);
      setScript(r.script);
      hapticNotify("success");
    } catch (e: any) {
      hapticNotify("error");
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

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
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
          {busy ? "Пишу сценарий…" : "🎬 Сгенерировать сценарий"}
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
          🎯 Hook · первые 2-3 сек
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
          🎬 Раскадровка · {script.duration_sec} сек
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
            🎵 Музыка
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
          ✏️ Подпись
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
      {done ? "✓ Скопировано" : `📋 ${label}`}
    </button>
  );
}
