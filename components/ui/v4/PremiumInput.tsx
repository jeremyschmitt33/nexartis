'use client'

import type { InputHTMLAttributes, ReactNode } from 'react'
import { forwardRef } from 'react'

/**
 * FieldLabel — Label premium SMALL CAPS, gras, espacé.
 * Exporté ici pour rester groupé avec PremiumInput (cohérence des champs).
 */
export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block font-hanken font-semibold text-xs uppercase tracking-wider text-gray-700 mb-2">
      {children}
    </label>
  )
}

/** FieldHint — Texte d'aide discret sous l'input. */
export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 font-hanken text-xs text-gray-500">{children}</p>
}

/** FieldError — Message d'erreur sous l'input (rouge, gras). */
export function FieldError({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 font-hanken text-xs font-semibold text-red-600">{children}</p>
}

type PremiumInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  label?: string
  hint?: string
  error?: string
  mono?: boolean
  className?: string
}

/**
 * PremiumInput — Champ texte V4 Light Premium.
 * Fond #fafbfc, bordure 1.5px, focus ring orange à 4 niveaux, transition smooth.
 * Option `mono` pour les nombres (active font-spline-mono + tracking).
 *
 * Wrappe avec FieldLabel + FieldHint/FieldError selon l'état.
 */
export const PremiumInput = forwardRef<HTMLInputElement, PremiumInputProps>(
  function PremiumInput(
    { label, hint, error, mono = false, className, ...rest },
    ref,
  ) {
    return (
      <div className={className ?? ''}>
        {label && <FieldLabel>{label}</FieldLabel>}
        <input
          ref={ref}
          {...rest}
          className={[
            'w-full py-2.5 px-4 rounded-xl border-[1.5px]',
            error ? 'border-red-300' : 'border-gray-200',
            'bg-[#fafbfc] font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.4]',
            'placeholder:text-gray-400',
            'focus:outline-none focus:border-[#ff7a1a] focus:bg-white',
            'focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)]',
            'transition-all duration-200',
            mono ? 'font-spline-mono font-medium tracking-[0.5px]' : '',
          ].join(' ')}
        />
        {error ? <FieldError>{error}</FieldError> : hint ? <FieldHint>{hint}</FieldHint> : null}
      </div>
    )
  },
)

export default PremiumInput
