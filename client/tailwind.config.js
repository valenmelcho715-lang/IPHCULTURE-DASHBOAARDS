/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          900: '#0a0a0f',
          800: '#101018',
          700: '#16161f',
          600: '#1e1e2a',
        },
        neon: '#00f0ff',
        success: '#10b981',
        admin: '#f59e0b',
        oficina: '#8b5cf6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(0,240,255,0.12)',
        'glow-lg': '0 0 48px rgba(0,240,255,0.18)',
      },
      backgroundImage: {
        'neon-grad': 'linear-gradient(90deg, #00f0ff, #a855f7)',
      },
    },
  },
  plugins: [],
};
