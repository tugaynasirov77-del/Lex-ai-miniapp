"use client";

import { useState } from "react";
import { useFlow, useFlowActions, type ContentFormat } from "../../flow";
import { useDraftPolling } from "../../hooks/useDraftPolling";
import { useReelJobPolling } from "../../hooks/useReelJobPolling";
import {
  approveDraft,
  rejectDraft,
  approveWeeklyPlan,
  rejectWeeklyPlan,
  publishReel,
  ApiError,
} from "../../lib/api";
import { hapticImpact, hapticNotify } from "../../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const WARN = "#F39B40";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";

type Props = { onBack: () => void };

function formatSchedule(iso: string | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const time = d.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
    if (sameDay) return `сегодня в ${time}`;
    const date = d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
    return `${date} в ${time}`;
  } catch {
    return null;
  }
}

function doneCopy({
  format,
  approved,
  scheduledAt,
  already,
}: {
  format: ContentFormat;
  approved: boolean;
  scheduledAt?: string;
  already?: boolean;
}): { title: string; body: string } {
  if (!approved) {
    return {
      title: already ? "Уже отклонено" : "Отклонено",
      body: "Черновик не пойдёт в публикацию. Можно сделать новый.",
    };
  }
  if (format === "weekly-plan") {
    return {
      title: already ? "Уже принят" : "План принят",
      body: "Можно собирать карусели и посты по нему.",
    };
  }
  const when = formatSchedule(scheduledAt);
  if (when) {
    return {
      title: already ? "Уже запланировано" : "Запланировано",
      body: `Опубликуем ${when}.`,
    };
  }
  return {
    title: already ? "Уже принято" : "Принято в работу",
    body: "Поставили в очередь публикации.",
  };
}

const FORMAT_LABEL: Record<ContentFormat, string> = {
  post: "TG Пост",
  carousel: "IG Карусель",
  "weekly-plan": "Контент-план на неделю",
  reel: "IG Reel",
};

const DEST_LABEL: Record<ContentFormat, string> = {
  post: "Telegram",
  carousel: "Instagram",
  "weekly-plan": "Telegram / Instagram",
  reel: "Instagram",
};

