/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        jakarta: ["var(--font-jakarta)", "ui-sans-serif", "system-ui", "sans-serif"],
        script: ["var(--font-playlist)", "cursive"],
      },
      gridTemplateColumns: {
        '16': 'repeat(16, minmax(0, 1fr))',
      },
      colors: {
        // Anyash dashboard tokens. Text uses zinc-100 / 300 / 500 / 600 for its four levels.
        ay: {
          canvas: "#0B0C0E",
          surface: "#111215",
          raised: "#17181C",
          line: "rgba(255, 255, 255, 0.06)",
          accent: "#FEE5A5",
          "accent-hover": "#FDE8B0",
          "accent-ink": "#E9D39A",
        },
        // Public onboarding page, in the anyash.vercel.app brand. Used only under /onboard.
        ob: {
          bg: "#FAFAFA",
          card: "#FFFFFF",
          ink: "#202724",
          body: "#3A433F",
          muted: "#69736E",
          faint: "#9AA39E",
          line: "#E2E2E2",
          soft: "#F1F4F2",
          brand: "#174A40",
          "brand-2": "#2C6B5C",
          mint: "#E3EEEA",
          sage: "#BFD6CC",
          bad: "#B4412F",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        apple: {
          blue: "#0071E3",
          blueHover: "#0077ED",
          blueLight: "#E8F2FD",
          grayCanvas: "#F5F5F7",
          grayBorder: "#E5E7EB",
          textPrimary: "#1D1D1F",
          textSecondary: "#6E6E73",
          textTertiary: "#86868B",
          surface: "#FFFFFF",
        },
      },
      boxShadow: {
        "apple-sm": "0 1px 2px 0 rgba(0, 0, 0, 0.04)",
        "apple-card": "0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.03)",
        "apple-hover": "0 8px 24px -4px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)",
        "apple-modal": "0 24px 48px -12px rgba(0, 0, 0, 0.18), 0 1px 3px 0 rgba(0, 0, 0, 0.05)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "ob-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "ob-next": {
          from: { opacity: "0", transform: "translateX(28px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "ob-prev": {
          from: { opacity: "0", transform: "translateX(-28px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "ob-float": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-6px) rotate(-1deg)" },
        },
        "ob-pop": {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "60%": { opacity: "1", transform: "scale(1.06)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "ob-tap": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(0.96)" },
          "100%": { transform: "scale(1)" },
        },
        "ob-sheet": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "ob-fade": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "ob-draw": {
          from: { strokeDashoffset: "48" },
          to: { strokeDashoffset: "0" },
        },
        "ob-confetti": {
          "0%": { opacity: "0", transform: "translate(0, 0) scale(0.4) rotate(0deg)" },
          "15%": { opacity: "1" },
          "100%": { opacity: "0", transform: "translate(var(--dx), var(--dy)) scale(1) rotate(var(--rot))" },
        },
        pulseWave: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.8" },
          "50%": { transform: "scale(1.18)", opacity: "0.3" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "ob-in": "ob-in 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "ob-next": "ob-next 0.38s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "ob-prev": "ob-prev 0.38s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "ob-float": "ob-float 6s ease-in-out infinite",
        "ob-pop": "ob-pop 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "ob-tap": "ob-tap 0.28s ease-out",
        "ob-sheet": "ob-sheet 0.32s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "ob-fade": "ob-fade 0.25s ease-out both",
        "ob-draw": "ob-draw 0.5s 0.35s ease-out both",
        "ob-confetti": "ob-confetti 1.1s cubic-bezier(0.2, 0.7, 0.3, 1) both",
        "pulse-wave": "pulseWave 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
}
