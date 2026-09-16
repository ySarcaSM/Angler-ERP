/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ─── Angler Brand: Gold ───
        primary: {
          50: '#fdf8e8',
          100: '#f9edc4',
          200: '#f2d780',
          300: '#eac45e',
          400: '#d4af37',
          500: '#c9a84c',
          600: '#b5882b',
          700: '#8b6914',
          800: '#5c4410',
          900: '#3d2d0b',
        },
        // ─── Angler Brand: Dark ───
        dark: {
          50: '#f2f2f2',
          100: '#e0e0e0',
          200: '#b0b0b0',
          300: '#8a8a8a',
          400: '#666666',
          500: '#4a4a4a',
          600: '#333333',
          700: '#252525',
          800: '#1a1a1a',
          900: '#121212',
          950: '#0a0a0a',
        },
        // ─── Angler Brand: Accent (Orange/Bronze) ───
        accent: {
          400: '#e0a040',
          500: '#d9832b',
          600: '#b56a1e',
        },
        // ─── Semantic ───
        gold: {
          light: '#f5d17d',
          DEFAULT: '#d4af37',
          dark: '#8b7332',
        },
        navy: '#0a0e1a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(180deg, #f5d17d 0%, #d4af37 40%, #8b7332 100%)',
        'gold-gradient-subtle': 'linear-gradient(135deg, #d4af37 0%, #b5882b 50%, #8b6914 100%)',
        'dark-gradient': 'linear-gradient(180deg, #121212 0%, #0a0a0a 100%)',
      },
      boxShadow: {
        'gold-glow': '0 0 40px rgba(212, 175, 55, 0.15)',
        'gold-glow-lg': '0 0 80px rgba(212, 175, 55, 0.2)',
        'dark-card': '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
};
