"use client";

import { useEffect, useState } from "react";
import { useFlowActions } from "../../flow";
import { hapticImpact, hapticSelection } from "../../lib/telegram";
import * as P from "../icons/PremiumIcons";

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
const RED = "#E84B5B";

const NOTIF_KEY = "lex.settings.notifications";
const LANG_KEY = "lex.settings.lang";

type Props = { onBack: () => void };

export default function SettingsScreen({ onBack }: Props) {
  const actions = useFlowActions();
  const [notif, setNotif] = useState<boolean>(true);
  const [lang, setLang] = useState<"ru" | "en">("ru");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tgUser, setTgUser] = useState<{ name: string; handle?: string } | null>(null);

  const restartOnboarding = () => {
    hapticImpact("light");
    actions.navigate("welcome");
  };

  useEffect(() => {
    try {
      const n = localStorage.getItem(NOTIF_KEY);
      if (n !== null) setNotif(n === "1");
      const l = localStorage.getItem(LANG_KEY);
      if (l === "en") setLang("en");
    } catch {}
    const tg = (typeof window !== "undefined" && (window as any).Telegram?.WebApp) || null;
    const u = tg?.initDataUnsafe?.user;
    if (u) {
      const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || "Пользователь";
      setTgUser({ name, handle: u.username });
    }
  }, []);

  const toggleNotif = () => {
    hapticSelection();
    setNotif((v) => {
      const next = !v;
      try { localStorage.setItem(NOTIF_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const switchLang = (l: "ru" | "en") => {
    hapticSelection();
    setLang(l);
    try { localStorage.setItem(LANG_KEY, l); } catch {}
  };

  const openSupportDelete = () => {
    hapticImpact("medium");
    const url = "https://t.me/Strateg_alex_bot";
    const tg = (typeof window !== "undefined" && (window as any).Telegram?.WebApp) || null;
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, "_blank");
  };

  return (
    <ScreenWrap>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <button
          onClick={() => { hapticSelection(); onBack(); }}
          style={{
            appearance: "none", width: 36, height: 36, borderRadius: 12,
            background: SOFT, border: `1px solid ${CARD_BORDER}`, color: INK,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
          }}
          aria-label="Назад"
        >
          <ArrowLeft />
        </button>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: INK }}>
          Настройки
        </h1>
      </div>

      {tgUser && (
        <div style={{
          background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16,
          padding: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 999,
            background: IG_GRADIENT,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#FFFFFF", fontSize: 16, fontWeight: 800,
            boxShadow: `0 8px 20px ${PINK}30`,
          }}>
            {tgUser.name.slice(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, color: SUB_MUTED, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Аккаунт Telegram
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: INK, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {tgUser.name}
            </div>
            {tgUser.handle && (
              <div style={{ fontSize: 11.5, color: MUTED, marginTop: 1 }}>@{tgUser.handle}</div>
            )}
          </div>
        </div>
      )}

      <SectionTitle>Предпочтения</SectionTitle>

      <ToggleRow
        icon={<P.PremiumBellIcon size={40} />}
        label="Уведомления о плане"
        sub="Напоминания о публикации"
        value={notif}
        onToggle={toggleNotif}
      />

      <div style={{
        background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14,
        padding: "12px 14px", marginBottom: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{ flexShrink: 0 }}><P.PremiumGlobeIcon size={40} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>Язык генерации</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>На каком языке AI пишет сценарии</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["ru", "en"] as const).map((l) => {
            const active = lang === l;
            return (
              <button
                key={l}
                onClick={() => switchLang(l)}
                style={{
                  appearance: "none", flex: 1, padding: "9px 0", borderRadius: 10,
                  background: active ? `${PINK}1A` : SOFT,
                  border: `1.5px solid ${active ? PINK : CARD_BORDER}`,
                  color: active ? PINK : INK, fontFamily: "inherit",
                  fontSize: 12.5, fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em",
                }}
              >
                {l === "ru" ? "Русский" : "English"}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={restartOnboarding}
        style={{
          appearance: "none", width: "100%", display: "flex", alignItems: "center", gap: 12,
          background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14,
          padding: "12px 14px", color: INK, fontFamily: "inherit", cursor: "pointer", marginBottom: 12,
        }}
      >
        <P.PremiumRestartIcon size={40} />
        <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>Пройти онбординг заново</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>Перенастроить AI под себя</div>
        </div>
        <span style={{ color: SUB_MUTED, fontSize: 18 }}>›</span>
      </button>

      <SectionTitle>Аккаунт</SectionTitle>

      <div style={{
        background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14,
        padding: "12px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: SOFT, border: `1px solid ${CARD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, flexShrink: 0 }}>
          <TagIcon />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>Версия</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>LEX AI · MVP 2026.06</div>
        </div>
      </div>

      {!confirmDelete ? (
        <button
          onClick={() => { hapticSelection(); setConfirmDelete(true); }}
          style={{
            appearance: "none", width: "100%", display: "flex", alignItems: "center", gap: 12,
            background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14,
            padding: "12px 14px", color: RED, fontFamily: "inherit", cursor: "pointer",
            fontSize: 13.5, fontWeight: 700,
          }}
        >
          <div style={{ flexShrink: 0 }}><P.PremiumTrashIcon size={40} /></div>
          <span style={{ flex: 1, textAlign: "left" }}>Удалить аккаунт</span>
        </button>
      ) : (
        <div style={{
          background: `${RED}10`, border: `1px solid ${RED}40`, borderRadius: 14, padding: 14,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: INK, marginBottom: 4 }}>
            Удалить аккаунт?
          </div>
          <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.4, marginBottom: 12 }}>
            Все проекты, разборы и сценарии будут удалены без возможности восстановления. Напиши в поддержку — мы удалим данные вручную в течение суток.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { hapticSelection(); setConfirmDelete(false); }}
              style={{
                appearance: "none", flex: 1, padding: "10px 0", borderRadius: 11,
                background: SOFT, border: `1px solid ${CARD_BORDER}`, color: INK,
                fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              }}
            >
              Отмена
            </button>
            <button
              onClick={openSupportDelete}
              style={{
                appearance: "none", flex: 1, padding: "10px 0", borderRadius: 11,
                background: RED, border: "none", color: "#FFFFFF",
                fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, cursor: "pointer",
              }}
            >
              Написать в поддержку
            </button>
          </div>
        </div>
      )}
    </ScreenWrap>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, color: SUB_MUTED, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, marginTop: 6, paddingLeft: 4 }}>
      {children}
    </div>
  );
}

function ToggleRow({
  icon, label, sub, value, onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        appearance: "none", width: "100%", display: "flex", alignItems: "center", gap: 12,
        background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14,
        padding: "12px 14px", color: INK, fontFamily: "inherit", cursor: "pointer", marginBottom: 12,
      }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 10, background: SOFT, border: `1px solid ${CARD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{
        width: 42, height: 24, borderRadius: 999, flexShrink: 0,
        background: value ? IG_GRADIENT : SOFT,
        border: `1px solid ${value ? PURPLE : CARD_BORDER}`,
        position: "relative", transition: "background 200ms",
      }}>
        <div style={{
          position: "absolute", top: 2, left: value ? 20 : 2,
          width: 18, height: 18, borderRadius: 999, background: "#FFFFFF",
          transition: "left 200ms",
          boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
        }} />
      </div>
    </button>
  );
}

function ScreenWrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      background: BG, color: INK,
      fontFamily: "'Inter', system-ui, sans-serif",
      padding:
        "max(calc(env(safe-area-inset-top) + 56px), 88px) 18px " +
        "max(calc(env(safe-area-inset-bottom) + 96px), 110px)",
      overflowY: "auto", WebkitOverflowScrolling: "touch",
    }}>
      {children}
    </div>
  );
}

function ArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M6 9a6 6 0 0112 0v4l1.5 3H4.5L6 13V9z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M10 19a2 2 0 004 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 12h18M12 3c3 3 4 6 4 9s-1 6-4 9c-3-3-4-6-4-9s1-6 4-9z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 13l8-8h7v7l-8 8a2 2 0 01-2.8 0L3 15.8a2 2 0 010-2.8z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="15" cy="9" r="1.4" fill="currentColor" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 12a8 8 0 1015-3.5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 5v4h-4" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
