/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'my-pink': '#FFC0CB',
        'my-cream': '#FFF5F0',
        'my-rose': '#F48FB1',
        ink: '#3D2B3D',
        sparkle: '#FFD966',
      },
      fontFamily: {
        display: ['ui-rounded', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
