import type { Config } from "tailwindcss"

const opacityScale = Object.fromEntries(
  Array.from({ length: 101 }, (_, value) => [String(value), String(value / 100)])
)

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#F7FAFF",
        primary: "#07111F",
        secondary: "#334155",
        muted: "#526173",
        border: "#C9D6E6",
        teal: {
          DEFAULT: "#1D4ED8",
          light: "#3B82F6",
          dark: "#173EA5",
          50: "#EFF6FF",
          100: "#DBEAFE",
          500: "#1D4ED8",
          600: "#173EA5",
        },
        coral: {
          DEFAULT: "#B74124",
          light: "#CF5C3A",
          dark: "#8F2D18",
        },
        // Keep legacy names so existing sub-pages don't break
        terra: {
          DEFAULT: "#B74124",
          light: "#CF5C3A",
          dark: "#8F2D18",
          50: "#FFF4F0",
          100: "#FFE4DB",
          200: "#FFC5B6",
          500: "#B74124",
          600: "#8F2D18",
          700: "#9F311C",
        },
        cream: "#F7FAFF",
        pampas: "#F7FAFF",
        sand: "#C9D6E6",
        cloudy: "#526173",
        warm: {
          900: "#07111F",
          800: "#07111F",
          700: "#1E2C42",
          600: "#334155",
          500: "#526173",
          300: "#B9C6D8",
          100: "#EAF1FA",
        },
        accent: "#1D4ED8",
        "soft-red": "#B91C1C",
        "soft-blue": "#1D4ED8",
        midnight: "#09090B",
        night: "#09090B",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(3rem, 5.5vw, 5rem)", { lineHeight: "0.95", letterSpacing: "-0.035em" }],
        "display-lg": ["clamp(2.4rem, 4.5vw, 3.8rem)", { lineHeight: "0.97", letterSpacing: "-0.03em" }],
        "display": ["clamp(1.8rem, 3.5vw, 2.8rem)", { lineHeight: "1.05", letterSpacing: "-0.025em" }],
      },
      borderRadius: {
        card: "20px",
        button: "9999px",
        nav: "10px",
      },
      boxShadow: {
        "card": "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
        "card-hover": "0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)",
        "soft-card": "0 18px 60px rgba(8,24,46,0.08)",
        "topbar": "0 1px 0 rgba(0,0,0,0.04)",
      },
      opacity: opacityScale,
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "hero-fade": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-up": "slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "hero-fade": "hero-fade 0.8s cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
}
export default config
