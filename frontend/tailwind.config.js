/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Light neutral scale (NeuroPay-style floating-card surfaces). Low index =
        // page surface, high index = subtle tints. Names kept as `ink.*` so existing
        // class usages keep working after the dark -> light flip.
        ink: {
          950: "#eef1f8", // page background base
          900: "#ffffff", // card / field surface
          850: "#ffffff", // console (hero) card surface
          800: "#f1f4fb", // hover surface
          700: "#e8edf8",
          600: "#dfe6f4",
        },
        line: "rgba(15,23,42,0.08)",
        // Electric blue — the single accent on the page. `cyan`/`glow` are aliased to
        // blue so any legacy `accent-cyan` class still renders blue.
        accent: {
          DEFAULT: "#2563eb",
          cyan: "#2563eb",
          glow: "#3b82f6",
        },
      },
      fontFamily: {
        // Anton = heavy condensed display (DealSync editorial type); always uppercase.
        display: ["Anton", "system-ui", "sans-serif"],
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        // Soft, blue-tinted elevation for floating light cards.
        glow: "0 1px 0 rgba(255,255,255,0.9) inset, 0 24px 60px -30px rgba(37,99,235,0.35)",
        "glow-soft": "0 18px 50px -28px rgba(37,99,235,0.30)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
};
