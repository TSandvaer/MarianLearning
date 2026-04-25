/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Placeholder Melody palette — Kyle finalizes in 86c9gkm42
        melody: {
          50: '#fff5f8',
          100: '#ffe4ec',
          200: '#ffc9d9',
          300: '#ffa3bf',
          400: '#ff7aa6',
          500: '#f85a93',
          600: '#e63d7a',
          700: '#b82a5f',
          800: '#8a1f48',
          900: '#5c1530',
        },
      },
      fontFamily: {
        // System stack for now; Kyle picks web fonts later
        display: ['ui-rounded', 'system-ui', 'sans-serif'],
        body: ['system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
