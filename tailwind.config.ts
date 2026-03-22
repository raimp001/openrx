import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // OpenRx 2026 UI system — editorial clinical palette
        terra: {
          DEFAULT: "#E05B43",
          light: "#F28467",
          dark: "#B9422C",
          50: "#FFF4F0",
          100: "#FFE4DB",
          200: "#FFC5B6",
          500: "#E05B43",
          600: "#B9422C",
          700: "#8E3323",
        },
        cream: "#F5F0E7",
        pampas: "#FFFDF9",
        sand: "#D8D0C2",
        cloudy: "#6C746D",
        warm: {
          800: "#11221E",
          700: "#213530",
          600: "#405650",
          500: "#687A73",
        },
        accent: "#168E68",
        "soft-red": "#CC5464",
        "soft-blue": "#2A7CA7",
        // Premium dark palette
        midnight: "#0A1515",
        night: "#06100F",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Instrument Serif", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Sora", "Avenir Next", "sans-serif"],
      },
      boxShadow: {
        "soft-card": "0 1px 2px rgba(17,34,30,0.04), 0 16px 40px rgba(17,34,30,0.08)",
        "topbar": "0 1px 0 rgba(17,34,30,0.06)",
        "card-hover": "0 6px 18px rgba(17,34,30,0.08), 0 24px 56px rgba(17,34,30,0.12)",
        "terra-glow": "0 0 24px rgba(224,91,67,0.36), 0 0 56px rgba(224,91,67,0.14)",
        "accent-glow": "0 0 18px rgba(22,142,104,0.22)",
        "sidebar": "10px 0 50px rgba(3,10,9,0.42)",
        "premium": "0 2px 6px rgba(17,34,30,0.03), 0 18px 40px rgba(17,34,30,0.08), 0 42px 84px rgba(17,34,30,0.12)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-10px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-up": "slide-up 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-left": "slide-in-left 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "float-slow": "float-slow 8s ease-in-out infinite",
        "glow-pulse": "glow-pulse 2.5s ease-in-out infinite",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
}
export default config
