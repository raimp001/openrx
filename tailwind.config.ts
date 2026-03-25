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
        surface: "#FAFAF8",
        primary: "#1A1A1A",
        secondary: "#52525B",
        muted: "#71717A",
        border: "#E4E4E7",
        teal: {
          DEFAULT: "#0F5E54",
          light: "#14806E",
          dark: "#0A4A42",
          50: "#ECFDF5",
          100: "#D1FAE5",
          500: "#0F5E54",
          600: "#0A4A42",
        },
        coral: {
          DEFAULT: "#E8725C",
          light: "#F09A88",
          dark: "#C4543E",
        },
        // Keep legacy names so existing sub-pages don't break
        terra: {
          DEFAULT: "#E8725C",
          light: "#F09A88",
          dark: "#C4543E",
          50: "#FFF4F0",
          100: "#FFE4DB",
          200: "#FFC5B6",
          500: "#E8725C",
          600: "#C4543E",
          700: "#8E3323",
        },
        cream: "#FAFAF8",
        pampas: "#FAFAF8",
        sand: "#E4E4E7",
        cloudy: "#71717A",
        warm: {
          800: "#1A1A1A",
          700: "#3F3F46",
          600: "#52525B",
          500: "#71717A",
        },
        accent: "#10B981",
        "soft-red": "#EF4444",
        "soft-blue": "#3B82F6",
        midnight: "#09090B",
        night: "#09090B",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(3rem, 5.5vw, 5rem)", { lineHeight: "0.95", letterSpacing: "-0.035em" }],
        "display-lg": ["clamp(2.4rem, 4.5vw, 3.8rem)", { lineHeight: "0.97", letterSpacing: "-0.03em" }],
        "display": ["clamp(1.8rem, 3.5vw, 2.8rem)", { lineHeight: "1.05", letterSpacing: "-0.025em" }],
      },
      borderRadius: {
        card: "16px",
        button: "10px",
        nav: "10px",
      },
      boxShadow: {
        "card": "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
        "card-hover": "0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)",
        "topbar": "0 1px 0 rgba(0,0,0,0.04)",
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
