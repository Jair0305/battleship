import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        night: {
          bg: "#090909",
          void: "#0d0d0b",
          ink: "#151513",
          panel: "#171713",
          line: "rgba(241, 251, 134, 0.16)",
          text: "#f7f7ef",
          muted: "#a3a398",
          faint: "#626257",
          accent: "#b9f95a",
          "accent-strong": "#d7ff73",
          danger: "#ff5f69",
          warning: "#f5c85c",
          success: "#8df0b0",
          info: "#8ac7ff",
        },
      },
      fontFamily: {
        ui: ["var(--font-geist)", "system-ui", "sans-serif"],
        display: ["var(--font-pixel)", "var(--font-geist-mono)", "monospace"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        night: "var(--night-radius)",
        "night-sm": "var(--night-radius-sm)",
      },
      transitionTimingFunction: {
        night: "var(--night-ease)",
      },
      boxShadow: {
        night: "var(--night-shadow)",
        "night-inner": "var(--night-inner)",
      },
      animation: {
        "night-fade-up": "nightly-fade-up 420ms var(--night-ease) both",
        "night-pulse": "nightly-pulse 1.4s var(--night-ease) infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
