'use client'

import type { SelectHTMLAttributes, ReactNode } from 'react'
import { forwardRef } from 'react'
import { FieldLabel, FieldHint, FieldError } from './PremiumInput'

type PremiumSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> & {
  label?: string
  hint?: string
  error?: string
  className?: string
  children: ReactNode
}

/**
 * PremiumSelect — Menu déroulant natif V4 Light Premium.
 * Mêmes classes que PremiumInput + cursor-pointer (signale l'interaction).
 * Garde le <select> natif pour l'accessibilité et la conformité mobile.
 */
export const PremiumSelect = forwardRef<HTMLSelectElement, PremiumSelectProps>(
  function PremiumSelect(
    { label, hint, error, className, children, ...rest },
    ref,
  ) {
    return (
      <div className={className ?? ''}>
        {label && <FieldLabel>{label}</FieldLabel>}
        <select
          ref={ref}
          {...rest}
          className={[
            'w-full py-2.5 px-4 rounded-xl border-[1.5px]',
            error ? 'border-red-300' : 'border-gray-200',
            'bg-[#fafbfc] font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.4]',
            'cursor-pointer',
            'focus:outline-none focus:border-[#ff7a1a] focus:bg-white',
            'focus:shadow-[0_0_0_4px_rgba(255,122,26,0.12),_0_4px_12px_rgba(255,122,26,0.08)]',
            'transition-all duration-200',
          ].join(' ')}
        >
          {children}
        </select>
        {error ? <FieldError>{error}</FieldError> : hint ? <FieldHint>{hint}</FieldHint> : null}
      </div>
    )
  },
)

export default PremiumSelect