export default function ReviewScreen({ onBack }: Props) {
  const { state } = useFlow();
  const actions = useFlowActions();
  const { format, draftId, weeklyPlanId, reelJobId } = state;

  const isReel = format === "reel";
  const isPlan = format === "weekly-plan";

  const draftPoll = useDraftPolling(
    isPlan ? "weekly-plan" : "draft",
    isReel ? null : isPlan ? weeklyPlanId : draftId,
  );
  const reelPoll = useReelJobPolling(isReel ? reelJobId : null);

  const [actionState, setActionState] = useState<
    | { kind: "idle" }
    | { kind: "submitting"; which: "approve" | "reject" }
    | {
        kind: "done";
        which: "approve" | "reject";
        scheduledAt?: string;
        already?: boolean;
      }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const [publishState, setPublishState] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "published"; permalink: string | null }
    | { kind: "stub"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  // --- context-lost ---
  const noId =
    !format ||
    (isReel && !reelJobId) ||
    (isPlan && !weeklyPlanId) ||
    (!isReel && !isPlan && !draftId);

  if (noId) {
    return (
      <ScreenWrap>
        <ErrorBlock
          title="Контекст потерян"
          body="Не нашли активный черновик. Начните заново."
          ctaLabel="К ВЫБОРУ ФОРМАТА"
          onCta={() => {
            actions.resetFlow();
            actions.navigate("choose-format");
          }}
        />
      </ScreenWrap>
    );
  }

  const loading = isReel ? !reelPoll.data && !reelPoll.error : !draftPoll.data && !draftPoll.error;
  const pollError = isReel ? reelPoll.error : draftPoll.error;

  if (loading) {
    return (
      <ScreenWrap>
        <Header format={format!} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: MUTED, fontSize: 14 }}>Загружаем результат…</p>
        </div>
      </ScreenWrap>
    );
  }

  if (pollError && !draftPoll.data && !reelPoll.data) {
    return (
      <ScreenWrap>
        <ErrorBlock
          title="Не удалось загрузить"
          body={pollError instanceof Error ? pollError.message : String(pollError)}
          ctaLabel="НАЗАД"
          onCta={onBack}
        />
      </ScreenWrap>
    );
  }

  // --- handlers ---
  const mapError = (e: unknown): string => {
    if (e instanceof ApiError) {
      if (e.status === 409) return "Уже опубликовано — изменить нельзя.";
      if (e.status === 404) return "Черновик не найден. Возможно, был удалён.";
      if (e.status === 401) return "Сессия истекла. Перезапустите Mini App.";
      return e.message;
    }
    if (e instanceof Error) return e.message;
    return "Не получилось. Попробуйте ещё раз.";
  };

  const handleApprove = async () => {
    if (actionState.kind === "submitting") return;
    setActionState({ kind: "submitting", which: "approve" });
    hapticImpact("light");
    try {
      let scheduledAt: string | undefined;
      let already: boolean | undefined;
      if (isPlan && weeklyPlanId) {
        const r = await approveWeeklyPlan(weeklyPlanId);
        already = r.already;
      } else if (!isReel && draftId) {
        const r = await approveDraft(draftId);
        scheduledAt = r.scheduled_at;
        already = r.already;
      }
      hapticNotify("success");
      setActionState({ kind: "done", which: "approve", scheduledAt, already });
    } catch (e) {
      hapticNotify("error");
      setActionState({ kind: "error", message: mapError(e) });
    }
  };

  const handleReject = async () => {
    if (actionState.kind === "submitting") return;
    setActionState({ kind: "submitting", which: "reject" });
    hapticImpact("light");
    try {
      let already: boolean | undefined;
      if (isPlan && weeklyPlanId) {
        const r = await rejectWeeklyPlan(weeklyPlanId);
        already = r.already;
      } else if (!isReel && draftId) {
        const r = await rejectDraft(draftId);
        already = r.already;
      }
      hapticNotify("success");
      setActionState({ kind: "done", which: "reject", already });
    } catch (e) {
      hapticNotify("error");
      setActionState({ kind: "error", message: mapError(e) });
    }
  };

  // --- terminal state after action ---
  if (actionState.kind === "done") {
    const approved = actionState.which === "approve";
    const { title, body } = doneCopy({
      format: format!,
      approved,
      scheduledAt: actionState.scheduledAt,
      already: actionState.already,
    });
    return (
      <ScreenWrap>
        <Header format={format!} />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              background: YELLOW,
              color: "#0A0608",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 900,
              boxShadow: `0 0 80px ${YELLOW}66`,
            }}
          >
            {approved ? "✓" : "×"}
          </div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.01em" }}>
            {title}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: MUTED, maxWidth: 280, lineHeight: 1.45 }}>
            {body}
          </p>
          <button
            onClick={() => {
              actions.resetFlow();
              actions.navigate("home");
            }}
            style={primaryBtnStyle}
          >
            НА ГЛАВНУЮ
          </button>
          <button
            onClick={() => {
              actions.resetFlow();
              actions.navigate("choose-format");
            }}
            style={ghostBtnStyle}
          >
            Создать ещё →
          </button>
        </div>
      </ScreenWrap>
    );
  }

  // --- main review ---
  const reelStatus = isReel ? reelPoll.data?.status : null;
  const reelDone = isReel && reelStatus === "done";
  const reelAwaiting = isReel && reelStatus === "awaiting_approval";

  const title =
    isReel && !reelDone && !reelAwaiting && reelStatus !== "failed"
      ? "Финальный монтаж готовится"
      : reelAwaiting
        ? "Нужны акценты"
        : "Готово к публикации";

  return (
    <ScreenWrap>
      <Header format={format!} />

      <h1
        style={{
          margin: "8px 0 18px",
          fontSize: 26,
          lineHeight: 1.05,
          fontWeight: 800,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h1>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          marginBottom: 16,
          paddingRight: 2,
        }}
      >
        <Preview
          format={format!}
          draft={draftPoll.data}
          plan={isPlan ? (draftPoll.data as any) : null}
          reel={reelPoll.data}
        />
      </div>

      {actionState.kind === "error" && (
        <p
          style={{
            fontSize: 12,
            color: WARN,
            margin: "0 0 10px",
            textAlign: "center",
          }}
        >
          {actionState.message}
        </p>
      )}

      {isReel ? (
        <ReelActions
          status={reelStatus}
          videoUrl={reelPoll.data?.video_url || null}
          publishState={publishState}
          onGoApprove={() => actions.navigate("reel-approve")}
          onPublish={async () => {
            const pid = reelPoll.data?.project_id;
            const did = reelPoll.data?.draft_id;
            if (!pid || !did) {
              setPublishState({ kind: "error", message: "Нет связи с черновиком." });
              return;
            }
            setPublishState({ kind: "submitting" });
            hapticImpact("medium");
            try {
              const r = await publishReel(pid, did);
              if (r.ok) {
                hapticNotify("success");
                setPublishState({
                  kind: "published",
                  permalink: r.permalink ?? null,
                });
              } else if ("stub" in r && r.stub) {
                // Backend есть, но IG token не настроен — graceful fallback.
                hapticNotify("warning");
                setPublishState({ kind: "stub", message: r.message });
              } else {
                hapticNotify("error");
                setPublishState({
                  kind: "error",
                  message: "error" in r ? r.error : "Не получилось.",
                });
              }
            } catch (e) {
              const msg =
                e instanceof ApiError
                  ? e.status === 409
                    ? "Видео уже опубликовано."
                    : e.status === 503
                      ? "Instagram временно недоступен. Попробуйте через минуту."
                      : e.message
                  : e instanceof Error
                    ? e.message
                    : "Не получилось опубликовать.";
              hapticNotify("error");
              setPublishState({ kind: "error", message: msg });
            }
          }}
          onFinish={() => {
            hapticNotify("success");
            actions.resetFlow();
            actions.navigate("home");
          }}
        />
      ) : (
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <button
            onClick={handleReject}
            disabled={actionState.kind === "submitting"}
            style={{
              ...secondaryBtnStyle,
              opacity: actionState.kind === "submitting" ? 0.6 : 1,
            }}
          >
            {actionState.kind === "submitting" && actionState.which === "reject"
              ? "..."
              : "ОТКЛОНИТЬ"}
          </button>
          <button
            onClick={handleApprove}
            disabled={actionState.kind === "submitting"}
            style={{
              ...primaryBtnStyle,
              flex: 1,
              marginTop: 0,
              opacity: actionState.kind === "submitting" ? 0.7 : 1,
            }}
          >
            {actionState.kind === "submitting" && actionState.which === "approve"
              ? "СОХРАНЯЕМ…"
              : "ОДОБРИТЬ"}
          </button>
        </div>
      )}

      <button onClick={onBack} style={ghostBtnStyle}>
        ← Назад
      </button>
    </ScreenWrap>
  );
}

