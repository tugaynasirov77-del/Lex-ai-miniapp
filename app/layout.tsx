import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import BottomNav from "../components/BottomNav";
import TelegramInit from "../components/TelegramInit";

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
  themeColor: "#0F1117",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans bg-bg text-ink min-h-screen">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <TelegramInit />
        <main className="pb-28 max-w-xl mx-auto">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
