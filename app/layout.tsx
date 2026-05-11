import type { Metadata, Viewport } from "next";
import "./globals.css";
import Script from "next/script";
import BottomNav from "../components/BottomNav";

export const metadata: Metadata = {
  title: "Lex AI — Команда",
  description: "Дашборд управления AI-командой",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1C1C1E",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-bg text-white min-h-screen">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <main className="pb-24 max-w-xl mx-auto">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
