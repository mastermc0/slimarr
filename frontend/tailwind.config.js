/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          // Matches --accent in index.css (the emerald/teal used throughout
          // gradients, glows, and status accents) — previously a stale
          // Material-green default that didn't match the rest of the UI.
          green: '#1fbf8f',
          blue: '#1B3A5C',
          accent: '#2196F3',
        },
      },
    },
  },
  plugins: [],
}
