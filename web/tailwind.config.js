/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Mukta', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'],
      },
      fontFeatureSettings: { 'cv11': '', 'ss01': '', 'tnum': '' },
      colors: {
        brand: {
          50:  '#EFF4FF', 100: '#DCE6FE', 200: '#B9CDFD', 300: '#8EADFB',
          400: '#6087F7', 500: '#3B62F2', 600: '#1E3A8A', 700: '#182E70',
          800: '#122356', 900: '#0E1B43',
        },
        accent: {
          50:  '#FFF4EE', 100: '#FFE3D3', 200: '#FFC4A5', 300: '#FFA078',
          400: '#FF8552', 500: '#FF6B1A', 600: '#E15A0A', 700: '#B84707',
          800: '#8F3808', 900: '#6B2B09',
        },
        success: {
          50:  '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0', 300: '#6EE7B7',
          400: '#34D399', 500: '#10B981', 600: '#0F9D58', 700: '#047857',
          800: '#065F46', 900: '#064E3B',
        },
        error: {
          50:  '#FEF2F2', 100: '#FEE2E2', 200: '#FECACA', 300: '#FCA5A5',
          400: '#F87171', 500: '#EF4444', 600: '#D32F2F', 700: '#B91C1C',
        },
        warning: {
          50:  '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 300: '#FCD34D',
          500: '#F59E0B', 700: '#B45309',
        },
        saffron: '#FF9933',
        'india-green': '#138808',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,.04), 0 1px 3px rgba(0,0,0,.06)',
        card: '0 1px 2px rgba(0,0,0,.06), 0 2px 6px rgba(0,0,0,.04)',
        elevated: '0 8px 24px rgba(0,0,0,.10), 0 2px 6px rgba(0,0,0,.04)',
      },
      borderRadius: { 'xl': '12px', '2xl': '16px' },
    },
  },
  plugins: [],
};
