/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b1018",
          900: "#141b27",
          800: "#1c2636",
          700: "#2a364c",
        },
        gold: {
          200: "#e6dcc8",
          300: "#d2c4a8",
          400: "#c0ae8c",
          500: "#a89268",
          600: "#8a734c",
        },
        saffron: {
          400: "#c4a07a",
          500: "#9a6e4a",
          600: "#7a5538",
        },
        cream: {
          50: "#f7f4ee",
          100: "#efe8dc",
          200: "#d8cfc0",
        },
        temple: {
          red: "#7a2430",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 22px 60px -28px rgba(6, 10, 18, 0.72)",
      },
    },
  },
  plugins: [],
};
