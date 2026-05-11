/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Inter Tight', 'Inter', '-apple-system', 'sans-serif'],
      },
      colors: {
        teal: {
          50:  '#EEF7F5',
          100: '#DDEEEB',
          300: '#5BB1A8',
          500: '#1F7F76',
          600: '#16615A',
          700: '#0F4B45',
          800: '#0B3F3A',
          900: '#082A26',
          950: '#061F1C',
        },
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
};
