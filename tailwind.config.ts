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
        // OpenRx 2026 UI system — bright, trusted, high-contrast
        terra: {
          DEFAULT: "#F05A3D",
          light: "#F47F5C",
          dark: "#CF4326",
          50: "#FFF2EE",
          100: "#FFE5DD",
          200: "#FFC7B7",
          500: "#F05A3D",
          600: "#CF4326",
          700: "#A7351D",
        },
        cream: "#F3F8F6",
        pampas: "#FFFFFF",
        sand: "#DCE9E4",
        cloudy: "#6C7D75",
        warm: {
          800: "#14231F",
          700: "#243530",
          600: "#3E524A",
          500: "#677A72",
        },
        accent: "#1FA971",
        "soft-red": "#D1495B",
        "soft-blue": "#1E88B6",
        // Premium dark palette
        midnight: "#0b1914",
        night: "#060f0c",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Fraunces", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Space Grotesk", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "soft-card": "0 1px 3px rgba(20,35,31,0.04), 0 8px 24px rgba(20,35,31,0.07)",
        "topbar": "0 1px 0 rgba(20,35,31,0.07)",
        "card-hover": "0 4px 12px rgba(20,35,31,0.08), 0 20px 48px rgba(20,35,31,0.10)",
        "terra-glow": "0 0 20px rgba(240,90,61,0.4), 0 0 48px rgba(240,90,61,0.18)",
        "accent-glow": "0 0 16px rgba(31,169,113,0.3)",
        "sidebar": "4px 0 48px rgba(0,0,0,0.5)",
        "premium": "0 2px 4px rgba(20,35,31,0.03), 0 12px 24px rgba(20,35,31,0.07), 0 32px 64px rgba(20,35,31,0.09)",
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
