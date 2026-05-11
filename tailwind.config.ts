import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#08080F",
        surface: "#111118",
        surface2: "#1A1A24",
        border: "rgba(255,255,255,0.08)",
        accent: "#6E56CF",
        accent2: "#5B46B0",
        success: "#30A46C",
        warn: "#F76B15",
        ink: "#EDEDEF",
        muted: "rgba(255,255,255,0.45)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      transitionTimingFunction: {
        expo: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      boxShadow: {
        glow: "0 0 20px rgba(110,86,207,0.15)",
        glowBtn: "0 4px 15px rgba(110,86,207,0.4)",
        ringOn: "0 0 0 2px rgba(110,86,207,0.5), 0 0 14px rgba(110,86,207,0.35)",
      },
      backgroundImage: {
        accentGrad: "linear-gradient(135deg, #6E56CF 0%, #5B46B0 100%)",
      },
      animation: {
        "fade-up": "fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "pulse-dot": "pulseDot 1.6s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseDot: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(48,164,108,0.55)" },
          "50%": { boxShadow: "0 0 0 6px rgba(48,164,108,0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
