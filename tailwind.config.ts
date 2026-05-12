import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0F1117",
        bg2: "#131B2E",
        surface: "rgba(255,255,255,0.04)",
        border: "rgba(255,255,255,0.08)",
        ink: "#F1F5F9",
        muted: "#94A3B8",
        faint: "#475569",
        sky: "#3B82F6",
        emerald: "#10B981",
        amber: "#F59E0B",
        indigo: "#6366F1",
        rose: "#F43F5E",
        accent: "#3B82F6",
        success: "#10B981",
        warn: "#F59E0B",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      transitionTimingFunction: {
        expo: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      boxShadow: {
        card: "0 2px 12px rgba(0,0,0,0.06)",
        cardHover: "0 4px 18px rgba(0,0,0,0.10)",
        glowBtn: "0 4px 14px rgba(14,165,233,0.35)",
      },
      animation: {
        "fade-up": "fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "pulse-dot": "pulseDot 1.6s ease-in-out infinite",
        "typing": "typing 1.2s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseDot: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(16,185,129,0.45)" },
          "50%": { boxShadow: "0 0 0 6px rgba(16,185,129,0)" },
        },
        typing: {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
