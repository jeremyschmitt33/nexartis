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
    },
  },
  plugins: [],
}
export default config
