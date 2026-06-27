/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Near-black blue-tinted surfaces (Expo-launch inspired, single dark theme).
        ink: {
          950: "#05060a",
          900: "#0a0c12",
          850: "#0d0f17",
          800: "#11141d",
          700: "#171b26",
          600: "#1f2430",
        },
        line: "rgba(255,255,255,0.08)",
        // Electric blue / cyan accent (the only accent on the page).
        accent: {
          DEFAULT: "#3b82f6",
          cyan: "#38bdf8",
          glow: "#22d3ee",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(56,189,248,0.35), 0 0 40px -8px rgba(34,211,238,0.45)",
        "glow-soft": "0 0 60px -20px rgba(56,189,248,0.5)",
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
