/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#0B1220', 900: '#101827', 800: '#18263B', 700: '#1D2B43', 600: '#26385A', 500: '#33496F' },
        cyan: { DEFAULT: '#36C8F4', 400: '#5AD4F7', 600: '#1FA9D6' },
        violet: { DEFAULT: '#7868F5', 400: '#988BF8' },
        ink: { DEFAULT: '#E6EDF7', muted: '#97A6BE', faint: '#64748B' },
      },
      fontFamily: { sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'] },
      boxShadow: { panel: '0 8px 30px rgba(0,0,0,0.35)', glow: '0 0 0 1px rgba(54,200,244,.6), 0 0 18px rgba(54,200,244,.25)' },
    },
  },
  plugins: [],
};
