/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      boxShadow: {
        panel: "0 22px 60px rgba(15, 23, 42, 0.14)"
      },
      colors: {
        ink: "#122033",
        dune: "#f6efe5",
        ember: "#e87b62",
        tide: "#2f7f8d",
        moss: "#436a52",
        sand: "#f2dcc1"
      }
    }
  },
  plugins: []
};
