/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      boxShadow: {
        panel: "0 1px 2px rgba(15, 23, 42, 0.06)"
      },
      colors: {
        ink: "#0f172a",
        dune: "#f8fafc",
        ember: "#2563eb",
        tide: "#2563eb",
        moss: "#0f766e",
        sand: "#e2e8f0"
      }
    }
  },
  plugins: []
};
