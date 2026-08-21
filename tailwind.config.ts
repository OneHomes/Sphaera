import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Sphaera dark command-center palette
        base: {
          950: "#0a0a0b", // app background
          900: "#111113", // panel background
          800: "#1a1a1d", // card background
          700: "#232327", // hover / border
          600: "#2e2e33", // dividers
        },
        ink: {
          50: "#fafafa",
          300: "#a1a1aa",
          500: "#71717a",
        },
        status: {
          active: "#14b8a6", // teal - active
          inactive: "#ef4444", // red - inactive
          alert: "#f59e0b", // amber - alert
        },
        tier: {
          gold: "#d4af37",
          silver: "#9ca3af",
          bronze: "#b08d57",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
