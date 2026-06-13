import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        border: 'hsl(var(--border))',
        ink: 'hsl(var(--ink))',
        paper: 'hsl(var(--paper))',
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          coral: '#f15a29',
          tomato: '#ff4d28',
          indigo: '#1c1b6f',
          lime: '#c4e036',
          amber: '#f2a65a',
          rose: '#d12864',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        'border-beam': {
          '100%': { 'offset-distance': '100%' },
        },
        'shimmer': {
          '0%, 90%, 100%': { 'background-position': 'calc(-100% - var(--shimmer-width)) 0' },
          '30%, 60%': { 'background-position': 'calc(100% + var(--shimmer-width)) 0' },
        },
        'marquee': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(calc(-100% - var(--gap)))' },
        },
        'meteor': {
          '0%': { transform: 'rotate(215deg) translateX(0)', opacity: '1' },
          '70%': { opacity: '1' },
          '100%': { transform: 'rotate(215deg) translateX(-500px)', opacity: '0' },
        },
        'spotlight': {
          '0%': { opacity: '0', transform: 'translate(-72%, -62%) scale(0.5)' },
          '100%': { opacity: '1', transform: 'translate(-50%, -40%) scale(1)' },
        },
        'aurora': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'grid-move': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(40px)' },
        },
        'ripple': {
          '0%, 100%': { transform: 'translate(-50%, -50%) scale(1)', opacity: '0.3' },
          '50%': { transform: 'translate(-50%, -50%) scale(0.9)', opacity: '0.5' },
        },
      },
      animation: {
        'border-beam': 'border-beam calc(var(--duration)*1s) infinite linear',
        'shimmer': 'shimmer 8s infinite',
        'marquee': 'marquee var(--duration) linear infinite',
        'meteor': 'meteor 5s linear infinite',
        'spotlight': 'spotlight 2s ease .25s 1 forwards',
        'aurora': 'aurora 60s linear infinite',
        'grid-move': 'grid-move 12s linear infinite',
        'ripple': 'ripple 3s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
