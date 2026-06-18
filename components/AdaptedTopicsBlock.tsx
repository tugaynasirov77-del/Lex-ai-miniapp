"use client";

import { useEffect, useState } from "react";
import {
  adaptDecodeToTopics,
  refineMyTopic,
  type AdaptedTopicDTO,
} from "../lib/api";
import { hapticImpact, hapticNotify } from "../lib/telegram";
import { track } from "../lib/analytics";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const SUB_MUTED = "rgba(255,255,255,0.42)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.10)";

type Props = {
  projectId: string;
  decodeId: string;
  /** Открывает экран персонального сценария по выбранной теме. */
  onCreateScript: (topic: AdaptedTopicDTO) => void;
};

/**
 * Блок «3 адаптированные темы под проект» — показывается под результатом разбора Reels.
 *
 * Логика:
 *  - На mount загружает 3 темы из /api/projects/[id]/ig/adapt
 *  - Юзер выбирает одну (или нажимает «У меня есть своя идея» → refine)
 *  - Кнопка «Создать мой Reels» (sticky внизу блока) ведёт в PersonalScriptScreen
 */
export default function AdaptedTopicsBlock({ projectId, decodeId, onCreateScript }: Props) {
  const [topics, setTopics] = useState<AdaptedTopicDTO[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [refining, setRefining] = useState(false);
  const [showIdeaInput, setShowIdeaInput] = useState(false);
  const [userIdea, setUserIdea] = useState("");
  const [refineErr, setRefineErr] = useState<string | null>(null);

  // Загружаем темы при mount
  useEffect(() => {
    let alive = true;
    setTopics(null);
    setLoadErr(null);
    adaptDecodeToTopics(projectId, decodeId)
      .then((r) => {
        if (!alive) return;
        // Присваиваем стабильные client-side id для key
        const withIds = r.topics.map((t, i) => ({ ...t, id: `topic-${i}` }));
        setTopics(withIds);
        track("adaptation_viewed", { project_id: projectId, count: withIds.length });
      })
      .catch((e: any) => {
        if (!alive) return;
        setLoadErr(e?.message || "Не получилось загрузить темы");
      });
    return () => {
      alive = false;
    };
  }, [projectId, decodeId]);

  async function submitMyIdea() {
    if (userIdea.trim().length < 5 || refining) return;
    setRefining(true);
    setRefineErr(null);
    hapticImpact("medium");
    try {
      const r = await refineMyTopic(projectId, decodeId, userIdea.trim());
      hapticNotify("success");
      const newTopic: AdaptedTopicDTO = { ...r.topic, id: "topic-my" };
      // Подменяем 4-й слот выбранной идеей и сразу подсвечиваем
      setTopics((prev) => {
        const base = (prev || []).filter((t) => t.id !== "topic-my");
        return [...base, newTopic];
      });
      setSelectedIdx((topics || []).length);
      setShowIdeaInput(false);
    } catch (e: any) {
      hapticNotify("error");
      setRefineErr(e?.message || "Не получилось");
    } finally {
      setRefining(false);
    }
  }

  const canCreate = selectedIdx !== null && topics && topics[selectedIdx];

  return (
    <div
      style={{
        position: "relative",
        marginTop: 18,
        padding: 18,
        borderRadius: 20,
        background:
          "radial-gradient(circle 220px at 0% 0%, rgba(245,231,10,0.10), transparent 60%)," +
          "linear-gradient(135deg, #1A1305 0%, #0A0805 100%)",
        border: "1px solid rgba(245,231,10,0.20)",
        boxShadow: "0 18px 44px rgba(245,231,10,0.08)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 800,
          color: YELLOW,
        }}
      >
        ⚡ Адаптация под ваш блог
      </div>
      <h2
        style={{
          margin: "8px 0 6px",
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
        }}
      >
        LEX уже адаптировал механику
      </h2>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
        Выберите одну из 3 тем для своего Reels — или предложите свою идею, LEX усилит её.
      </p>

      {/* Loading */}
      {topics === null && !loadErr && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 120,
                borderRadius: 14,
                background: CARD_BG,
                border: `1px solid ${CARD_BORDER}`,
                opacity: 0.6 - i * 0.15,
              }}
            />
          ))}
          <div style={{ textAlign: "center", fontSize: 12, color: MUTED, marginTop: 4 }}>
            Подбираем 3 темы под вашу нишу…
          </div>
        </div>
      )}

      {/* Error */}
      {loadErr && (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,115,115,0.08)",
            border: "1px solid rgba(255,115,115,0.30)",
            fontSize: 12,
            color: "#FF8B8B",
          }}
        >
          {loadErr}
        </div>
      )}

      {/* Topic cards */}
      {topics && topics.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {topics.map((t, i) => (
            <TopicCard
              key={t.id || i}
              topic={t}
              isSelected={selectedIdx === i}
              isMyIdea={t.id === "topic-my"}
              onSelect={() => {
                hapticImpact("light");
                setSelectedIdx(i);
              }}
            />
          ))}
        </div>
      )}

      {/* «У меня есть своя идея» */}
      {topics && topics.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {!showIdeaInput ? (
            <button
              onClick={() => {
                hapticImpact("light");
                setShowIdeaInput(true);
              }}
              style={{
                appearance: "none",
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: `1px dashed ${CARD_BORDER}`,
                background: "transparent",
                color: MUTED,
                fontFamily: "inherit",
                fontSize: 13,
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              ✏️ У меня есть своя идея — LEX её усилит
            </button>
          ) : (
            <div
              style={{
                padding: 12,
                borderRadius: 14,
                background: CARD_BG,
                border: `1px solid ${CARD_BORDER}`,
              }}
            >
              <textarea
                value={userIdea}
                onChange={(e) => {
                  setUserIdea(e.target.value);
                  if (refineErr) setRefineErr(null);
                }}
                placeholder="Опишите свою идею для Reels (2-3 строки)"
                rows={3}
                maxLength={500}
                disabled={refining}
                style={{
                  appearance: "none",
                  width: "100%",
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 10,
                  color: INK,
                  fontFamily: "inherit",
                  fontSize: 14,
                  outline: "none",
                  resize: "vertical",
                  minHeight: 60,
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => {
                    hapticImpact("light");
                    setShowIdeaInput(false);
                    setUserIdea("");
                    setRefineErr(null);
                  }}
                  disabled={refining}
                  style={{
                    appearance: "none",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: `1px solid ${CARD_BORDER}`,
                    background: "transparent",
                    color: MUTED,
                    fontFamily: "inherit",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Отмена
                </button>
                <button
                  onClick={submitMyIdea}
                  disabled={refining || userIdea.trim().length < 5}
                  style={{
                    appearance: "none",
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "none",
                    background:
                      refining || userIdea.trim().length < 5
                        ? "rgba(255,255,255,0.08)"
                        : `linear-gradient(135deg, #FFF382 0%, ${YELLOW} 100%)`,
                    color:
                      refining || userIdea.trim().length < 5 ? MUTED : "#0A0608",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: refining ? "wait" : "pointer",
                  }}
                >
                  {refining ? "Усиливаю…" : "✨ Усилить идею"}
                </button>
              </div>
              {refineErr && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#FF8B8B" }}>{refineErr}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sticky CTA — «Создать мой Reels» */}
      {canCreate && (
        <button
          onClick={() => {
            hapticImpact("medium");
            const t = topics![selectedIdx!];
            track("adaptation_topic_selected", {
              project_id: projectId,
              is_own_idea: t.id === "topic-my",
            });
            onCreateScript(t);
          }}
          style={{
            appearance: "none",
            position: "sticky",
            bottom: 14,
            marginTop: 18,
            width: "100%",
            padding: "16px 0",
            border: "none",
            borderRadius: 999,
            background: `linear-gradient(135deg, #FFF382 0%, ${YELLOW} 50%, #E5C500 100%)`,
            color: "#0A0608",
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontFamily: "inherit",
            cursor: "pointer",
            boxShadow: `0 16px 36px rgba(245,231,10,0.45), 0 0 0 1px rgba(255,255,255,0.18) inset`,
            zIndex: 5,
          }}
        >
          🎬 Создать мой Reels
        </button>
      )}

      {/* hint about SUB_MUTED — keeps lint happy */}
      <span style={{ display: "none", color: SUB_MUTED }} aria-hidden />
    </div>
  );
}

function TopicCard({
  topic,
  isSelected,
  isMyIdea,
  onSelect,
}: {
  topic: AdaptedTopicDTO;
  isSelected: boolean;
  isMyIdea?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        appearance: "none",
        textAlign: "left",
        width: "100%",
        padding: 14,
        borderRadius: 16,
        border: `1.5px solid ${isSelected ? YELLOW : CARD_BORDER}`,
        background: isSelected
          ? "rgba(245,231,10,0.08)"
          : CARD_BG,
        color: INK,
        fontFamily: "inherit",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxShadow: isSelected
          ? "0 12px 32px rgba(245,231,10,0.18), 0 0 0 1px rgba(255,255,255,0.06) inset"
          : "none",
        transition: "border-color 200ms, background 200ms",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {isMyIdea && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.08em",
              padding: "2px 6px",
              borderRadius: 6,
              background: "rgba(245,231,10,0.18)",
              color: YELLOW,
            }}
          >
            ВАША ИДЕЯ
          </span>
        )}
        <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25, flex: 1 }}>
          {topic.title}
        </div>
      </div>

      <div
        style={{
          background: "rgba(221,42,123,0.10)",
          border: "1px solid rgba(221,42,123,0.25)",
          borderRadius: 10,
          padding: "8px 10px",
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#F58AC0",
            marginBottom: 4,
          }}
        >
          🎯 Хук
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.4 }}>
          «{topic.hook}»
        </div>
      </div>

      <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{topic.rationale}</div>

      <div style={{ display: "flex", gap: 10, fontSize: 11, color: SUB_MUTED }}>
        <span>📹 {topic.format}</span>
        <span>·</span>
        <span>⏱ ~{topic.duration_sec} сек</span>
      </div>

      <div
        style={{
          marginTop: 4,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: isSelected ? YELLOW : MUTED,
        }}
      >
        {isSelected ? "✓ Выбрано" : "Выбрать эту тему →"}
      </div>
    </button>
  );
}
