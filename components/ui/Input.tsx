'use client'

import { forwardRef, useId } from 'react'
import { cn } from './cn'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Label affiché au-dessus du champ. Si omis, aucun label n'est rendu. */
  label?: string
  /** Indication discrète affichée sous le champ (gris). Masquée si une erreur est affichée. */
  hint?: string
  /** Message d'erreur affiché en rouge sous le champ. */
  error?: string | null
  /** Classes additionnelles appliquées au conteneur (div parent). */
  containerClassName?: string
}

/**
 * Composant Input partagé — style "mix A+B" validé le 28/05/2026,
 * contraste accentué le 28/05/2026 (Vague 1) :
 * - bordure gris-400 (au lieu de gris-300, plus visible sur tous écrans)
 * - fond gris-100 (au lieu de gris-50/60, jugé invisible par le PO)
 * - hover border gris-500 pour feedback explicite
 * - focus sky discret (border + ring 1px)
 *
 * forwardRef pour autoriser un futur usage avec react-hook-form ou pour
 * focus programmatique (ex : focus auto sur 1er champ d'un formulaire).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, containerClassName, className, id, ...rest },
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
      <input
        ref={ref}
        id={inputId}
        aria-invalid={hasError || undefined}
        aria-describedby={
          hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
        }
        className={cn(
          // base
          'w-full h-11 px-3.5 rounded-xl',
          'border outline-none transition-all',
          'text-sm font-manrope text-[#1a1a2e]',
          'placeholder:text-gray-400',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          // état (erreur vs normal)
          hasError
            ? 'border-red-400 bg-red-50/30 focus:border-red-500 focus:ring-1 focus:ring-red-500/20'
            : 'border-gray-400 bg-gray-100 hover:border-gray-500 focus:border-sky focus:ring-1 focus:ring-sky/20',
          // override utilisateur
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
})

Input.displayName = 'Input'
