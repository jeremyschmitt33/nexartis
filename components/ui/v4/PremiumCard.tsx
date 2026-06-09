import type { ReactNode } from 'react'

/**
 * PremiumCard — Carte de section V4 Light Premium.
 * Fond blanc, coins arrondis 3xl, ombre douce, et fine ligne de gradient orange
 * en haut (l'accent visuel signature de la refonte V4).
 *
 * Utilisée comme conteneur de chaque grande zone du dashboard.
 */
export function PremiumCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-white border border-[rgba(15,26,58,0.06)] shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)] ${className ?? ''}`}
    >
      {/* Accent line orange — signature visuelle V4 */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff7a1a] via-[#ff9d4d] to-[#ff7a1a] opacity-90" />
      <div className="p-8">{children}</div>
    </div>
  )
}

export default PremiumCard
