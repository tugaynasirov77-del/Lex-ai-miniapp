"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppBg from "./AppBg";
import HomeScreen from "./HomeScreen";
import ChooseFormatScreen from "./screens/ChooseFormatScreen";
import UploadScreen from "./screens/UploadScreen";
import GenerateScreen from "./screens/GenerateScreen";
import { hapticImpact, showBackButton } from "../lib/telegram";

export type Screen = "home" | "choose-format" | "upload" | "generate";

const ENTER = { opacity: 0, y: 10 };
const SHOW = { opacity: 1, y: 0 };
const EXIT = { opacity: 0, y: -8 };
const TRANS = { duration: 0.24, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] };

export default function AppFlow() {
  const [screen, setScreen] = useState<Screen>("home");
  const historyRef = useRef<Screen[]>([]);

  const navigate = useCallback((next: Screen) => {
    historyRef.current.push(screen);
    hapticImpact("light");
    setScreen(next);
  }, [screen]);

  const back = useCallback(() => {
    const prev = historyRef.current.pop();
    if (prev) {
      hapticImpact("light");
      setScreen(prev);
    }
  }, []);

  // Telegram BackButton: показываем на любом не-home экране, прячем на home.
  useEffect(() => {
    if (screen === "home") return;
    const off = showBackButton(back);
    return off;
  }, [screen, back]);

  // Полностью блокируем скролл документа на flow-странице,
  // оставляем мягкий rubber-band только внутри foreground.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.cssText;
    const prevBody = body.style.cssText;
    html.style.height = "100%";
    body.style.height = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "contain";
    return () => {
      html.style.cssText = prevHtml;
      body.style.cssText = prevBody;
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: "calc(-1 * (env(safe-area-inset-bottom) + 78px))",
        overflow: "hidden",
      }}
    >
      <AppBg />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={screen}
          initial={ENTER}
          animate={SHOW}
          exit={EXIT}
          transition={TRANS}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {screen === "home" && <HomeScreen onStart={() => navigate("choose-format")} />}
          {screen === "choose-format" && (
            <ChooseFormatScreen onPick={() => navigate("upload")} onBack={back} />
          )}
          {screen === "upload" && (
            <UploadScreen onUploaded={() => navigate("generate")} onBack={back} />
          )}
          {screen === "generate" && <GenerateScreen onBack={back} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
