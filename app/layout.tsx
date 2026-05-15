import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@fontsource/dm-sans/200.css";
import "@fontsource/dm-sans/300.css";
import "@fontsource/dm-sans/400.css";
import "./globals.css";
import Script from "next/script";
import TelegramInit from "../components/TelegramInit";
import BottomNav from "../components/BottomNav";
import TgBackButton from "../components/TgBackButton";
import TopBar from "../components/TopBar";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "LEX AI — команда",
  description: "Дашборд управления AI-командой",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0A0705",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className={inter.variable}>
      <body className="bg-bg text-ink min-h-screen">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <TelegramInit />
        <TgBackButton />
        <main style={{ width: "100%", maxWidth: 390, margin: "0 auto", minHeight: "100dvh", position: "relative", paddingBottom: "calc(env(safe-area-inset-bottom) + 78px)" }}>
          <TopBar />
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
