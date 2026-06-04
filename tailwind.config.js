/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(${name}) / <alpha-value>)`;

module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base: v('--color-bg-base'),
          surface: v('--color-bg-surface'),
          elevated: v('--color-bg-elevated'),
        },
        text: {
          primary: v('--color-text-primary'),
          secondary: v('--color-text-secondary'),
          muted: v('--color-text-muted'),
        },
        border: {
          soft: v('--color-border-soft'),
        },
        accent: {
          DEFAULT: v('--color-accent'),
          fg: v('--color-accent-fg'),
          glow: '#818CF8',
          soft: v('--color-accent-soft'),
        },
        success: v('--color-success'),
        'success-soft': v('--color-success-soft'),
        xp: v('--color-xp'),
        gold: v('--color-gold'),
        streak: v('--color-streak'),
        danger: v('--color-danger'),
        'danger-soft': v('--color-danger-soft'),
        warning: v('--color-warning'),
        'warning-soft': v('--color-warning-soft'),
        srs: {
          new: '#DC2626',
          'new-soft': '#FEE2E2',
          review: '#F59E0B',
          'review-soft': '#FEF3C7',
          learned: '#16A34A',
          'learned-soft': '#DCFCE7',
        },
        trend: {
          up: '#16A34A',
          down: '#DC2626',
          flat: '#94A3B8',
        },
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
