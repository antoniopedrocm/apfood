/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        text: 'var(--color-text)',
        muted: 'var(--color-muted)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          pressed: 'var(--color-primary-pressed)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
        },
        danger: 'var(--color-danger)',
        brandPrimary: 'var(--brand-primary)',
        brandSecondary: 'var(--brand-secondary)',
        brandAccent: 'var(--brand-accent)',
        uiAccent: 'var(--ui-accent)',
      },
      borderRadius: {
        token: 'var(--radius)',
      },
      boxShadow: {
        token: 'var(--shadow)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
      },
    },
  },
  plugins: [],
};
