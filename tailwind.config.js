/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: '#D4A853',
        'deep-red': '#8B2500',
        'forest-green': '#1A472A',
        sand: '#F5E6C8',
        'dark-bg': '#0A0A0A',
      },
      fontFamily: {
        safari: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
