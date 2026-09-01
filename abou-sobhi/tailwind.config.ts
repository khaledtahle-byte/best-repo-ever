import type { Config } from 'tailwindcss';

/**
 * Palette is lifted straight off the printed Abou Sobhi menu: a mustard-yellow
 * banner, tomato-red price chips and near-black type on warm paper.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: '#FFC629',
          'yellow-dark': '#E0A800',
          'yellow-soft': '#FFF0C2',
          red: '#D7282F',
          'red-dark': '#A81B21',
          'red-soft': '#FCE9E9',
          ink: '#17120E',
          char: '#2A231D',
          muted: '#7A6E63',
          line: '#E8DFD1',
          paper: '#FFFBF3',
          cream: '#F7EFE1',
        },
        state: {
          new: '#2563EB',
          preparing: '#D97706',
          ready: '#7C3AED',
          delivering: '#0891B2',
          done: '#15803D',
          cancelled: '#9F1239',
        },
      },
      fontFamily: {
        sans: ['Cairo', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Cairo', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,18,14,.05), 0 8px 24px -12px rgba(23,18,14,.18)',
        lift: '0 2px 4px rgba(23,18,14,.06), 0 18px 40px -18px rgba(23,18,14,.3)',
        chip: 'inset 0 -2px 0 rgba(0,0,0,.12)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      keyframes: {
        'slide-up': { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(215,40,47,.45)' },
          '70%': { boxShadow: '0 0 0 12px rgba(215,40,47,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(215,40,47,0)' },
        },
      },
      animation: {
        'slide-up': 'slide-up .22s ease-out',
        'pulse-ring': 'pulse-ring 1.8s ease-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
