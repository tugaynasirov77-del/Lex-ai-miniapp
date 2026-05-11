import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#1C1C1E",
        card: "#2C2C2E",
        accent: "#5E5CE6",
        muted: "#8E8E93",
        border: "#3A3A3C",
      },
    },
  },
  plugins: [],
} satisfies Config;
