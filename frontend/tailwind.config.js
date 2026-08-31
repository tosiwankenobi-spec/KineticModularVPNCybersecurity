/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#09090B",
        surface: "#121215",
        surfaceHover: "#18181C",
        border: "#27272A",
        accent: "#00E599",
        threat: "#FF3366",
        warning: "#FFB800",
        muted: "#71717A",
        secondary: "#A1A1AA",
      },
      fontFamily: {
        heading: ["Outfit", "sans-serif"],
        sans: ["IBM Plex Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
