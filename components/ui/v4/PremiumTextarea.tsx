'use client'

import type { TextareaHTMLAttributes } from 'react'
import { forwardRef } from 'react'
import { FieldLabel, FieldHint, FieldError } from './PremiumInput'

type PremiumTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & {
  label?: string
  hint?: string
  error?: string
  mono?: boolean
  className?: string
}

/**
 * PremiumTextarea — Zone de texte V4 Light Premium.
 * Identique à PremiumInput côté style mais avec padding vertical py-3 et
 * line-height 1.5 pour confort de lecture multi-lignes.
 */
export const PremiumTextarea = forwardRef<HTMLTextAreaElement, PremiumTextareaProps>(
  function PremiumTextarea(
    { label, hint, error, mono = false, className, rows = 4, ...rest },
    ref,
  ) {
    return (
      <div className={className ?? ''}>
        {label && <FieldLabel>{label}</FieldLabel>}
        <textarea
          ref={ref}
          rows={rows}
          {...rest}
          className={[
            'w-full py-3 px-4 rounded-xl border-[1.5px]',
            error ? 'border-red-300' : 'border-gray-200',
            'bg-[#fafbfc] font-hanken font-normal text-[14.5px] text-[#0f1a3a] leading-[1.5]',
            'placeholder:text-gray-400 resize-y',
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

export default PremiumTextarea
