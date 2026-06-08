import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Palette historique Nexartis (dashboard, devis, factures)
        navy: {
          DEFAULT: '#0f1a3a',
          mid: '#1a2d5a',
        },
        sky: {
          DEFAULT: '#5ab4e0',
          light: '#7dcbf5',
        },
        orange: {
          DEFAULT: '#e87a2a',
          hover: '#f09050',
        },
        gold: '#f5c842',
        cream: '#f0ede4',
        // V4 (2026-06-08) — Refonte landing dark premium.
        // Ces tokens cohabitent avec les couleurs Nexartis historiques pour
        // ne pas casser le dashboard. Utilisés uniquement sur la landing.
        bgdark: {
          DEFAULT: '#060912',
          2: '#0a0f20',
          3: '#0d1428',
          ink: '#04060d', // intro overlay
        },
        ink: {
          DEFAULT: '#eaf0ff',
          2: '#aab4d4',
          3: '#76819f',
        },
        electric: {
          DEFAULT: '#3f7bff',
          2: '#6aa0ff',
          ink: '#9fc0ff',
        },
        mint: '#2fd6a0',
        violet: '#8b6dff',
        accent: {
          DEFAULT: '#ff7a1a', // accent landing (orange + saturé que orange dashboard)
          2: '#ff9d4d',
          ink: '#ffc79a',
        },
      },
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        manrope: ['Manrope', 'sans-serif'],
        jakarta: ['Plus Jakarta Sans', 'sans-serif'],
        // V3.0a - Polices du nouveau design devis/facture (PDF + Dashboard).
        // Variables CSS injectees par app/layout.tsx via next/font/google.
        hanken: ['var(--font-hanken)', 'Hanken Grotesk', 'sans-serif'],
        'spline-mono': ['var(--font-spline-mono)', 'Spline Sans Mono', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        // V4 landing — animations dark premium
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'spin-slow-reverse': {
          '0%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        'float-y': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        'pulse-conflict': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 122, 26, 0.7)' },
          '50%': { boxShadow: '0 0 0 12px rgba(255, 122, 26, 0)' },
        },
        spark: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '50%': { transform: 'scale(1.2)', opacity: '1' },
          '100%': { transform: 'scale(0.95)', opacity: '0.85' },
        },
        letter: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'chip-in': {
          '0%': { transform: 'translate(var(--x-from, 0), var(--y-from, 0)) scale(0.6)', opacity: '0' },
          '100%': { transform: 'translate(0, 0) scale(1)', opacity: '1' },
        },
        'fade-up': {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        prog: {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
      },
      animation: {
        'spin-slow': 'spin-slow 40s linear infinite',
        'spin-slow-reverse': 'spin-slow-reverse 60s linear infinite',
        'float-y': 'float-y 6s ease-in-out infinite',
        'pulse-conflict': 'pulse-conflict 1.6s ease-out infinite',
      },
      maxWidth: {
        container: '1200px',
      },
    },
  },
  plugins: [],
}
export default config
