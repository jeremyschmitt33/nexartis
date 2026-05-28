'use client'

import { forwardRef, useId } from 'react'
import { cn } from './cn'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Label affiché au-dessus du champ. */
  label?: string
  /** Indication discrète affichée sous le champ (gris). Masquée si une erreur est affichée. */
  hint?: string
  /** Message d'erreur affiché en rouge sous le champ. */
  error?: string | null
  /** Classes additionnelles appliquées au conteneur (div parent). */
  containerClassName?: string
}

/**
 * Textarea partagé — même DA que <Input> mais hauteur multi-lignes.
 * Padding vertical confortable (py-2.5), min-h adapté pour 3 lignes par défaut,
 * `resize-none` pour éviter le grip natif moche.
 * Contraste accentué le 28/05/2026 (Vague 1) : gris-100 + bordure gris-400 + hover gris-500.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { label, hint, error, containerClassName, className, id, rows = 3, ...rest },
    ref,
  ) {
    const autoId = useId()
    const inputId = id ?? autoId
    const hasError = Boolean(error)

    return (
      <div className={cn('w-full', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1.5 font-manrope"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          className={cn(
            'w-full px-3.5 py-2.5 rounded-xl',
            'border outline-none transition-all resize-none',
            'text-sm font-manrope text-[#1a1a2e] leading-relaxed',
            'placeholder:text-gray-400',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            hasError
              ? 'border-red-400 bg-red-50/30 focus:border-red-500 focus:ring-1 focus:ring-red-500/20'
              : 'border-gray-400 bg-gray-100 hover:border-gray-500 focus:border-sky focus:ring-1 focus:ring-sky/20',
            className,
          )}
          {...rest}
        />
        {hasError && (
          <p
            id={`${inputId}-error`}
            className="mt-1.5 text-xs text-red-600 font-manrope flex items-start gap-1"
          >
            <span aria-hidden>⚠</span>
            <span>{error}</span>
          </p>
        )}
        {!hasError && hint && (
          <p
            id={`${inputId}-hint`}
            className="mt-1.5 text-xs text-gray-400 font-manrope"
          >
            {hint}
          </p>
        )}
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'
