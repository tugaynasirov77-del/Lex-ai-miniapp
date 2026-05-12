import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FAFAFA",
        surface: "#FFFFFF",
        border: "rgba(0,0,0,0.08)",
        ink: "#0F0F0F",
        muted: "#6B7280",
        faint: "#9CA3AF",
        sky: "#0EA5E9",
        emerald: "#10B981",
        amber: "#F59E0B",
        indigo: "#6366F1",
        red: "#EF4444",
        accent: "#0EA5E9",
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
