import type { ReactNode } from 'react'

type Variant = 'info' | 'warn' | 'success' | 'danger'

// Styles par variante : fond translucide + bordure assortie + couleur texte lisible.
const VARIANTS: Record<Variant, string> = {
  info: 'bg-blue-50/80 border-blue-200/70 text-blue-800',
  warn: 'bg-amber-50/80 border-amber-200/70 text-amber-800',
  success: 'bg-emerald-50/80 border-emerald-200/70 text-emerald-800',
  danger: 'bg-red-50/80 border-red-200/70 text-red-800',
}

/**
 * InfoBanner — Bandeau d'information V4 Light Premium.
 * 4 variantes : info (bleu), warn (ambre, obligations légales), success (vert),
 * danger (rouge). Icône optionnelle alignée à gauche.
 *
 * Compatible avec l'usage historique de l'ancien InfoBanner (variant = info|warn).
 */
export function InfoBanner({
  variant = 'info',
  children,
  icon,
  className,
}: {
  variant?: Variant
  children: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-xl px-4 py-4 border ${VARIANTS[variant]} ${className ?? ''}`}
      role={variant === 'danger' || variant === 'warn' ? 'alert' : undefined}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <span className="shrink-0 mt-0.5 inline-flex items-center justify-center" aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="font-hanken text-sm leading-relaxed flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}

export default InfoBanner