// --- Header ---
function Header({ format }: { format: ContentFormat }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: MUTED,
          marginBottom: 4,
        }}
      >
        {FORMAT_LABEL[format]} · {DEST_LABEL[format]}
      </div>
    </div>
  );
}

// --- Preview area (variable by format) ---
function Preview({
  format,
  draft,
  plan,
  reel,
}: {
  format: ContentFormat;
  draft: any;
  plan: any;
  reel: any;
}) {
  if (format === "post") {
    const text: string | undefined = draft?.text;
    if (!text) return <EmptyPreview body="Текст черновика ещё не пришёл." />;
    return (
      <Card>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            color: INK,
          }}
        >
          {text}
        </p>
      </Card>
    );
  }

  if (format === "carousel") {
    const slides: Array<{ idx: number; text: string }> | undefined = draft?.slides;
    const caption: string | undefined = draft?.caption;
    if (!slides || slides.length === 0) {
      return <EmptyPreview body="Слайды ещё не пришли." />;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {slides.map((s) => (
          <Card key={s.idx}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: MUTED,
                marginBottom: 6,
              }}
            >
              Слайд {s.idx + 1}
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
              {s.text}
            </p>
          </Card>
        ))}
        {caption && (
          <Card>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: MUTED,
                marginBottom: 6,
              }}
            >
              Caption
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: "rgba(255,255,255,0.85)" }}>
              {caption}
            </p>
          </Card>
        )}
      </div>
    );
  }

  if (format === "weekly-plan") {
    const ideas: Array<{ idx: number; format: string; topic: string; hook: string }> | undefined =
      plan?.ideas;
    if (!ideas || ideas.length === 0) {
      return <EmptyPreview body="Идеи ещё не пришли." />;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ideas.map((it) => (
          <Card key={it.idx}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#0A0608",
                  background: YELLOW,
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontWeight: 700,
                }}
              >
                {it.format}
              </span>
              <span style={{ fontSize: 11, color: MUTED }}>День {it.idx + 1}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{it.topic}</div>
            <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.4 }}>{it.hook}</div>
          </Card>
        ))}
      </div>
    );
  }

  // reel
  return <ReelPreview reel={reel} />;
}

