/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Geist Variable'", "Geist", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["'Instrument Serif'", "Georgia", "serif"],
        mono: ["'Geist Mono Variable'", "'Geist Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
