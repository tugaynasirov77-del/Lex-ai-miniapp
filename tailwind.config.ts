import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0F0F1A",
        bg2: "#1A1A2E",
        card: "#2C2C2E",
        accent: "#5E5CE6",
        accent2: "#7B61FF",
        muted: "rgba(255,255,255,0.6)",
        border: "rgba(255,255,255,0.08)",
      },
      boxShadow: {
        glow: "0 4px 24px rgba(94,92,230,0.25)",
        glowStrong: "0 8px 40px rgba(123,97,255,0.45)",
      },
      backgroundImage: {
        "accent-grad": "linear-gradient(135deg, #7B61FF 0%, #5E5CE6 100%)",
        "page-grad": "linear-gradient(180deg, #0F0F1A 0%, #1A1A2E 100%)",
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease-out both",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
