/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      screens: {
        xs: "360px",
      },
      colors: {
        gray: {
          500: "#9ca3af",
          600: "#737373",
        },
        surface: {
          DEFAULT: "#0f0f0f",
          card: "#181818",
          raised: "#1e1e1e",
          border: "#303030",
          hover: "#242424",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,.35), 0 12px 32px rgba(0,0,0,.18)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