function ReelPreview({ reel }: { reel: any }) {
  const status: string | undefined = reel?.status;
  const videoUrl: string | undefined = reel?.video_url;
  const coverUrl: string | undefined = reel?.cover_url;
  const selections = reel?.user_selections as
    | { key_indices?: number[]; animation?: string }
    | undefined;
  const transcript = reel?.transcript_words as
    | Array<{ idx: number; w: string }>
    | undefined;

  if (status === "done" && videoUrl) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            borderRadius: 18,
            overflow: "hidden",
            background: "#000",
            boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
            aspectRatio: "9 / 16",
            maxHeight: "60vh",
            margin: "0 auto",
            width: "100%",
            maxWidth: 360,
          }}
        >
          <video
            src={videoUrl}
            poster={coverUrl || undefined}
            controls
            playsInline
            preload="metadata"
            style={{ width: "100%", height: "100%", display: "block", background: "#000" }}
          />
        </div>
        {selections?.key_indices && selections.key_indices.length > 0 && transcript && (
          <Card>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: MUTED,
                marginBottom: 6,
              }}
            >
              Акценты ({selections.key_indices.length})
              {selections.animation ? ` · ${selections.animation}` : ""}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.85)" }}>
              {selections.key_indices
                .map((i) => transcript.find((w) => w.idx === i)?.w)
                .filter(Boolean)
                .join(" · ")}
            </div>
          </Card>
        )}
      </div>
    );
  }

  if (status === "awaiting_approval") {
    return (
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
          Транскрипт готов
        </div>
        <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
          Выберите ключевые слова для акцентов — система соберёт финальный Reel.
        </p>
      </Card>
    );
  }

  // pending / claimed / rendering / failed
  return (
    <Card>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
        Финал готовится
      </div>
      <div style={{ fontSize: 12, color: MUTED }}>
        Статус:{" "}
        <span style={{ color: INK }}>
          {status === "failed" ? "ошибка рендера" : status || "—"}
        </span>
      </div>
      {reel?.error && (
        <div style={{ marginTop: 8, fontSize: 12, color: WARN }}>{reel.error}</div>
      )}
    </Card>
  );
}

type PublishState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "published"; permalink: string | null }
  | { kind: "stub"; message: string }
  | { kind: "error"; message: string };

