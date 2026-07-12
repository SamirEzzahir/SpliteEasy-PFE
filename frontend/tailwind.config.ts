import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#f4f4f7",
        surface: "#ffffff",
        ink: {
          DEFAULT: "#0b0f1a",
          2: "#3b4356",
          3: "#6b7280",
          4: "#9aa1ad",
        },
        line: {
          DEFAULT: "#e8e9ee",
          2: "#eef0f4",
        },
        primary: {
          DEFAULT: "#5b4ef0",
          2: "#4a3ee8",
          soft: "#eeecff",
        },
        success: {
          DEFAULT: "#10b981",
          soft: "#dcfce7",
        },
        warn: {
          DEFAULT: "#f59e0b",
          soft: "#fef3c7",
        },
        rose: {
          DEFAULT: "#f43f5e",
          soft: "#ffe4e6",
        },
        amber: "#f97316",
        teal: "#14b8a6",
        indigo: "#6366f1",
        sky: "#0ea5e9",
        pink: "#ec4899",
        emerald: "#059669",
      },
      borderRadius: {
        DEFAULT: "14px",
        sm: "10px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(11,15,26,.04)",
        DEFAULT:
          "0 1px 2px rgba(11,15,26,.04), 0 4px 16px rgba(11,15,26,.04)",
        lg: "0 12px 40px rgba(11,15,26,.10), 0 2px 8px rgba(11,15,26,.04)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
