'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

type PremiumButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  variant?: Variant
  icon?: ReactNode
  loading?: boolean
  children: ReactNode
  className?: string
}

// Cubic-bezier signature V4 — souple, vivante, sans dépasser.
const EASE = 'transition-all duration-200 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)]'

const BASE = [
  'inline-flex items-center justify-center gap-2.5',
  'h-[52px] px-9 rounded-[14px]',
  'font-hanken font-bold text-[15px] tracking-[-0.01em]',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
  EASE,
].join(' ')

const VARIANTS: Record<Variant, string> = {
  // CTA principal : gradient orange + lift au hover.
  primary: [
    'bg-gradient-to-r from-[#ff9d4d] to-[#ff7a1a] text-white',
    'shadow-[0_8px_20px_rgba(255,122,26,0.35),_inset_0_1px_0_rgba(255,255,255,0.4)]',
    'hover:-translate-y-0.5 hover:brightness-105',
    'active:translate-y-0',
  ].join(' '),
  // Action secondaire : fond clair, bordure, hover doux.
  secondary: [
    'bg-white text-[#0f1a3a] border-[1.5px] border-gray-200',
    'shadow-[0_2px_6px_rgba(15,26,58,0.04)]',
    'hover:-translate-y-0.5 hover:border-[#ff7a1a] hover:bg-[#fafbfc]',
    'active:translate-y-0',
  ].join(' '),
  // Action tertiaire : juste un texte, hover orange.
  ghost: [
    'bg-transparent text-[#0f1a3a]',
    'hover:bg-[#fafbfc] hover:text-[#ff7a1a]',
  ].join(' '),
}

/**
 * PremiumButton — Bouton V4 Light Premium (CTA, secondaire, ghost).
 * Hauteur 52px, radius 14px, gradient orange en primary avec lift au hover.
 * Supporte un état loading qui désactive le bouton et ajoute un spinner.
 */
export const PremiumButton = forwardRef<HTMLButtonElement, PremiumButtonProps>(
  function PremiumButton(
    { variant = 'primary', icon, loading = false, children, className, disabled, type = 'button', ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        {...rest}
        className={[BASE, VARIANTS[variant], className ?? ''].join(' ')}
      >
        {loading ? (
          <span
            className="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin"
            aria-hidden="true"
          />
        ) : icon ? (
          <span className="inline-flex items-center justify-center" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span>{children}</span>
      </button>
    )
  },
)

export default PremiumButton
