import type { Config } from "tailwindcss";

/**
 * Design tokens for I Love Durban.
 *
 * These are brand, not copy — they stay in code and are deliberately absent
 * from the WordPress admin. See WORDPRESS-CMS.md.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand red — the heart, the logo, every primary action.
        brand: {
          50: "#FFF1F3",
          100: "#FFE0E4",
          200: "#FFC6CD",
          400: "#FF5C6E",
          500: "#E4002B",
          600: "#C10024",
          700: "#9B001D",
        },
        // Deep harbour navy — header rails, footer, overlays.
        ink: {
          DEFAULT: "#0A1A33",
          800: "#10233F",
          700: "#1A3255",
          600: "#274468",
          400: "#5A7291",
        },
        // Warm gold for rewards, points and ratings.
        gold: {
          DEFAULT: "#F5A623",
          600: "#D48806",
        },
        paper: "#F2F3F6",
        line: "#E4E7EC",
        muted: "#667085",
      },
      fontFamily: {
        // One family throughout. `display` exists as a separate token so the
        // logo, sponsor names and hub tiles can be restyled later without
        // touching every call site — it just points at the same face for now.
        sans: [
          "'Plus Jakarta Sans Variable'",
          "'Plus Jakarta Sans'",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        display: [
          "'Plus Jakarta Sans Variable'",
          "'Plus Jakarta Sans'",
          "system-ui",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "0.875rem",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.05), 0 1px 3px rgba(16, 24, 40, 0.06)",
        lift: "0 12px 28px -8px rgba(10, 26, 51, 0.18)",
        rail: "0 2px 10px rgba(10, 26, 51, 0.08)",
      },
      maxWidth: {
        shell: "78rem",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-down": "slide-down 0.18s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