function ReelActions({
  status,
  videoUrl,
  publishState,
  onGoApprove,
  onPublish,
  onFinish,
}: {
  status: string | null | undefined;
  videoUrl: string | null;
  publishState: PublishState;
  onGoApprove: () => void;
  onPublish: () => void;
  onFinish: () => void;
}) {
  if (status === "awaiting_approval") {
    return (
      <div style={{ marginBottom: 10 }}>
        <button onClick={onGoApprove} style={{ ...primaryBtnStyle, marginTop: 0 }}>
          ВЫБРАТЬ АКЦЕНТЫ
        </button>
      </div>
    );
  }

  if (status === "done" && videoUrl) {
    // Published — success card вместо кнопки публикации.
    if (publishState.kind === "published") {
      return (
        <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              background: "rgba(245,231,10,0.08)",
              border: `1px solid ${YELLOW}`,
              borderRadius: 14,
              padding: 14,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: YELLOW, marginBottom: 4 }}>
              ✓ Опубликовано в Instagram
            </div>
            {publishState.permalink && (
              <a
                href={publishState.permalink}
                target="_blank"
                rel="noreferrer"
                style={{ color: INK, fontSize: 12, textDecoration: "underline" }}
              >
                открыть пост ↗
              </a>
            )}
          </div>
          <button onClick={onFinish} style={{ ...primaryBtnStyle, marginTop: 0 }}>
            НА ГЛАВНУЮ
          </button>
        </div>
      );
    }

    // Stub — IG token не настроен, показываем «ГОТОВО» с пометкой.
    if (publishState.kind === "stub") {
      return (
        <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 12, color: MUTED, textAlign: "center" }}>
            Авто-публикация в Instagram скоро будет. Сейчас можно скачать видео.
          </p>
          <button onClick={onFinish} style={{ ...primaryBtnStyle, marginTop: 0 }}>
            ГОТОВО
          </button>
          <a
            href={videoUrl}
            target="_blank"
            rel="noreferrer"
            download
            style={{
              textAlign: "center",
              color: MUTED,
              fontSize: 13,
              textDecoration: "none",
              padding: "8px 0",
            }}
          >
            Скачать видео ↓
          </a>
        </div>
      );
    }

    // Idle / error / submitting — primary publish CTA.
    const submitting = publishState.kind === "submitting";
    return (
      <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {publishState.kind === "error" && (
          <p style={{ margin: 0, fontSize: 12, color: WARN, textAlign: "center" }}>
            {publishState.message}
          </p>
        )}
        <button
          onClick={onPublish}
          disabled={submitting}
          style={{
            ...primaryBtnStyle,
            marginTop: 0,
            opacity: submitting ? 0.6 : 1,
            cursor: submitting ? "default" : "pointer",
          }}
        >
          {submitting ? "ПУБЛИКУЕМ…" : "ОПУБЛИКОВАТЬ"}
        </button>
        <a
          href={videoUrl}
          target="_blank"
          rel="noreferrer"
          download
          style={{
            textAlign: "center",
            color: MUTED,
            fontSize: 13,
            textDecoration: "none",
            padding: "8px 0",
            pointerEvents: submitting ? "none" : "auto",
            opacity: submitting ? 0.4 : 1,
          }}
        >
          Скачать видео ↓
        </a>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div style={{ marginBottom: 10 }}>
        <button
          disabled
          style={{
            ...primaryBtnStyle,
            marginTop: 0,
            opacity: 0.4,
            cursor: "not-allowed",
          }}
        >
          РЕНДЕР НЕ УДАЛСЯ
        </button>
      </div>
    );
  }

  // pending / claimed / rendering
  return (
    <div style={{ marginBottom: 10 }}>
      <button
        disabled
        style={{
          ...primaryBtnStyle,
          marginTop: 0,
          opacity: 0.4,
          cursor: "not-allowed",
        }}
      >
        ФИНАЛ ГОТОВИТСЯ…
      </button>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
        padding: 14,
      }}
    >
      {children}
    </div>
  );
}

function EmptyPreview({ body }: { body: string }) {
  return (
    <Card>
      <p style={{ margin: 0, fontSize: 13, color: MUTED, textAlign: "center" }}>{body}</p>
    </Card>
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
          "max(calc(env(safe-area-inset-bottom) + 24px), 36px)",
      }}
    >
      {children}
    </div>
  );
}

function ErrorBlock({
  title,
  body,
  ctaLabel,
  onCta,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 999,
          background: "rgba(243,155,64,0.12)",
          border: `2px solid ${WARN}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: WARN,
          fontSize: 28,
          fontWeight: 800,
        }}
      >
        !
      </div>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>
        {title}
      </h2>
      <p style={{ margin: 0, fontSize: 13, color: MUTED, maxWidth: 280, lineHeight: 1.4 }}>
        {body}
      </p>
      <button onClick={onCta} style={primaryBtnStyle}>
        {ctaLabel}
      </button>
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  marginTop: 8,
  minHeight: 52,
  padding: "16px 28px",
  border: "none",
  borderRadius: 999,
  background: YELLOW,
  color: "#0A0608",
  fontSize: 15,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
  boxShadow: `0 18px 40px ${YELLOW}33, 0 0 0 1px rgba(255,255,255,0.12) inset`,
};

const secondaryBtnStyle: React.CSSProperties = {
  minHeight: 52,
  padding: "16px 22px",
  border: `1px solid rgba(255,255,255,0.16)`,
  borderRadius: 999,
  background: "transparent",
  color: INK,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const ghostBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: MUTED,
  fontSize: 13,
  cursor: "pointer",
  padding: "8px 0",
};
