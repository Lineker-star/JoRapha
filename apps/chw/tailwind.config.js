// NativeWind 4 requires Tailwind 3. Colours mirror @jorapha/ui tokens (packages/ui/src/index.ts).
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf7',
          100: '#d1faec',
          500: '#0f9f7a',
          600: '#0b8466',
          700: '#0a6a53',
          900: '#073d31',
        },
        ink: { 900: '#0f172a', 600: '#475569', 400: '#94a3b8' },
      },
      minHeight: { 12: '48px' },
    },
  },
  plugins: [],
};
