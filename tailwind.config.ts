import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0705",
        bg2: "#15100A",
        surface: "rgba(255,255,255,0.025)",
        border: "rgba(255,255,255,0.07)",
        ink: "rgba(240,232,218,0.92)",
        muted: "rgba(255,255,255,0.35)",
        faint: "rgba(255,255,255,0.18)",
        sky: "#3B82F6",
        emerald: "#10B981",
        amber: "#F0A020",
        indigo: "#6366F1",
        rose: "#F43F5E",
        accent: "#F0A020",
        success: "#10B981",
        warn: "#F0A020",
      },
      fontFamily: {
        sans: ["'DM Sans'", "var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
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
