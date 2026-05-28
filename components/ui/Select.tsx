'use client'

import { forwardRef, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from './cn'

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
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
 * Select natif partagé — même DA que <Input> mais avec une chevron Lucide
 * positionnée à droite via `appearance-none` + padding-right.
 *
 * On garde `<select>` natif (pas de Combobox custom) parce que :
 * - accessibilité out-of-the-box (clavier, lecteur d'écran)
 * - rendu mobile natif (drawer iOS / Android)
 * - parité comportementale avec ce qui existait avant
 *
 * Pour un combobox avec search/free-text, un autre composant est en cours.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, containerClassName, className, id, children, ...rest },
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
      <div className="relative">
        <select
          ref={ref}
          id={inputId}
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          className={cn(
            'w-full h-11 pl-3.5 pr-10 rounded-xl appearance-none',
            'border outline-none transition-all',
            'text-sm font-manrope text-[#1a1a2e]',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            'cursor-pointer',
            hasError
              ? 'border-red-400 bg-red-50/30 focus:border-red-500 focus:ring-1 focus:ring-red-500/20'
              : 'border-gray-400 bg-gray-100 hover:border-gray-500 focus:border-sky focus:ring-1 focus:ring-sky/20',
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        {/* Chevron Lucide — pointer-events-none pour que le clic traverse vers le <select> */}
        <ChevronDown
          size={16}
          aria-hidden
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
        />
      </div>
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

Select.displayName = 'Select'
