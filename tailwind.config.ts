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
        // ── Surface tiers (calm, near-white, slight cool cast) ──
        surface: "#F8FAFC",       // page background (slate-50)
        "surface-2": "#F1F5F9",   // raised muted area (slate-100)

        // ── Text ladder (WCAG AA on white at all sizes) ──
        primary: "#0B1B33",       // ink — almost-black navy
        secondary: "#1E293B",     // body text (slate-800)
        muted: "#475569",         // captions, helper text (slate-600)
        subtle: "#64748B",        // placeholders, disabled (slate-500)

        // ── Borders / dividers ──
        border: "#E2E8F0",        // slate-200, default rule
        "border-strong": "#CBD5E1", // slate-300, when you need it visible

        // ── Brand colors ──
        // Primary action — deep navy, matches the brand mark.
        navy: {
          DEFAULT: "#0B1B33",
          hover: "#172A4D",
          50: "#F1F5F9",
          100: "#E2E8F0",
          900: "#0B1B33",
        },
        // Accent — muted clinical teal (use sparingly, never on body text)
        teal: {
          DEFAULT: "#0F766E",
          light: "#14B8A6",
          dark: "#115E59",
          50: "#F0FDFA",
          100: "#CCFBF1",
          500: "#0F766E",
          600: "#115E59",
        },
        // Semantic
        success: "#047857",
        warning: "#B45309",
        danger: "#B91C1C",

        // ── Legacy aliases (so existing sub-pages keep compiling) ──
        accent: "#0F766E",
        coral: { DEFAULT: "#B45309", light: "#D97706", dark: "#92400E" },
        terra: {
          DEFAULT: "#B45309",
          light: "#D97706",
          dark: "#92400E",
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          500: "#B45309",
          600: "#92400E",
          700: "#78350F",
        },
        cream: "#F8FAFC",
        pampas: "#F8FAFC",
        sand: "#CBD5E1",
        cloudy: "#475569",
        warm: {
          900: "#0B1B33",
          800: "#0B1B33",
          700: "#1E293B",
          600: "#334155",
          500: "#475569",
          300: "#94A3B8",
          100: "#E2E8F0",
        },
        "soft-red": "#B91C1C",
        "soft-blue": "#1D4ED8",
        midnight: "#0B1B33",
        night: "#0B1B33",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(2.6rem, 4.6vw, 4.2rem)", { lineHeight: "1.05", letterSpacing: "-0.025em" }],
        "display-lg": ["clamp(2.1rem, 3.6vw, 3.2rem)", { lineHeight: "1.08", letterSpacing: "-0.022em" }],
        "display": ["clamp(1.7rem, 2.6vw, 2.4rem)", { lineHeight: "1.15", letterSpacing: "-0.018em" }],
      },
      borderRadius: {
        card: "16px",
        button: "10px",
        nav: "10px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,27,51,0.04), 0 4px 12px rgba(11,27,51,0.04)",
        "card-hover": "0 2px 6px rgba(11,27,51,0.06), 0 8px 24px rgba(11,27,51,0.06)",
        "soft-card": "0 8px 28px rgba(11,27,51,0.06)",
        topbar: "0 1px 0 rgba(11,27,51,0.06)",
        focus: "0 0 0 3px rgba(15,118,110,0.18)",
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
