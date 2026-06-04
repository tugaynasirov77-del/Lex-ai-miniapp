"use client";

import { useEffect, useRef, useState } from "react";
import { useFlow, useFlowActions } from "../../flow";
import {
  ApiError,
  createProject,
  createReelJob,
  signReelUpload,
} from "../../lib/api";
import { hapticImpact, hapticNotify } from "../../lib/telegram";

const YELLOW = "#F5E70A";
const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const WARN = "#F39B40";

const MAX_BYTES = 100 * 1024 * 1024;
const MAX_DURATION = 90;

type Props = {
  onUploaded: () => void;
  onBack: () => void;
};

type Stage =
  | { kind: "empty" }
  | { kind: "selected"; file: File; duration: number }
  | { kind: "validating"; file: File }
  | { kind: "uploading"; file: File; pct: number }
  | { kind: "queued"; jobId: string }
  | { kind: "error"; message: string };

export default function UploadScreen({ onUploaded, onBack: _onBack }: Props) {
  const { state } = useFlow();
  const actions = useFlowActions();
  const [stage, setStage] = useState<Stage>({ kind: "empty" });
  const inputRef = useRef<HTMLInputElement>(null);

  // Как только job создан — сохраняем id и уходим в generate.
  // GenerateScreen сам поллит и навигейтит в review при terminal.
  useEffect(() => {
    if (stage.kind !== "queued") return;
    actions.setIds({ reelJobId: stage.jobId });
    const t = setTimeout(onUploaded, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.kind === "queued" ? stage.jobId : null]);

  // --- file pick ---
  const pickFile = () => {
    hapticImpact("light");
    inputRef.current?.click();
  };

  const onFile = async (f: File | null) => {
    if (!f) return;
    setStage({ kind: "validating", file: f });

    // type check
    const isVideo =
      f.type.startsWith("video/") || /\.(mp4|mov|m4v)$/i.test(f.name);
    if (!isVideo) {
      setStage({ kind: "error", message: "Нужен видеофайл MP4 или MOV." });
      hapticNotify("error");
      return;
    }

    // size check
    if (f.size > MAX_BYTES) {
      setStage({
        kind: "error",
        message: `Файл больше 100 МБ (${(f.size / 1_048_576).toFixed(1)} МБ). Сожмите перед загрузкой.`,
      });
      hapticNotify("error");
      return;
    }

    // duration probe — best effort
    const duration = await probeDuration(f);
    if (duration > MAX_DURATION) {
      setStage({
        kind: "error",
        message: `Видео длиннее ${MAX_DURATION} секунд (${duration} сек).`,
      });
      hapticNotify("error");
      return;
    }

    setStage({ kind: "selected", file: f, duration });
    hapticImpact("light");
  };

  // --- upload pipeline ---
  const startUpload = async () => {
    if (stage.kind !== "selected") return;
    const file = stage.file;
    const duration = stage.duration;
    hapticImpact("medium");

    try {
      // 1. Ensure projectId.
      let projectId = state.projectId;
      if (!projectId) {
        const title = `Reel ${new Date().toLocaleDateString("ru-RU")}`;
        const { projectId: pid } = await createProject({
          title,
          platform: "instagram",
        });
        projectId = pid;
        actions.setIds({ projectId: pid });
      }

      // 2. Sign.
      setStage({ kind: "uploading", file, pct: 0 });
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const signed = await signReelUpload(projectId, {
        size: file.size,
        duration,
        ext,
      });

      // 3. Upload mp4 на VPS-proxy с progress.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", signed.proxy_url, true);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.setRequestHeader("x-upload-token", signed.upload_token);
        xhr.setRequestHeader("x-storage-path", signed.storage_path);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            const pct = Math.round((ev.loaded / ev.total) * 100);
            setStage({ kind: "uploading", file, pct });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else
            reject(
              new Error(
                `Загрузка не удалась (${xhr.status}). Попробуйте ещё раз.`,
              ),
            );
        };
        xhr.onerror = () => reject(new Error("Сеть нестабильна. Попробуйте ещё раз."));
        xhr.ontimeout = () => reject(new Error("Загрузка слишком долгая. Проверьте соединение."));
        xhr.timeout = 180_000;
        xhr.send(file);
      });

      // 4. Create reel_job.
      const created = await createReelJob(projectId, {
        source_video_url: signed.source_video_url,
        source_video_size: file.size,
        source_video_duration: duration,
      });

      hapticNotify("success");
      setStage({ kind: "queued", jobId: created.reel_job_id });
      // navigate в generate произойдёт в render-branch выше когда поллинг подхватит.
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Не получилось. Попробуйте ещё раз.";
      hapticNotify("error");
      setStage({ kind: "error", message: msg });
    }
  };

  const reset = () => {
    setStage({ kind: "empty" });
    if (inputRef.current) inputRef.current.value = "";
  };

  // --- render ---
  return (
    <ScreenWrap>
      <div>
        <div
          style={{
            fontSize: 11,
            color: MUTED,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Reel · загрузка
        </div>
        <h1
          style={{
            margin: "10px 0 0",
            fontSize: 30,
            lineHeight: 1.02,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
          }}
        >
          Загрузите
          <br />
          видео
        </h1>
        <p
          style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.4, color: MUTED }}
        >
          MP4 или MOV, до 90 секунд, до 100 МБ.
        </p>
        <IdeaContextBanner state={state} />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/*"
        style={{ display: "none" }}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />

      <div style={{ marginTop: 24, flex: 1, display: "flex", flexDirection: "column" }}>
        <StageView stage={stage} onPick={pickFile} onReset={reset} />
      </div>

      <Action stage={stage} onPick={pickFile} onStart={startUpload} onReset={reset} />
    </ScreenWrap>
  );
}

// --- subviews ---

function StageView({
  stage,
  onPick,
  onReset,
}: {
  stage: Stage;
  onPick: () => void;
  onReset: () => void;
}) {
  if (stage.kind === "empty") {
    return (
      <Dropzone onClick={onPick}>
        <div style={{ fontSize: 36, fontWeight: 300, color: INK }}>+</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Выберите видео</div>
        <div style={{ fontSize: 12, color: MUTED }}>MP4 / MOV, до 100 МБ</div>
      </Dropzone>
    );
  }

  if (stage.kind === "validating") {
    return (
      <Dropzone>
        <Spinner />
        <div style={{ fontSize: 14, color: MUTED, marginTop: 8 }}>Проверяем файл…</div>
      </Dropzone>
    );
  }

  if (stage.kind === "selected") {
    return (
      <Dropzone onClick={onPick}>
        <div style={{ fontSize: 28 }}>🎬</div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            maxWidth: 260,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {stage.file.name}
        </div>
        <div style={{ fontSize: 12, color: MUTED }}>
          {(stage.file.size / 1_048_576).toFixed(1)} МБ
          {stage.duration > 0 && ` · ${stage.duration} сек`}
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
          Тап чтобы выбрать другой
        </div>
      </Dropzone>
    );
  }

  if (stage.kind === "uploading") {
    return (
      <Dropzone disabled>
        <div style={{ fontSize: 28 }}>📤</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Загружаем</div>
        <ProgressBar pct={stage.pct} />
        <div style={{ fontSize: 12, color: MUTED }}>{stage.pct}%</div>
      </Dropzone>
    );
  }

  if (stage.kind === "queued") {
    return (
      <Dropzone disabled>
        <SuccessTick />
        <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>Принято</div>
        <div style={{ fontSize: 12, color: MUTED, maxWidth: 240, textAlign: "center" }}>
          Открываем экран обработки…
        </div>
      </Dropzone>
    );
  }

  // error
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 12,
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
      <div style={{ fontSize: 18, fontWeight: 700 }}>Не получилось</div>
      <p
        style={{ margin: 0, fontSize: 13, color: MUTED, maxWidth: 280, lineHeight: 1.4 }}
      >
        {stage.message}
      </p>
      <button onClick={onReset} style={ghostBtnStyle}>
        Выбрать другой файл →
      </button>
    </div>
  );
}

function Action({
  stage,
  onPick,
  onStart,
  onReset,
}: {
  stage: Stage;
  onPick: () => void;
  onStart: () => void;
  onReset: () => void;
}) {
  if (stage.kind === "empty") {
    return (
      <button onClick={onPick} style={primaryBtnStyle}>
        ВЫБРАТЬ ВИДЕО
      </button>
    );
  }
  if (stage.kind === "selected") {
    return (
      <button onClick={onStart} style={primaryBtnStyle}>
        ЗАГРУЗИТЬ
      </button>
    );
  }
  if (stage.kind === "uploading" || stage.kind === "validating" || stage.kind === "queued") {
    return (
      <button disabled style={{ ...primaryBtnStyle, opacity: 0.5, cursor: "default" }}>
        {stage.kind === "queued" ? "ПЕРЕХОДИМ…" : "ЗАГРУЖАЕМ…"}
      </button>
    );
  }
  // error
  return (
    <button onClick={onReset} style={primaryBtnStyle}>
      ПОПРОБОВАТЬ ЕЩЁ РАЗ
    </button>
  );
}

function Dropzone({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled || !onClick}
      style={{
        appearance: "none",
        flex: 1,
        minHeight: 240,
        borderRadius: 24,
        border: "1.5px dashed rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.02)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: 24,
        textAlign: "center",
        color: INK,
        fontFamily: "inherit",
        cursor: onClick && !disabled ? "pointer" : "default",
      }}
    >
      {children}
    </button>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div
      style={{
        width: 200,
        height: 4,
        background: "rgba(255,255,255,0.12)",
        borderRadius: 999,
        overflow: "hidden",
        marginTop: 8,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: YELLOW,
          transition: "width 0.2s ease",
        }}
      />
    </div>
  );
}

function Spinner() {
  return (
    <>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          border: `2.5px solid rgba(255,255,255,0.15)`,
          borderTopColor: YELLOW,
          animation: "lex-spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes lex-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function SuccessTick() {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 999,
        background: YELLOW,
        color: "#0A0608",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
        fontWeight: 900,
        boxShadow: `0 0 60px ${YELLOW}55`,
      }}
    >
      ✓
    </div>
  );
}

function IdeaContextBanner({ state }: { state: ReturnType<typeof useFlow>["state"] }) {
  const ideaCtx = state.screenMeta.fromPlanIdea as
    | { topic: string; hook: string | null; format: string }
    | undefined;
  if (!ideaCtx?.topic) return null;
  return (
    <div
      style={{
        marginTop: 14,
        padding: 12,
        borderRadius: 12,
        background: "rgba(245,231,10,0.08)",
        border: "1px solid rgba(245,231,10,0.35)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(245,231,10,0.9)",
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        ✨ Идея из плана
      </div>
      <div
        style={{
          fontSize: 13,
          color: INK,
          lineHeight: 1.4,
          fontWeight: 500,
        }}
      >
        {ideaCtx.topic}
      </div>
      {ideaCtx.hook && (
        <div style={{ fontSize: 11, color: MUTED, marginTop: 4, lineHeight: 1.4 }}>
          Hook: {ideaCtx.hook}
        </div>
      )}
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
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        padding:
          "max(calc(env(safe-area-inset-top) + 64px), 96px) 22px " +
          "max(calc(env(safe-area-inset-bottom) + 32px), 48px)",
      }}
    >
      {children}
    </div>
  );
}

// --- helpers ---

function probeDuration(file: File): Promise<number> {
  return new Promise((res) => {
    try {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      const timer = setTimeout(() => {
        URL.revokeObjectURL(url);
        res(0);
      }, 3000);
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        res(Math.round(v.duration || 0));
      };
      v.onerror = () => {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        res(0);
      };
      v.src = url;
    } catch {
      res(0);
    }
  });
}

const primaryBtnStyle: React.CSSProperties = {
  marginTop: 18,
  width: "100%",
  minHeight: 56,
  padding: "18px 0",
  border: "none",
  borderRadius: 999,
  background: YELLOW,
  color: "#0A0608",
  fontSize: 17,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
  boxShadow:
    "0 22px 52px rgba(245,231,10,0.30), 0 0 0 1px rgba(255,255,255,0.12) inset",
};

const ghostBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: MUTED,
  fontSize: 13,
  cursor: "pointer",
  padding: "8px 0",
};
