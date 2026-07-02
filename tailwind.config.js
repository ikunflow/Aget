/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        sans: ['Noto Sans SC', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        dark: {
          900: '#0a0e27',
          800: '#0d1333',
          700: '#111a40',
          600: '#1e3a5f',
        },
        gain: '#00ff88',
        loss: '#ff4757',
        gold: '#ffd700',
        info: '#1e90ff',
      },
    },
  },
  plugins: [],
};
