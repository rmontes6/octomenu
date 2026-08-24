import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "media",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          1: "#ffffff",
          page: "#f2f1ed",
          dark1: "#201f1d",
          darkpage: "#0a0a09",
        },
        ink: {
          primary: "#0b0b0b",
          secondary: "#52514e",
          muted: "#898781",
          dprimary: "#ffffff",
          dsecondary: "#c3c2b7",
        },
        brand: "#c2410c",
        dbrand: "#fb923c",
        status: {
          good: "#0ca30c",
          warning: "#fab219",
          serious: "#ec835a",
          critical: "#d03b3b",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        recipe: ["var(--font-recipe)", "cursive"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 1px 0 rgba(30,28,20,0.03), 0 10px 24px -10px rgba(30,28,20,0.12)",
        "card-dark": "0 1px 1px 0 rgba(0,0,0,0.4), 0 14px 32px -12px rgba(0,0,0,0.55)",
        "card-hover": "0 1px 1px 0 rgba(30,28,20,0.04), 0 18px 36px -12px rgba(30,28,20,0.18)",
        "card-hover-dark": "0 1px 1px 0 rgba(0,0,0,0.45), 0 20px 44px -14px rgba(0,0,0,0.65)",
      },
    },
  },
  plugins: [],
};

export default config;
