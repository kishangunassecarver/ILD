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
        // Brand red — the heart, badges and alerts. No longer the action
        // colour: on the night theme actions are aqua, and red is reserved
        // for the marks that mean "love" or "look at this".
        // Same family as coral so the site carries exactly one red: the
        // client's #F6514D.
        brand: {
          50: "#FEF0EF",
          100: "#FDDEDD",
          200: "#FBC2C1",
          400: "#F97370",
          500: "#F6514D",
          600: "#DE3D39",
          700: "#B92F2C",
        },
        // Coral — the client's specified red accent. Featured pills and deal
        // flashes, warm against the deep blue.
        coral: {
          400: "#F97370",
          500: "#F6514D",
          600: "#DE3D39",
        },
        // Ocean aqua — every action, link and active state. 500 is the
        // client's specified brand accent.
        aqua: {
          200: "#8AE7EF",
          300: "#4DD7E3",
          400: "#16C2D2",
          500: "#04A4B4",
          600: "#038795",
        },
        // Deep harbour navy — bands, overlays, button-on-aqua text.
        ink: {
          DEFAULT: "#0A1A33",
          800: "#10233F",
          700: "#1A3255",
          600: "#274468",
          400: "#5A7291",
        },
        // The layered surfaces of the LIGHT theme (the token names date from
        // the original night theme; every call site reads these, so the theme
        // lives here): page < raised section < card.
        night: {
          DEFAULT: "#FFFFFF", // cards
          800: "#F0F5FA", // raised sections, menus sit slightly below cards
          900: "#FFFFFF", // the header bar
          // Hover tint — one visible step below a white card.
          700: "#E9F0F7",
        },
        // Warm gold for rewards, points and ratings.
        gold: {
          DEFAULT: "#F5A623",
          600: "#D48806",
        },
        // Text on the light theme: the client's deepest navy as "snow" keeps
        // every text-snow call site correct without a sweep.
        snow: "#01122C",
        mist: "#33475C",
        paper: "#F2F6FA", // the page itself
        // Soft navy, translucent so it reads evenly on every surface.
        line: "rgba(1, 18, 44, 0.12)",
        muted: "#5C7186", // secondary text
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
        display: ["'Plus Jakarta Sans Variable'", "'Plus Jakarta Sans'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        // Generous, app-like corners — the reference rounds everything.
        card: "1.25rem",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(9, 30, 66, 0.06), 0 2px 8px rgba(9, 30, 66, 0.06)",
        lift: "0 16px 32px -12px rgba(9, 30, 66, 0.16)",
        rail: "0 2px 10px rgba(9, 30, 66, 0.14)",
        // Soft aqua bloom behind primary actions.
        glow: "0 4px 18px -4px rgba(4, 164, 180, 0.55)",
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
