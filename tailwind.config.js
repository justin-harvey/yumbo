/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#1f8a4c",
          "green-dark": "#166534",
          leaf: "#8fd14f",
          cream: "#f4efe1",
          ink: "#0e1712",
        },
      },
    },
  },
  plugins: [],
};
