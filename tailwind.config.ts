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
          DEFAULT: "#0D9488",
          light: "#14B8A6",
          dark: "#0F766E",
          50: "#F0FDFA",
          100: "#CCFBF1",
          200: "#99F6E4",
          300: "#5EEAD4",
          400: "#2DD4BF",
          500: "#14B8A6",
          600: "#0D9488",
          700: "#0F766E",
          800: "#115E59",
          900: "#134E4A",
        },
        coral: {
          DEFAULT: "#F97066",
          light: "#FCA5A1",
          dark: "#DC2626",
        },
        // Keep legacy names so existing sub-pages don't break
        terra: {
          DEFAULT: "#F97066",
          light: "#FCA5A1",
          dark: "#DC2626",
          50: "#FFF1F0",
          100: "#FFE4E1",
          200: "#FECDD3",
          500: "#F97066",
          600: "#DC2626",
          700: "#991B1B",
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
        violet: {
          DEFAULT: "#8B5CF6",
          light: "#A78BFA",
          dark: "#7C3AED",
          50: "#F5F3FF",
        },
        amber: {
          DEFAULT: "#F59E0B",
          light: "#FCD34D",
          50: "#FFFBEB",
        },
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
        button: "12px",
        nav: "10px",
      },
      boxShadow: {
        "card": "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.08)",
        "card-elevated": "0 8px 24px rgba(0,0,0,0.06), 0 20px 48px rgba(0,0,0,0.06)",
        "glow-teal": "0 0 24px rgba(13,148,136,0.15), 0 0 48px rgba(13,148,136,0.08)",
        "glow-sm": "0 0 12px rgba(13,148,136,0.12)",
        "topbar": "0 1px 0 rgba(0,0,0,0.04)",
        "inner-soft": "inset 0 1px 2px rgba(0,0,0,0.04)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-hero": "linear-gradient(135deg, #F0FDFA 0%, #FAFAF8 40%, #F5F3FF 100%)",
        "gradient-card": "linear-gradient(135deg, rgba(13,148,136,0.03) 0%, rgba(139,92,246,0.03) 100%)",
        "gradient-mesh": "radial-gradient(at 40% 20%, rgba(13,148,136,0.08) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(139,92,246,0.06) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(16,185,129,0.05) 0px, transparent 50%)",
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
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "shimmer": {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "gradient-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-up": "slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "hero-fade": "hero-fade 0.8s cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        "float": "float 3s ease-in-out infinite",
        "shimmer": "shimmer 8s ease-in-out infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "gradient-shift": "gradient-shift 6s ease infinite",
      },
    },
  },
  plugins: [],
}
export default config
