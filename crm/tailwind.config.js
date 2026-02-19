/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html'
  ],
  theme: {
    extend: {
      colors: {
        brandPrimary: 'var(--brand-primary)',
        brandSecondary: 'var(--brand-secondary)',
        brandAccent: 'var(--brand-accent)',
        uiAccent: 'var(--ui-accent)',
      },
    },
  },
  plugins: [],
};
