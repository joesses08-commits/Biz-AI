/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        bg: {
          base: "#08090e",
          surface: "#0e0f18",
          elevated: "#141520",
          border: "#1e2035",
          hover: "#1a1b2e",
        },
        accent: {
          DEFAULT: "#4f6ef7",
          dim: "#4f6ef720",
          border: "#4f6ef740",
          hover: "#6b85f8",
        },
        emerald: {
          glow: "#10b981",
          dim: "#10b98115",
        },
        text: {
          primary: "#eef0f6",
          secondary: "#8892b0",
          muted: "#4a5168",
        },
      },
      animation: {
        "fade-up": "fadeUp 0.4s ease forwards",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: 0, transform: "translateY(12px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
