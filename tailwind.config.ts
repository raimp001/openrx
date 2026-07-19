import type { Config } from "tailwindcss"

const opacityScale = Object.fromEntries(
  Array.from({ length: 101 }, (_, value) => [String(value), String(value / 100)])
)

const withAlpha = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: withAlpha("--color-bg-rgb"),
        "surface-2": withAlpha("--color-surface-muted-rgb"),
        primary: withAlpha("--color-text-rgb"),
        secondary: withAlpha("--color-secondary-rgb"),
        muted: withAlpha("--color-muted-rgb"),
        subtle: withAlpha("--color-subtle-rgb"),
        border: withAlpha("--color-border-rgb"),
        "border-strong": withAlpha("--color-border-strong-rgb"),
        navy: {
          DEFAULT: withAlpha("--color-navy-rgb"),
          hover: withAlpha("--color-navy-hover-rgb"),
          50: withAlpha("--color-surface-muted-rgb"),
          100: withAlpha("--color-border-rgb"),
          900: withAlpha("--color-navy-rgb"),
        },
        teal: {
          DEFAULT: withAlpha("--color-accent-rgb"),
          light: withAlpha("--color-accent-light-rgb"),
          dark: withAlpha("--color-accent-dark-rgb"),
          50: withAlpha("--color-accent-50-rgb"),
          100: withAlpha("--color-accent-100-rgb"),
          500: withAlpha("--color-accent-rgb"),
          600: withAlpha("--color-accent-dark-rgb"),
        },
        success: withAlpha("--color-success-rgb"),
        warning: withAlpha("--color-warning-rgb"),
        danger: withAlpha("--color-danger-rgb"),
        accent: withAlpha("--color-accent-rgb"),
        coral: { DEFAULT: withAlpha("--color-warning-rgb"), light: "#D97706", dark: "#92400E" },
        terra: {
          DEFAULT: withAlpha("--color-warning-rgb"),
          light: "#D97706",
          dark: "#92400E",
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          500: withAlpha("--color-warning-rgb"),
          600: "#92400E",
          700: "#78350F",
        },
        cream: withAlpha("--color-bg-rgb"),
        pampas: withAlpha("--color-bg-rgb"),
        sand: withAlpha("--color-border-strong-rgb"),
        cloudy: withAlpha("--color-muted-rgb"),
        warm: {
          900: withAlpha("--color-text-rgb"),
          800: withAlpha("--color-text-rgb"),
          700: withAlpha("--color-secondary-rgb"),
          600: withAlpha("--color-secondary-rgb"),
          500: withAlpha("--color-muted-rgb"),
          300: withAlpha("--color-subtle-rgb"),
          100: withAlpha("--color-border-rgb"),
        },
        "soft-red": withAlpha("--color-danger-rgb"),
        "soft-blue": "#93C5FD",
        midnight: "#0A1C2E",
        night: "#06111D",
      },
      fontFamily: {
        serif: ["var(--font-sans)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(2.6rem, 4.6vw, 4.2rem)", { lineHeight: "1.05", letterSpacing: "-0.025em" }],
        "display-lg": ["clamp(2.1rem, 3.6vw, 3.2rem)", { lineHeight: "1.08", letterSpacing: "-0.022em" }],
        display: ["clamp(1.7rem, 2.6vw, 2.4rem)", { lineHeight: "1.15", letterSpacing: "-0.018em" }],
      },
      borderRadius: {
        card: "8px",
        button: "8px",
        nav: "8px",
      },
      boxShadow: {
        card: "inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 14px rgba(0,0,0,0.24)",
        "card-hover": "inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 22px rgba(0,0,0,0.30)",
        "soft-card": "0 6px 20px rgba(0,0,0,0.26)",
        topbar: "0 1px 0 rgba(255,255,255,0.05)",
        focus: "0 0 0 3px rgb(var(--color-accent-rgb) / 0.18)",
      },
      opacity: opacityScale,
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "hero-fade": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.98)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        "slide-up": "slide-up 0.35s ease-out",
        "hero-fade": "hero-fade 0.5s ease-out both",
        "scale-in": "scale-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
}
export default config
