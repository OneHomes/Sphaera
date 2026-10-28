import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Sphaera palette. Values live in CSS variables (app/globals.css) so the
        // light/dark toggle can swap them; `.theme-dark` pins a subtree to dark.
        base: {
          950: "rgb(var(--base-950) / <alpha-value>)", // app background
          900: "rgb(var(--base-900) / <alpha-value>)", // panel background
          800: "rgb(var(--base-800) / <alpha-value>)", // card background
          700: "rgb(var(--base-700) / <alpha-value>)", // hover / border
          600: "rgb(var(--base-600) / <alpha-value>)", // dividers
        },
        ink: {
          50: "rgb(var(--ink-50) / <alpha-value>)",
          300: "rgb(var(--ink-300) / <alpha-value>)",
          500: "rgb(var(--ink-500) / <alpha-value>)",
        },
        status: {
          active: "rgb(var(--status-active) / <alpha-value>)", // teal - active
          inactive: "rgb(var(--status-inactive) / <alpha-value>)", // red - inactive
          alert: "rgb(var(--status-alert) / <alpha-value>)", // amber - alert
        },
        tier: {
          gold: "rgb(var(--tier-gold) / <alpha-value>)",
          silver: "rgb(var(--tier-silver) / <alpha-value>)",
          bronze: "rgb(var(--tier-bronze) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      borderRadius: {
        xl2: "1rem",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        loadingSweep: {
          "0%": { left: "-35%" },
          "100%": { left: "100%" },
        },
      },
      animation: {
        // Duration is deliberately not fixed here — TopLeaderboardBar
        // sets it dynamically via inline style based on content length,
        // so the scroll speed stays visually consistent regardless of
        // how many agents are in the leaderboard.
        marquee: "marquee linear infinite",
        loadingSweep: "loadingSweep 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;